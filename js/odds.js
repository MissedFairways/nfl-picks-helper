/**
 * odds.js
 * Live odds from The Odds API.
 * Does not fetch anything until called on purpose.
 */

const ODDS_API_KEY = "6e1bbc6d8091b3e0db2cd52bff537d33";

const ODDS_URL =
  "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?regions=us&markets=spreads,totals&oddsFormat=american";

const TEAM_ABBR = {
  "Arizona Cardinals": "ARI",
  "Atlanta Falcons": "ATL",
  "Baltimore Ravens": "BAL",
  "Buffalo Bills": "BUF",
  "Carolina Panthers": "CAR",
  "Chicago Bears": "CHI",
  "Cincinnati Bengals": "CIN",
  "Cleveland Browns": "CLE",
  "Dallas Cowboys": "DAL",
  "Denver Broncos": "DEN",
  "Detroit Lions": "DET",
  "Green Bay Packers": "GB",
  "Houston Texans": "HOU",
  "Indianapolis Colts": "IND",
  "Jacksonville Jaguars": "JAX",
  "Kansas City Chiefs": "KC",
  "Las Vegas Raiders": "LV",
  "Los Angeles Chargers": "LAC",
  "Los Angeles Rams": "LAR",
  "Miami Dolphins": "MIA",
  "Minnesota Vikings": "MIN",
  "New England Patriots": "NE",
  "New Orleans Saints": "NO",
  "New York Giants": "NYG",
  "New York Jets": "NYJ",
  "Philadelphia Eagles": "PHI",
  "Pittsburgh Steelers": "PIT",
  "San Francisco 49ers": "SF",
  "Seattle Seahawks": "SEA",
  "Tampa Bay Buccaneers": "TB",
  "Tennessee Titans": "TEN",
  "Washington Commanders": "WSH"
};

export async function fetchLiveOdds() {
  if (!ODDS_API_KEY || ODDS_API_KEY === "PASTE_YOUR_ODDS_API_KEY_HERE") {
    throw new Error("Add your The Odds API key in js/odds.js first");
  }

  const url = `${ODDS_URL}&apiKey=${encodeURIComponent(ODDS_API_KEY)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Odds API request failed: ${res.status}`);
  }

  const data = await res.json();
  return normalizeOdds(data);
}

function normalizeOdds(data) {
  if (!Array.isArray(data)) return [];

  return data.map(game => {
    const homeAbbr = TEAM_ABBR[game.home_team] || game.home_team;
    const awayAbbr = TEAM_ABBR[game.away_team] || game.away_team;

    const book = pickBookmaker(game.bookmakers);
    const spreadMarket = book?.markets?.find(m => m.key === "spreads");
    const totalMarket = book?.markets?.find(m => m.key === "totals");

    const homeSpread = spreadMarket?.outcomes?.find(o => o.name === game.home_team);
    const totalOver = totalMarket?.outcomes?.find(o => o.name === "Over");

    const spread = typeof homeSpread?.point === "number" ? homeSpread.point : null;
    const total = typeof totalOver?.point === "number" ? totalOver.point : null;

    let favorite = "Pick'em";
    if (typeof spread === "number") {
      if (spread < 0) favorite = homeAbbr;
      else if (spread > 0) favorite = awayAbbr;
    }

    return {
      away_team: awayAbbr,
      home_team: homeAbbr,
      spread_close: spread,
      total_close: total,
      favorite,
      bookmaker: book?.title || null
    };
  });
}

function pickBookmaker(bookmakers) {
  if (!Array.isArray(bookmakers) || bookmakers.length === 0) return null;
  const preferred = ["draftkings", "fanduel", "betmgm", "fanatics"];
  return (
    preferred
      .map(key => bookmakers.find(b => b.key === key))
      .find(Boolean) || bookmakers[0]
  );
}

export function mergeOddsIntoSchedule(scheduleGames, oddsGames) {
  return scheduleGames.map(game => {
    const match = oddsGames.find(o =>
      o.home_team === game.home_team &&
      o.away_team === game.away_team
    );

    if (!match) return game;

    return {
      ...game,
      spread_close: match.spread_close,
      total_close: match.total_close,
      favorite: match.favorite,
      bookmaker: match.bookmaker
    };
  });
}
