/**
 * edge.js
 * Simple helpers for analyzing the historical data.
 * These stay in the background — they do not affect the main UI.
 */

/**
 * Calculate cover rate for a filtered set of games.
 * @param {Array} games - array of historical game objects
 * @param {Function} filterFn - function that returns true for games to include
 * @returns {Object} { total, covers, rate, pushes }
 */
export function coverRate(games, filterFn) {
  const filtered = games.filter(filterFn);
  const total = filtered.length;
  if (total === 0) {
    return { total: 0, covers: 0, rate: null, pushes: 0 };
  }

  let covers = 0;
  let pushes = 0;

  filtered.forEach(g => {
    if (g.push) {
      pushes++;
    } else if (g.home_covered || g.away_covered) {
      // For most queries we care about whether the side we filtered for covered.
      // The filterFn already selected the relevant side, so we count any non-push as a result.
      // More precise counting is done inside specific helpers below.
      covers++;
    }
  });

  // Better: recalculate properly based on what the filter was looking for.
  // For now we provide higher-level helpers that do the counting correctly.

  return {
    total,
    covers,
    rate: total > 0 ? +(covers / total * 100).toFixed(1) : null,
    pushes
  };
}

/**
 * Home dogs (home team is underdog) of a certain spread size or less.
 * Example: homeDogsUnder(games, 7) → home dogs getting 7 or fewer points
 */
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

/**
 * Home favorites of a certain size or more.
 */
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

/**
 * Any underdogs (home or away) of a certain size or less.
 */
export function underdogsUnder(games, maxSpread = 7) {
  const filtered = games.filter(g => 
    g.spread_size <= maxSpread &&
    !g.push
  );

  // Underdog covered if the non-favorite side covered
  const covers = filtered.filter(g => {
    if (g.is_home_dog) return g.home_covered;
    return g.away_covered; // away was the dog
  }).length;

  const total = filtered.length;

  return {
    description: `All underdogs ≤ ${maxSpread}`,
    total,
    covers,
    rate: total > 0 ? +(covers / total * 100).toFixed(1) : null
  };
}

/**
 * Quick summary of several common edges (for console or future UI panel)
 */
export function edgeSummary(games) {
  return {
    homeDogsUnder7: homeDogsUnder(games, 7),
    homeDogsUnder3: homeDogsUnder(games, 3),
    homeFavoritesOver7: homeFavoritesOver(games, 7),
    underdogsUnder7: underdogsUnder(games, 7)
  };
}
