import { analyzeMatchup } from "./edge.js";
import { sagarinForGame } from "./sagarin.js";

function seasonWeights(week) {
  if (week <= 4) return { movement: 0.50, sagarin: 0.30, historical: 0.20 };
  if (week <= 10) return { movement: 0.35, sagarin: 0.45, historical: 0.20 };
  return { movement: 0.25, sagarin: 0.55, historical: 0.20 };
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

export function scoreGame(game, historical, sagarinData) {
  const weights = seasonWeights(game.week || 1);
  const reasons = [];
  const flags = [];
  let home = 0;
  let away = 0;

  const sag = sagarinForGame(game, sagarinData);
  const sagAbs = typeof sag.edgePoints === "number" ? Math.abs(sag.edgePoints) : 0;
  const sagBucket = sagarinBucket(sagAbs);
  const hasSag = sagBucket.points > 0 && sag.edgeTeam;

  let rawMove = null;
  let absMove = 0;
  let moveTeam = null;
  let towardHome = null;
  if (typeof game.spread_open === "number" && typeof game.spread_close === "number") {
    rawMove = game.spread_close - game.spread_open;
    absMove = Math.abs(rawMove);
    towardHome = rawMove < 0;
    moveTeam = towardHome ? game.home_team : game.away_team;
  }

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
    if (sag.edgeTeam === game.home_team) home += weighted;
    if (sag.edgeTeam === game.away_team) away += weighted;
    reasons.push("Sagarin " + sagBucket.label + " edge " + sag.edgeTeam + " (" + sagAbs.toFixed(2) + ")");
    if (sagAbs >= 5) {
      flags.push("Large Sagarin gap — check injuries/news before trusting this");
    }
  }

  if (rawMove !== null) {
    const bucket = moveBucket(absMove);
    if (bucket.points > 0) {
      reasons.push("Line " + bucket.label + " move toward " + moveTeam + " (" + game.spread_open + " → " + game.spread_close + ")");
      if (conflict) {
        flags.push("Conflict: Sagarin and the line move disagree");
      } else {
        const weighted = bucket.points * weights.movement;
        if (towardHome) home += weighted;
        else away += weighted;
      }
    }
  } else {
    reasons.push("No Tuesday-to-Saturday move yet");
  }

  const hist = analyzeMatchup(game, historical);
  const homeHist = hist.homeArrows || 0;
  const awayHist = hist.awayArrows || 0;
  home += histStrength(homeHist) * weights.historical;
  away += histStrength(awayHist) * weights.historical;
  if (homeHist) reasons.push("Historical arrows home: " + homeHist);
  if (awayHist) reasons.push("Historical arrows away: " + awayHist);
  if (homeHist >= 3) reasons.push("All available historical arrows point home");
  if (awayHist >= 3) reasons.push("All available historical arrows point away");

  const pick = home === away ? null : (home > away ? "home" : "away");
  const pickTeam = pick === "home" ? game.home_team : pick === "away" ? game.away_team : null;
  const margin = Math.abs(home - away);

  let confidence = "none";
  let units = 0;
  if (pick && margin >= 1.8) {
    confidence = "strong";
    units = 3;
  } else if (pick && margin >= 1.1) {
    confidence = "medium";
    units = 2;
  } else if (pick && margin >= 0.6) {
    confidence = "small";
    units = 1;
  }

  if (pick && (sagAbs >= 5 || conflict) && units > 1) {
    units = 1;
    confidence = conflict ? "conflict" : "caution";
  }

  let text = pickTeam ? ("System: " + pickTeam + " (" + confidence + ", " + units + "u)") : "System: no play";
  if (conflict && pickTeam) text = "System: " + pickTeam + " (conflict, " + units + "u)";

  return {
    pick,
    pickTeam,
    units,
    confidence,
    home,
    away,
    reasons,
    flags,
    text
  };
}
