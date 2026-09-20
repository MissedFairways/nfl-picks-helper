import { homeDogsUnder, homeFavoritesOver } from "./edge.js";
import { sagarinForGame } from "./sagarin.js";

const MIN_HIST = 20;

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
  if (typeof sag.edgePoints === "number" && Math.abs(sag.edgePoints) >= 0.5) {
    const bucket = sagarinBucket(Math.abs(sag.edgePoints));
    const weighted = bucket.points * weights.sagarin;
    if (sag.edgeTeam === game.home_team) home += weighted;
    if (sag.edgeTeam === game.away_team) away += weighted;
    reasons.push(`Sagarin ${bucket.label} edge ${sag.edgeTeam} (${Math.abs(sag.edgePoints).toFixed(2)})`);
    if (Math.abs(sag.edgePoints) >= 5) {
      flags.push("Large Sagarin gap — check injuries/news before trusting this");
    }
  }

  if (typeof game.spread_open === "number" && typeof game.spread_close === "number") {
    const rawMove = game.spread_close - game.spread_open;
    const absMove = Math.abs(rawMove);
    const bucket = moveBucket(absMove);
    if (bucket.points > 0) {
      const towardHome = rawMove < 0;
      const moveTeam = towardHome ? game.home_team : game.away_team;
      const weighted = bucket.points * weights.movement;
      if (towardHome) home += weighted;
      else away += weighted;
      reasons.push(`Line ${bucket.label} move toward ${moveTeam} (${game.spread_open} → ${game.spread_close})`);

      if (sag.edgeTeam && sag.edgeTeam !== moveTeam && absMove >= 2 && Math.abs(sag.edgePoints || 0) >= 3) {
        flags.push("Sagarin and the line move disagree — possible injury or sharp vs public fight");
      }
    }
  } else {
    reasons.push("No Tuesday-to-Saturday move yet");
  }

  let homeHist = 0;
  let awayHist = 0;

  if (historical && historical.length) {
    const homeAtHome = historical.filter(g => g.home_team === game.home_team && !g.push);
    if (homeAtHome.length >= MIN_HIST) {
      const rate = homeAtHome.filter(g => g.home_covered).length / homeAtHome.length;
      if (rate >= 0.55) { homeHist += 1; reasons.push(`${game.home_team} strong at home historically`); }
      if (rate <= 0.45) { awayHist += 1; reasons.push(`${game.home_team} weak at home historically`); }
    }

    const awayOnRoad = historical.filter(g => g.away_team === game.away_team && !g.push);
    if (awayOnRoad.length >= MIN_HIST) {
      const rate = awayOnRoad.filter(g => g.away_covered).length / awayOnRoad.length;
      if (rate >= 0.55) { awayHist += 1; reasons.push(`${game.away_team} strong on the road historically`); }
      if (rate <= 0.45) { homeHist += 1; reasons.push(`${game.away_team} weak on the road historically`); }
    }

    if (typeof game.spread_close === "number") {
      const size = Math.abs(game.spread_close);
      if (game.spread_close > 0 && size <= 7) {
        const stat = homeDogsUnder(historical, 7);
        if (stat.total >= MIN_HIST && stat.rate >= 52) {
          homeHist += 1;
          reasons.push("Home-dog pattern supports home");
        }
      }
      if (game.spread_close < 0 && size >= 7) {
        const stat = homeFavoritesOver(historical, 7);
        if (stat.total >= MIN_HIST && stat.rate <= 48) {
          awayHist += 1;
          reasons.push("Big home favorites have underperformed in the sample");
        }
      }
    }
  }

  const homeHistScore = histStrength(homeHist) * weights.historical;
  const awayHistScore = histStrength(awayHist) * weights.historical;
  home += homeHistScore;
  away += awayHistScore;
  if (homeHist >= 3) reasons.push("All available historical arrows point home");
  if (awayHist >= 3) reasons.push("All available historical arrows point away");

  const total = home + away;
  const pick = home === away ? null : (home > away ? "home" : "away");
  const pickTeam = pick === "home" ? game.home_team : pick === "away" ? game.away_team : null;
  const margin = Math.abs(home - away);

  let confidence = "none";
  let units = 0;
  if (pick && margin >= 1.8) { confidence = "strong"; units = 3; }
  else if (pick && margin >= 1.1) { confidence = "medium"; units = 2; }
  else if (pick && margin >= 0.6) { confidence = "small"; units = 1; }

  const homePct = total > 0 ? Math.round(home / total * 100) : 50;
  const awayPct = 100 - homePct;

  return {
    pick,
    pickTeam,
    units,
    confidence,
    home,
    away,
    homePct,
    awayPct,
    reasons,
    flags,
    text: pickTeam
      ? `System: ${pickTeam} (${confidence}, ${units}u)`
      : "System: no play"
  };
}
