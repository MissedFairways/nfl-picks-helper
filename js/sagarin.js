const NAME_TO_ABBR = {
  ARI: "ARI", ATL: "ATL", BAL: "BAL", BUF: "BUF", CAR: "CAR", CHI: "CHI",
  CIN: "CIN", CLE: "CLE", DAL: "DAL", DEN: "DEN", DET: "DET", GB: "GB",
  HOU: "HOU", IND: "IND", JAX: "JAX", KC: "KC", LAC: "LAC", LAR: "LAR",
  LA: "LAR", LV: "LV", MIA: "MIA", MIN: "MIN", NE: "NE", NO: "NO",
  NYG: "NYG", NYJ: "NYJ", PHI: "PHI", PIT: "PIT", SEA: "SEA", SF: "SF",
  TB: "TB", TEN: "TEN", WSH: "WSH", WAS: "WSH",
  "ARIZONA CARDINALS": "ARI",
  "ATLANTA FALCONS": "ATL",
  "BALTIMORE RAVENS": "BAL",
  "BUFFALO BILLS": "BUF",
  "CAROLINA PANTHERS": "CAR",
  "CHICAGO BEARS": "CHI",
  "CINCINNATI BENGALS": "CIN",
  "CLEVELAND BROWNS": "CLE",
  "DALLAS COWBOYS": "DAL",
  "DENVER BRONCOS": "DEN",
  "DETROIT LIONS": "DET",
  "GREEN BAY PACKERS": "GB",
  "HOUSTON TEXANS": "HOU",
  "INDIANAPOLIS COLTS": "IND",
  "JACKSONVILLE JAGUARS": "JAX",
  "KANSAS CITY CHIEFS": "KC",
  "LOS ANGELES CHARGERS": "LAC",
  "LOS ANGELES RAMS": "LAR",
  "LAS VEGAS RAIDERS": "LV",
  "MIAMI DOLPHINS": "MIA",
  "MINNESOTA VIKINGS": "MIN",
  "NEW ENGLAND PATRIOTS": "NE",
  "NEW ORLEANS SAINTS": "NO",
  "NEW YORK GIANTS": "NYG",
  "NEW YORK JETS": "NYJ",
  "PHILADELPHIA EAGLES": "PHI",
  "PITTSBURGH STEELERS": "PIT",
  "SEATTLE SEAHAWKS": "SEA",
  "SAN FRANCISCO 49ERS": "SF",
  "TAMPA BAY BUCCANEERS": "TB",
  "TENNESSEE TITANS": "TEN",
  "WASHINGTON COMMANDERS": "WSH"
};

export async function loadSagarin() {
  const res = await fetch("data/sagarin.csv");
  if (!res.ok) throw new Error("Could not load data/sagarin.csv");
  return parseSagarinCsv(await res.text());
}

export function parseSagarinCsv(text) {
  const ratings = {};
  let homeAdv = 0;

  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [rawTeam, rawRating] = trimmed.split(",").map(part => part.trim().replaceAll('"', ""));
    if (!rawTeam || rawRating == null) return;
    if (index === 0 && rawTeam.toLowerCase() === "team") return;

    if (rawTeam.toUpperCase() === "HOME_ADV") {
      homeAdv = Number(rawRating) || 0;
      return;
    }

    const team = NAME_TO_ABBR[rawTeam.toUpperCase()] || NAME_TO_ABBR[rawTeam] || rawTeam.toUpperCase();
    const rating = Number(rawRating);
    if (!Number.isNaN(rating)) ratings[team] = rating;
  });

  return { ratings, homeAdv };
}

export function sagarinForGame(game, sagarin) {
  if (!sagarin) {
    return { note: "Sagarin file not loaded" };
  }

  const homeRating = sagarin.ratings[game.home_team];
  const awayRating = sagarin.ratings[game.away_team];

  if (homeRating == null || awayRating == null) {
    return { note: "Missing Sagarin rating for one of these teams" };
  }

  const predictedHomeMargin = homeRating + (sagarin.homeAdv || 0) - awayRating;
  const sagarinHomeSpread = -predictedHomeMargin;
  const vegasHomeSpread = typeof game.spread_close === "number" ? game.spread_close : null;

  let edgeTeam = null;
  let edgePoints = null;
  let note = `Sagarin ${formatHomeSpread(game, sagarinHomeSpread)}`;

  if (vegasHomeSpread != null) {
    const sagarinLikesHomeBy = predictedHomeMargin;
    const vegasLikesHomeBy = -vegasHomeSpread;
    edgePoints = Number((sagarinLikesHomeBy - vegasLikesHomeBy).toFixed(2));

    if (Math.abs(edgePoints) < 0.5) {
      note = `Sagarin ${formatHomeSpread(game, sagarinHomeSpread)} vs Vegas ${formatHomeSpread(game, vegasHomeSpread)} • close to the market`;
    } else if (edgePoints > 0) {
      edgeTeam = game.home_team;
      note = `Sagarin ${formatHomeSpread(game, sagarinHomeSpread)} vs Vegas ${formatHomeSpread(game, vegasHomeSpread)} • edge ${edgeTeam} by ${Math.abs(edgePoints).toFixed(2)}`;
    } else {
      edgeTeam = game.away_team;
      note = `Sagarin ${formatHomeSpread(game, sagarinHomeSpread)} vs Vegas ${formatHomeSpread(game, vegasHomeSpread)} • edge ${edgeTeam} by ${Math.abs(edgePoints).toFixed(2)}`;
    }
  }

  return {
    homeRating,
    awayRating,
    homeAdv: sagarin.homeAdv || 0,
    sagarinHomeSpread: Number(sagarinHomeSpread.toFixed(2)),
    vegasHomeSpread,
    edgeTeam,
    edgePoints,
    note
  };
}

function formatHomeSpread(game, homeSpread) {
  const rounded = Number(homeSpread).toFixed(2);
  if (homeSpread < 0) return `${game.home_team} ${rounded}`;
  if (homeSpread > 0) return `${game.away_team} -${rounded}`;
  return "Pick'em";
}
