/* js/injuries.js
   ESPN league injury report. Load on click. Cache in localStorage.
   Saturday-evening filter: line-moving statuses and positions only.
*/

const INJURIES_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries";
const INJ_CACHE_KEY = "nflPicksInjuriesCache";

const MUST_SHOW_STATUS = new Set([
  "out",
  "doubtful",
  "injured reserve",
  "ir",
  "out for season",
  "injured reserve - designated for return"
]);

const LINE_POS = new Set([
  "QB",
  "RB",
  "FB",
  "WR",
  "TE",
  "T",
  "OT",
  "LT",
  "RT"
]);

const POS_RANK = {
  QB: 1,
  RB: 2,
  WR: 3,
  TE: 4,
  T: 5,
  OT: 5,
  LT: 5,
  RT: 5,
  FB: 6
};

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

const ALIAS_TO_ABBR = {
  ARI: "ARI", ARZ: "ARI",
  ATL: "ATL",
  BAL: "BAL",
  BUF: "BUF",
  CAR: "CAR",
  CHI: "CHI",
  CIN: "CIN",
  CLE: "CLE",
  DAL: "DAL",
  DEN: "DEN",
  DET: "DET",
  GB: "GB", GNB: "GB",
  HOU: "HOU",
  IND: "IND",
  JAX: "JAX", JAC: "JAX",
  KC: "KC", KAN: "KC",
  LV: "LV", LAS: "LV", OAK: "LV",
  LAC: "LAC",
  LAR: "LAR", LA: "LAR", STL: "LAR",
  MIA: "MIA",
  MIN: "MIN",
  NE: "NE", NWE: "NE",
  NO: "NO", NOR: "NO",
  NYG: "NYG",
  NYJ: "NYJ",
  PHI: "PHI",
  PIT: "PIT",
  SF: "SF", SFO: "SF",
  SEA: "SEA",
  TB: "TB", TAM: "TB",
  TEN: "TEN",
  WAS: "WAS", WSH: "WAS", WFT: "WAS"
};

export function normalizeAbbr(value) {
  if (!value) return "";
  const raw = String(value).trim().toUpperCase();
  if (ALIAS_TO_ABBR[raw]) return ALIAS_TO_ABBR[raw];
  const fromName = NAME_TO_ABBR[String(value).trim().toLowerCase()];
  return fromName || raw;
}

export function loadCachedInjuries() {
  try {
    const raw = localStorage.getItem(INJ_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

export async function fetchInjuries() {
  const res = await fetch(INJURIES_URL);
  if (!res.ok) throw new Error("ESPN injuries request failed: " + res.status);
  const json = await res.json();
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    season: json.season || null,
    byAbbr: parseEspnInjuries(json)
  };
  localStorage.setItem(INJ_CACHE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

function parseEspnInjuries(json) {
  const byAbbr = {};
  const teams = json.injuries || [];
  teams.forEach(team => {
    const rows = (team.injuries || []).map(inj => {
      const athlete = inj.athlete || {};
      const teamInfo = athlete.team || {};
      return {
        name: athlete.displayName || athlete.shortName || "Unknown",
        pos: (athlete.position && athlete.position.abbreviation) || "",
        status: String(inj.status || "").trim(),
        statusKey: String(inj.status || "").trim().toLowerCase(),
        comment: inj.shortComment || "",
        date: inj.date || "",
        abbr: normalizeAbbr(teamInfo.abbreviation || "")
      };
    });
    let abbr = "";
    const withAbbr = rows.find(r => r.abbr);
    if (withAbbr) abbr = withAbbr.abbr;
    if (!abbr) abbr = normalizeAbbr(team.displayName || team.id || "");
    if (!abbr) return;
    byAbbr[abbr] = rows.map(r => ({ ...r, abbr }));
  });
  return byAbbr;
}

export function isMajorInjury(row) {
  if (!row) return false;
  const pos = String(row.pos || "").toUpperCase();
  if (!LINE_POS.has(pos)) return false;
  if (MUST_SHOW_STATUS.has(row.statusKey)) return true;
  if (row.statusKey === "questionable") return true;
  return false;
}

function sortMajor(a, b) {
  const statusRank = (row) => {
    if (row.statusKey === "out" || row.statusKey === "out for season") return 1;
    if (row.statusKey === "doubtful") return 2;
    if (row.statusKey.indexOf("ir") !== -1 || row.statusKey.indexOf("injured reserve") !== -1) return 3;
    if (row.statusKey === "questionable") return 4;
    return 5;
  };
  const s = statusRank(a) - statusRank(b);
  if (s !== 0) return s;
  return (POS_RANK[a.pos] || 9) - (POS_RANK[b.pos] || 9);
}

export function majorInjuriesForTeam(snapshot, teamNameOrAbbr) {
  if (!snapshot || !snapshot.byAbbr) return [];
  const abbr = normalizeAbbr(teamNameOrAbbr);
  const rows = snapshot.byAbbr[abbr] || [];
  return rows.filter(isMajorInjury).sort(sortMajor).slice(0, 4);
}

export function formatTeamInjuries(snapshot, teamNameOrAbbr) {
  const rows = majorInjuriesForTeam(snapshot, teamNameOrAbbr);
  if (!rows.length) return "none that should move the line";
  return rows.map(r => r.name + " " + (r.pos || "?") + " " + r.status).join("; ");
}

export function formatGameInjuries(snapshot, game) {
  if (!snapshot) return "Injuries not loaded. Click Load injuries.";
  const away = formatTeamInjuries(snapshot, game.away_team);
  const home = formatTeamInjuries(snapshot, game.home_team);
  const when = snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleString() : "";
  return (game.away_team + ": " + away + " | " + game.home_team + ": " + home) + (when ? " • " + when : "");
}

export function shouldHighlightInjuries(system) {
  const flags = (system && system.flags) ? system.flags.join(" ").toLowerCase() : "";
  const text = ((system && system.text) || "").toLowerCase();
  return flags.includes("injur") || flags.includes("news") || text.includes("check injuries");
}
