import json
import os
import urllib.request
from pathlib import Path

TEAM_ABBR = {
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
    "Washington Commanders": "WSH",
}

PREFERRED_BOOKS = ["draftkings", "fanduel", "betmgm", "fanatics"]


def get_json(url):
    with urllib.request.urlopen(url) as res:
        return json.loads(res.read().decode("utf-8"))


def abbr(name):
    return TEAM_ABBR.get(name, name)


def pick_book(bookmakers):
    if not bookmakers:
        return None
    for key in PREFERRED_BOOKS:
        for book in bookmakers:
            if book.get("key") == key:
                return book
    return bookmakers[0]


def normalize_odds(data):
    games = []
    for game in data:
        book = pick_book(game.get("bookmakers") or [])
        markets = book.get("markets") if book else []
        spread_market = next((m for m in markets if m.get("key") == "spreads"), None)
        total_market = next((m for m in markets if m.get("key") == "totals"), None)

        home_name = game.get("home_team")
        away_name = game.get("away_team")
        home_spread = None
        total = None

        if spread_market:
            home_spread_row = next((o for o in spread_market.get("outcomes", []) if o.get("name") == home_name), None)
            if home_spread_row and home_spread_row.get("point") is not None:
                home_spread = float(home_spread_row["point"])

        if total_market:
            over_row = next((o for o in total_market.get("outcomes", []) if o.get("name") == "Over"), None)
            if over_row and over_row.get("point") is not None:
                total = float(over_row["point"])

        favorite = "Pick'em"
        if home_spread is not None:
            if home_spread < 0:
                favorite = abbr(home_name)
            elif home_spread > 0:
                favorite = abbr(away_name)

        games.append({
            "away_team": abbr(away_name),
            "home_team": abbr(home_name),
            "spread_close": home_spread,
            "total_close": total,
            "favorite": favorite,
            "bookmaker": book.get("title") if book else None,
        })
    return games


def current_week_from_espn():
    data = get_json("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2")
    events = data.get("events") or []
    if not events:
        return None, None
    season = data.get("leagues", [{}])[0].get("season", {}).get("year")
    week = events[0].get("week", {}).get("number")
    return season, week


def main():
    api_key = os.environ.get("ODDS_API_KEY")
    if not api_key:
        raise SystemExit("Missing ODDS_API_KEY secret")

    season, week = current_week_from_espn()
    if not season or not week:
        raise SystemExit("Could not determine current NFL week")

    odds_url = (
        "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/"
        f"?regions=us&markets=spreads,totals&oddsFormat=american&apiKey={api_key}"
    )
    odds_games = normalize_odds(get_json(odds_url))

    snapshot = {
        "season": season,
        "week": week,
        "saved_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "games": odds_games,
    }

    folder = Path("data/snapshots")
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{season}_week_{week}.json"
    path.write_text(json.dumps(snapshot, indent=2))

    index_path = folder / "index.json"
    index = []
    if index_path.exists():
        index = json.loads(index_path.read_text())
    name = f"{season}_week_{week}"
    if name not in index:
        index.append(name)
        index.sort()
    index_path.write_text(json.dumps(index, indent=2))

    print(f"Saved {path} with {len(odds_games)} games")


if __name__ == "__main__":
    main()
