import { analyzeMatchup } from "./edge.js";
import { sagarinForGame } from "./sagarin.js";

function seasonWeights(week) {
  if (week <= 4) return { movement: 0.50, sagarin: 0.30, historical: 0.20 };
  if (week <= 10) return { movement: 0.35, sagarin: 0.45, historical: 0.20 };
  return { movement: 0.25, sagarin: 0.55, historical: 0.20 };
}

function activeWeights(week, hasMove) {
  const base = seasonWeights(week);
  if (hasMove) return { ...base, missingMove: false };
  const sag = base.sagarin;
  const hist = base.historical;
  const total = sag + hist;
  return {
    movement: 0,
    sagarin: sag / total,
    historical: hist / total,
    missingMove: true
  };
}

function sagarinBucket(absEdge) {
  if (absEdge >= 5) return { points: 3.0, label: "very large" };
  if (absEdge >= 3) return { points: 2.2, label: "large" };
  if (absEdge >= 1.5) return { points: 1.3, label: "medium" };
  if (absEdge >= 0.5) return { points: 0.6, label: "small" };
  return { points: 0, label: "none" };
}

function moveBucket(absMove) {
  if (absMove >= 3) return { points: 3.0, label: "large" };
  if (absMove >= 2) return { points: 2.0, label: "medium-large" };
  if (absMove >= 1) return { points: 1.2, label: "medium" };
  if (absMove >= 0.5) return { points: 0.5, label: "small" };
  return { points: 0, label: "none" };
}

function histStrength(agreements) {
  if (agreements >= 3) return 2.5;
  if (agreements === 2) return 1.4;
  if (agreements === 1) return 0.6;
  return 0;
}

function fmt(n) {
  return Number(n).toFixed(2);
}

export function scoreGame(game, historical, sagarinData) {
  const reasons = [];
  const flags = [];
  let home = 0;
  let away = 0;
  let sagHome = 0;
  let sagAway = 0;
  let moveHome = 0;
  let moveAway = 0;
  let histHome = 0;
  let histAway = 0;

  const sag = sagarinForGame(game, sagarinData);
  const sagAbs = typeof sag.edgePoints === "number" ? Math.abs(sag.edgePoints) : 0;
  const sagBucket = sagarinBucket(sagAbs);
  const hasSag = sagBucket.points > 0 && sag.edgeTeam;

  let rawMove = null;
  let absMove = 0;
  let moveTeam = null;
  let towardHome = null;
  const hasBothLines = typeof game.spread_open === "number" && typeof game.spread_close === "number";
  if (hasBothLines) {
    rawMove = game.spread_close - game.spread_open;
    absMove = Math.abs(rawMove);
    towardHome = rawMove < 0;
    moveTeam = towardHome ? game.home_team : game.away_team;
  }
  const hasMoveSignal = hasBothLines && absMove >= 0.5;
  const weights = activeWeights(game.week || 1, hasMoveSignal);

  const conflict =
    hasSag &&
    moveTeam &&
    sag.edgeTeam !== moveTeam &&
    absMove >= 2 &&
    sagAbs >= 3;

  if (hasSag) {
    let sagWeight = weights.sagarin;
    if (conflict) sagWeight = sagWeight * (2 / 3);
    const weighted = sagBucket.points * sagWeight;
    if (sag.edgeTeam === game.home_team) {
      sagHome = weighted;
      home += weighted;
    }
    if (sag.edgeTeam === game.away_team) {
      sagAway = weighted;
      away += weighted;
    }
    reasons.push("Sagarin " + sagBucket.label + " edge " + sag.edgeTeam + " (" + sagAbs.toFixed(2) + ")");
    if (sagAbs >= 5) {
      flags.push("Large Sagarin gap — check injuries/news before trusting this");
    }
  } else {
    reasons.push("Sagarin too close to Vegas to score");
  }

  if (hasBothLines) {
    const bucket = moveBucket(absMove);
    if (bucket.points > 0 && hasMoveSignal) {
      reasons.push("Line " + bucket.label + " move toward " + moveTeam + " (" + game.spread_open + " → " + game.spread_close + ")");
      if (conflict) {
        flags.push("Conflict: Sagarin and the line move disagree");
      } else {
        const weighted = bucket.points * weights.movement;
        if (towardHome) {
          moveHome = weighted;
          home += weighted;
        } else {
          moveAway = weighted;
          away += weighted;
        }
      }
    } else {
      reasons.push("Line has not moved enough to score");
    }
  } else {
    reasons.push("No Tuesday open line yet — movement weight rolled into Sagarin and historical");
    flags.push("Partial board: waiting on Tuesday open");
  }

  const hist = analyzeMatchup(game, historical);
  const homeArrows = hist.homeArrows || 0;
  const awayArrows = hist.awayArrows || 0;
  histHome = histStrength(homeArrows) * weights.historical;
  histAway = histStrength(awayArrows) * weights.historical;
  home += histHome;
  away += histAway;
  if (homeArrows) reasons.push("Historical arrows home: " + homeArrows);
  if (awayArrows) reasons.push("Historical arrows away: " + awayArrows);
  if (homeArrows >= 3) reasons.push("All available historical arrows point home");
  if (awayArrows >= 3) reasons.push("All available historical arrows point away");

  const pick = home === away ? null : (home > away ? "home" : "away");
  const pickTeam = pick === "home" ? game.home_team : pick === "away" ? game.away_team : null;
  const margin = Math.abs(home - away);

  let confidence = "none";
  let units = 0;
  if (pick && margin >= 1.20) {
    confidence = "strong";
    units = 3;
  } else if (pick && margin >= 0.75) {
    confidence = "medium";
    units = 2;
  } else if (pick && margin >= 0.30) {
    confidence = "small";
    units = 1;
  }

  if (pick && (sagAbs >= 5 || conflict) && units > 1) {
    units = 1;
    confidence = conflict ? "conflict" : "caution";
  }

  let text = pickTeam
    ? ("System: " + pickTeam + " " + fmt(margin) + " (" + confidence + ", " + units + "u)")
    : "System: no play " + fmt(margin);
  if (conflict && pickTeam) text = "System: " + pickTeam + " " + fmt(margin) + " (conflict, " + units + "u)";

  const breakdown =
    "Sagarin " + fmt(sagHome - sagAway) +
    " • Hist " + fmt(histHome - histAway) +
    " • Move " + (hasMoveSignal ? fmt(moveHome - moveAway) : "n/a") +
    " • Edge " + fmt(home - away) +
    (weights.missingMove ? " • 2-metric board" : " • 3-metric board");

  return {
    pick,
    pickTeam,
    units,
    confidence,
    home,
    away,
    margin,
    edge: home - away,
    reasons,
    flags,
    text,
    breakdown,
    weights
  };
}
