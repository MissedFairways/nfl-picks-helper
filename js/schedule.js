const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

export async function fetchSchedule(week = null) {
  const params = new URLSearchParams({
    seasontype: "2"
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
    return [];
  }
}

export async function fetchCurrentWeekNumber() {
  const games = await fetchSchedule(null);
  return games[0]?.week ?? 1;
}

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
      game_id: event.id,
      season: season,
      week: event.week?.number ?? null,
      date: event.date,
      away_team: away.team.abbreviation,
      home_team: home.team.abbreviation,
      away_name: away.team.displayName,
      home_name: home.team.displayName,
      away_score: isFinal || isInProgress ? Number(away.score) : null,
      home_score: isFinal || isInProgress ? Number(home.score) : null,
      status: status,
      is_final: isFinal,
      is_in_progress: isInProgress,
      is_scheduled: status === "STATUS_SCHEDULED",
      short_name: event.shortName,
      name: event.name
    };
  }).filter(Boolean);
}
