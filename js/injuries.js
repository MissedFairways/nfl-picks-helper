/* js/injuries.js
   ESPN league injury report. Load on click. Cache in localStorage.
*/

const INJURIES_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries";
const INJ_CACHE_KEY = "nflHelper_injuries_v1";

const MAJOR_STATUS = new Set(["out", "doubtful", "injured reserve", "ir", "out for season"]);
const SKILL_POS = new Set(["QB", "RB", "FB", "WR", "TE", "C", "G", "T", "OT", "OG", "OL", "LT", "RT", "LG", "RG"]);

export function loadCachedInjuries() {
  try {
    const raw = localStorage.getItem(INJ_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function fetchInjuries() {
  const res = await fetch(INJURIES_URL);
  if (!res.ok) throw new Error("ESPN injuries request failed: " + res.status);
  const json = await res.json();
  const parsed = parseEspnInjuries(json);
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    byAbbr: parsed
  };
  localStorage.setItem(INJ_CACHE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

function parseEspnInjuries(json) {
  const byAbbr = {};
  const teams = json.injuries || [];
  for (const team of teams) {
    const rows = [];
    for (const inj of team.injuries || []) {
      const athlete = inj.athlete || {};
      const pos = (athlete.position && athlete.position.abbreviation) || "";
      const status = String(inj.status || "").trim();
      const statusKey = status.toLowerCase();
      const name = athlete.displayName || athlete.shortName || "Unknown";
      const comment = inj.shortComment || inj.longComment || "";
      rows.push({
        name,
        pos,
        status,
        statusKey,
        comment,
        date: inj.date || ""
      });
    }
    const abbr = guessAbbr(team, rows);
    if (!abbr) continue;
    byAbbr[abbr] = rows;
  }
  return byAbbr;
}

function guessAbbr(team, rows) {
  const fromPlayer = rows.find((r) => false);
  // ESPN team block usually has displayName only; athlete.team.abbreviation is on each injury
  const sample = (team.injuries && team.injuries[0] && team.injuries[0].athlete && team.injuries[0].athlete.team) || {};
  if (sample.abbreviation) return String(sample.abbreviation).toUpperCase();
  const name = String(team.displayName || "").toLowerCase();
  return NAME_TO_ABBR[name] || null;
}

const NAME_TO_ABBR = {
  "arizona cardinals": "ARI",
  "atlanta falcons": "ATL",
  "baltimore ravens": "BAL",
  "buffalo bills": "BUF",
  "carolina panthers": "CAR",
  "chicago bears": "CHI",
  "cincinnati bengals": "CIN",
  "cleveland browns": "CLE",
  "dallas cowboys": "DAL",
  "denver broncos": "DEN",
  "detroit lions": "DET",
  "green bay packers": "GB",
  "houston texans": "HOU",
  "indianapolis colts": "IND",
  "jacksonville jaguars": "JAX",
  "kansas city chiefs": "KC",
  "las vegas raiders": "LV",
  "los angeles chargers": "LAC",
  "los angeles rams": "LAR",
  "miami dolphins": "MIA",
  "minnesota vikings": "MIN",
  "new england patriots": "NE",
  "new orleans saints": "NO",
  "new york giants": "NYG",
  "new york jets": "NYJ",
  "philadelphia eagles": "PHI",
  "pittsburgh steelers": "PIT",
  "san francisco 49ers": "SF",
  "seattle seahawks": "SEA",
  "tampa bay buccaneers": "TB",
  "tennessee titans": "TEN",
  "washington commanders": "WAS"
};

export function majorInjuriesForTeam(snapshot, abbr) {
  if (!snapshot || !snapshot.byAbbr || !abbr) return [];
  const rows = snapshot.byAbbr[String(abbr).toUpperCase()] || [];
  return rows.filter((r) => {
    if (MAJOR_STATUS.has(r.statusKey)) return true;
    if (r.statusKey === "questionable" && SKILL_POS.has(r.pos)) return true;
    return false;
  });
}

export function formatInjuryLine(rows) {
  if (!rows || !rows.length) return "No major listed injuries";
  return rows
    .slice(0, 8)
    .map((r) => `${r.name} (${r.pos || "?"}) ${r.status}`)
    .join(" · ");
}
