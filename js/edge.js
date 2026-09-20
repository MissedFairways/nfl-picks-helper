const MIN_LEAGUE = 20;
const MIN_TEAM = 16;
const TEAM_SEASONS = 5;

export function gameSeason(game) {
  const s = Number(game && game.season);
  return Number.isFinite(s) ? s : null;
}

export function teamWindowStart(currentSeason) {
  const season = Number(currentSeason) || new Date().getFullYear();
  return season - TEAM_SEASONS;
}

export function inTeamWindow(row, currentSeason) {
  const s = gameSeason(row);
  if (s == null) return false;
  const season = Number(currentSeason) || new Date().getFullYear();
  const start = teamWindowStart(season);
  const end = season - 1;
  return s >= start && s <= end;
}

export function lineBucket(spreadSize) {
  const size = Math.abs(Number(spreadSize));
  if (!Number.isFinite(size)) return null;
  if (size <= 2.5) return { id: "pk_to_2_5", label: "PK to 2.5" };
  if (size === 3) return { id: "three", label: "3" };
  if (size >= 3.5 && size <= 6.5) return { id: "3_5_to_6_5", label: "3.5 to 6.5" };
  if (size === 7) return { id: "seven", label: "7" };
  if (size >= 7.5 && size <= 9.5) return { id: "7_5_to_9_5", label: "7.5 to 9.5" };
  if (size >= 10) return { id: "ten_plus", label: "10+" };
  return { id: "other", label: String(size) };
}


const DIVISIONS = {
  ARI:"NFC West",ATL:"NFC South",BAL:"AFC North",BUF:"AFC East",
  CAR:"NFC South",CHI:"NFC North",CIN:"AFC North",CLE:"AFC North",
  DAL:"NFC East",DEN:"AFC West",DET:"NFC North",GB:"NFC North",
  HOU:"AFC South",IND:"AFC South",JAX:"AFC South",KC:"AFC West",
  LAC:"AFC West",LAR:"NFC West",LV:"AFC West",MIA:"AFC East",
  MIN:"NFC North",NE:"AFC East",NO:"NFC South",NYG:"NFC East",
  NYJ:"AFC East",PHI:"NFC East",PIT:"AFC North",SEA:"NFC West",
  SF:"NFC West",TB:"NFC South",TEN:"AFC South",WAS:"NFC East",WSH:"NFC East",
  "Arizona Cardinals":"NFC West","Atlanta Falcons":"NFC South","Baltimore Ravens":"AFC North","Buffalo Bills":"AFC East",
  "Carolina Panthers":"NFC South","Chicago Bears":"NFC North","Cincinnati Bengals":"AFC North","Cleveland Browns":"AFC North",
  "Dallas Cowboys":"NFC East","Denver Broncos":"AFC West","Detroit Lions":"NFC North","Green Bay Packers":"NFC North",
  "Houston Texans":"AFC South","Indianapolis Colts":"AFC South","Jacksonville Jaguars":"AFC South","Kansas City Chiefs":"AFC West",
  "Los Angeles Chargers":"AFC West","Los Angeles Rams":"NFC West","Las Vegas Raiders":"AFC West","Miami Dolphins":"AFC East",
  "Minnesota Vikings":"NFC North","New England Patriots":"AFC East","New Orleans Saints":"NFC South","New York Giants":"NFC East",
  "New York Jets":"AFC East","Philadelphia Eagles":"NFC East","Pittsburgh Steelers":"AFC North","Seattle Seahawks":"NFC West",
  "San Francisco 49ers":"NFC West","Tampa Bay Buccaneers":"NFC South","Tennessee Titans":"AFC South","Washington Commanders":"NFC East"
};

function teamCoveredInGame(g, team) {
  if (!g || g.push) return null;
  if (g.home_team === team) return g.home_covered ? true : false;
  if (g.away_team === team) return g.away_covered ? true : false;
  return null;
}

export function homeDogsUnder(games, maxSpread = 7) {
  const filtered = games.filter(g =>
    g.is_home_dog &&
    g.spread_size <= maxSpread &&
    !g.push
  );
  const covers = filtered.filter(g => g.home_covered).length;
  const total = filtered.length;
  return {
    description: "Home dogs ≤ " + maxSpread,
    total,
    covers,
    rate: total > 0 ? +(covers / total * 100).toFixed(1) : null
  };
}

export function homeFavoritesOver(games, minSpread = 7) {
  const filtered = games.filter(g =>
    g.is_home_favorite &&
    g.spread_size >= minSpread &&
    !g.push
  );
  const covers = filtered.filter(g => g.home_covered).length;
  const total = filtered.length;
  return {
    description: "Home favorites ≥ " + minSpread,
    total,
    covers,
    rate: total > 0 ? +(covers / total * 100).toFixed(1) : null
  };
}

export function underdogsUnder(games, maxSpread = 7) {
  const filtered = games.filter(g => g.spread_size <= maxSpread && !g.push);
  const covers = filtered.filter(g => {
    return g.is_home_dog ? g.home_covered : g.away_covered;
  }).length;
  const total = filtered.length;
  return {
    description: "All underdogs ≤ " + maxSpread,
    total,
    covers,
    rate: total > 0 ? +(covers / total * 100).toFixed(1) : null
  };
}

export function leagueBucketCover(games, bucketId, side) {
  const filtered = (games || []).filter(g => {
    if (g.push) return false;
    const b = lineBucket(g.spread_size);
    if (!b || b.id !== bucketId) return false;
    if (side === "home_dog") return !!g.is_home_dog;
    if (side === "home_fav") return !!g.is_home_favorite;
    return true;
  });
  const covers = filtered.filter(g => {
    if (side === "home_dog" || side === "home_fav") return !!g.home_covered;
    return g.is_home_favorite ? g.home_covered : g.away_covered;
  }).length;
  const total = filtered.length;
  return {
    total,
    covers,
    rate: total > 0 ? +(covers / total * 100).toFixed(1) : null
  };
}

export function analyzeMatchup(game, historical) {
  const notes = [];
  let homeScore = 0;
  let awayScore = 0;
  const home = game.home_team;
  const away = game.away_team;
  const season = gameSeason(game) || new Date().getFullYear();
  const start = teamWindowStart(season);
  const end = season - 1;

  if (!historical || historical.length === 0) {
    return {
      notes: ["No historical sample loaded."],
      leanTeam: null,
      leanText: "No lean yet",
      homeArrows: 0,
      awayArrows: 0
    };
  }

  const teamHist = historical.filter(g => inTeamWindow(g, season));
  const homeAtHome = teamHist.filter(g => g.home_team === home && !g.push);
  if (homeAtHome.length > 0) {
    const covers = homeAtHome.filter(g => g.home_covered).length;
    notes.push(home + " covered " + covers + "/" + homeAtHome.length + " at home from " + start + "-" + end + ".");
    if (homeAtHome.length >= MIN_TEAM) {
      if (covers / homeAtHome.length >= 0.55) homeScore += 1;
      if (covers / homeAtHome.length <= 0.45) awayScore += 1;
    }
  } else {
    notes.push("Not enough " + start + "-" + end + " home games for " + home + ".");
  }

  const awayOnRoad = teamHist.filter(g => g.away_team === away && !g.push);
  if (awayOnRoad.length > 0) {
    const covers = awayOnRoad.filter(g => g.away_covered).length;
    notes.push(away + " covered " + covers + "/" + awayOnRoad.length + " on the road from " + start + "-" + end + ".");
    if (awayOnRoad.length >= MIN_TEAM) {
      if (covers / awayOnRoad.length >= 0.55) awayScore += 1;
      if (covers / awayOnRoad.length <= 0.45) homeScore += 1;
    }
  } else {
    notes.push("Not enough " + start + "-" + end + " road games for " + away + ".");
  }

  const homeDiv = DIVISIONS[home];
  const awayDiv = DIVISIONS[away];
  if (homeDiv && homeDiv === awayDiv) {
    notes.push("Division game (" + homeDiv + ").");
  }

  const h2h = teamHist.filter(g =>
    (g.home_team === home && g.away_team === away) ||
    (g.home_team === away && g.away_team === home)
  );
  const h2hDecided = h2h.filter(g => !g.push);
  if (h2h.length > 0) {
    const homeCovers = h2hDecided.filter(g => teamCoveredInGame(g, home) === true).length;
    const awayCovers = h2hDecided.filter(g => teamCoveredInGame(g, away) === true).length;
    const decided = h2hDecided.length;
    let h2hLine = "H2H " + start + "-" + end + ": " + h2h.length + " meeting(s)";
    if (decided > 0) {
      h2hLine += " • " + home + " covered " + homeCovers + "/" + decided + " • " + away + " covered " + awayCovers + "/" + decided;
      if (homeCovers > awayCovers) h2hLine += " • Edge " + home;
      else if (awayCovers > homeCovers) h2hLine += " • Edge " + away;
      else h2hLine += " • no H2H ATS edge";
    }
    notes.push(h2hLine);
    if (decided >= 6) {
      if (homeCovers / decided >= 0.60) homeScore += 1;
      if (awayCovers / decided >= 0.60) awayScore += 1;
    }
  }

  const spread = game.spread_close ?? game.spread ?? null;
  if (typeof spread === "number") {
    const bucket = lineBucket(Math.abs(spread));
    const isHomeFav = spread < 0;
    const isHomeDog = spread > 0;
    if (bucket && (isHomeFav || isHomeDog)) {
      const side = isHomeDog ? "home_dog" : "home_fav";
      const stat = leagueBucketCover(historical, bucket.id, side);
      const who = isHomeDog ? "home dogs" : "home favorites";
      if (stat.total >= MIN_LEAGUE) {
        notes.push("2015-2025 " + who + " at " + bucket.label + " covered " + stat.rate + "% (" + stat.covers + "/" + stat.total + ").");
        if (stat.rate >= 52) {
          if (isHomeDog) homeScore += 1;
          else homeScore += 1;
        }
        if (stat.rate <= 48) {
          if (isHomeDog) awayScore += 1;
          else awayScore += 1;
        }
      } else {
        notes.push("Not enough 2015-2025 games in the " + bucket.label + " bucket.");
      }
    }
  } else {
    notes.push("No current line yet, so line-bucket edges cannot be applied.");
  }

  let leanTeam = null;
  let leanText = "No clear lean yet";
  if (homeAtHome.length < MIN_TEAM && awayOnRoad.length < MIN_TEAM) {
    leanText = "Not enough recent team games for a lean yet";
  } else if (homeScore > awayScore) {
    leanTeam = home;
    leanText = "Lean: " + home;
  } else if (awayScore > homeScore) {
    leanTeam = away;
    leanText = "Lean: " + away;
  }

  return {
    notes,
    leanTeam,
    leanText,
    homeArrows: homeScore,
    awayArrows: awayScore
  };
}
