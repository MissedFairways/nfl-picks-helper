/**
 * schedule.js
 * Fetches and normalizes the official NFL regular-season schedule
 * from ESPN's public endpoint (no API key required).
 *
 * Returns a clean array of game objects that can later be merged
 * with live odds.
 */

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

/**
 * Fetch the schedule for a specific regular-season week.
 * @param {number} week - NFL week number (1–18). Omit or pass null for current week.
 * @returns {Promise<Array>} Normalized array of game objects
 */
export async function fetchSchedule(week = null) {
  const params = new URLSearchParams({
    seasontype: "2", // 2 = regular season
  });

  if (week !== null && week !== undefined) {
    params.set("week", String(week));
  }

  const url = `${ESPN_SCOREBOARD}?${params.toString()}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`ESPN schedule request failed: ${res.status}`);
    }

    const data = await res.json();
    return normalizeSchedule(data);
  } catch (err) {
    console.error("Failed to load NFL schedule:", err);
    return []; // fail gracefully so the UI doesn't crash
  }
}

/**
 * Turn the raw ESPN response into a simple, consistent shape.
 */
function normalizeSchedule(data) {
  if (!data || !Array.isArray(data.events)) {
    return [];
  }

  const season = data.leagues?.[0]?.season?.year ?? null;

  return data.events.map((event) => {
    const competition = event.competitions?.[0];
    if (!competition) return null;

    const home = competition.competitors?.find((c) => c.homeAway === "home");
    const away = competition.competitors?.find((c) => c.homeAway === "away");

    if (!home || !away) return null;

    const status = event.status?.type?.name ?? "STATUS_SCHEDULED";
    const isFinal = status === "STATUS_FINAL";
    const isInProgress = status === "STATUS_IN_PROGRESS";

    return {
      // Core identifiers
      game_id: event.id,
      season: season,
      week: event.week?.number ?? null,
      date: event.date, // ISO UTC string

      // Teams (abbreviations match Odds API style)
      away_team: away.team.abbreviation,
      home_team: home.team.abbreviation,
      away_name: away.team.displayName,
      home_name: home.team.displayName,

      // Scores (null until available)
      away_score: isFinal || isInProgress ? Number(away.score) : null,
      home_score: isFinal || isInProgress ? Number(home.score) : null,

      // Status helpers
      status: status,
      is_final: isFinal,
      is_in_progress: isInProgress,
      is_scheduled: status === "STATUS_SCHEDULED",

      // Useful display strings
      short_name: event.shortName, // e.g. "DET @ BUF"
      name: event.name,            // e.g. "Detroit Lions at Buffalo Bills"
    };
  }).filter(Boolean); // remove any nulls
}

/**
 * Convenience helper: get the current week’s schedule.
 */
export async function fetchCurrentWeekSchedule() {
  return fetchSchedule(null);
}
