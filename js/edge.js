const MIN_GAMES_FOR_LEAN = 20;

export function homeDogsUnder(games, maxSpread = 7) {
  const filtered = games.filter(g =>
    g.is_home_dog &&
    g.spread_size <= maxSpread &&
    !g.push
  );
  const covers = filtered.filter(g => g.home_covered).length;
  const total = filtered.length;
  return {
    description: `Home dogs ≤ ${maxSpread}`,
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
    description: `Home favorites ≥ ${minSpread}`,
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
    description: `All underdogs ≤ ${maxSpread}`,
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

  if (!historical || historical.length === 0) {
    return {
      notes: ["No historical sample loaded."],
      leanTeam: null,
      leanText: "No lean yet"
    };
  }

  const homeAtHome = historical.filter(g => g.home_team === home && !g.push);
  if (homeAtHome.length > 0) {
    const covers = homeAtHome.filter(g => g.home_covered).length;
    notes.push(`${home} covered ${covers}/${homeAtHome.length} at home since 2015.`);
    if (homeAtHome.length >= MIN_GAMES_FOR_LEAN) {
      if (covers / homeAtHome.length >= 0.55) homeScore += 1;
      if (covers / homeAtHome.length <= 0.45) awayScore += 1;
    }
  } else {
    notes.push(`No home games for ${home} in the sample.`);
  }

  const awayOnRoad = historical.filter(g => g.away_team === away && !g.push);
  if (awayOnRoad.length > 0) {
    const covers = awayOnRoad.filter(g => g.away_covered).length;
    notes.push(`${away} covered ${covers}/${awayOnRoad.length} on the road since 2015.`);
    if (awayOnRoad.length >= MIN_GAMES_FOR_LEAN) {
      if (covers / awayOnRoad.length >= 0.55) awayScore += 1;
      if (covers / awayOnRoad.length <= 0.45) homeScore += 1;
    }
  } else {
    notes.push(`No road games for ${away} in the sample.`);
  }

  const h2h = historical.filter(g =>
    (g.home_team === home && g.away_team === away) ||
    (g.home_team === away && g.away_team === home)
  );
  if (h2h.length > 0) {
    notes.push(`These two teams have ${h2h.length} game(s) in the 2015-2025 sample.`);
  }

  const spread = game.spread_close ?? game.spread ?? null;
  if (typeof spread === "number") {
    const spreadSize = Math.abs(spread);
    const isHomeFav = spread < 0;
    const isHomeDog = spread > 0;

    if (isHomeDog && spreadSize <= 7) {
      const stat = homeDogsUnder(historical, 7);
      if (stat.total >= MIN_GAMES_FOR_LEAN) {
        notes.push(`Pattern: home dogs ≤ 7 covered ${stat.rate}% (${stat.covers}/${stat.total}).`);
        if (stat.rate >= 52) homeScore += 1;
        if (stat.rate <= 48) awayScore += 1;
      }
    }

    if (isHomeFav && spreadSize >= 7) {
      const stat = homeFavoritesOver(historical, 7);
      if (stat.total >= MIN_GAMES_FOR_LEAN) {
        notes.push(`Pattern: home favorites ≥ 7 covered ${stat.rate}% (${stat.covers}/${stat.total}).`);
        if (stat.rate >= 52) homeScore += 1;
        if (stat.rate <= 48) awayScore += 1;
      }
    }
  } else {
    notes.push("No current line yet, so spread-size edges cannot be applied.");
  }

  let leanTeam = null;
  let leanText = "No clear lean yet";

  const enoughHome = homeAtHome.length >= MIN_GAMES_FOR_LEAN;
  const enoughAway = awayOnRoad.length >= MIN_GAMES_FOR_LEAN;

  if (!enoughHome && !enoughAway) {
    leanText = "Not enough games for a lean yet";
  } else if (homeScore > awayScore) {
    leanTeam = home;
    leanText = `Lean: ${home}`;
  } else if (awayScore > homeScore) {
    leanTeam = away;
    leanText = `Lean: ${away}`;
  }

  return { notes, leanTeam, leanText };
}
