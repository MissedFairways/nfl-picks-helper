import csv
import gzip
import io
import json
import urllib.request
from pathlib import Path

URL = "https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv.gz"
TEAM = {"LA": "LAR", "WAS": "WSH"}
SEASONS = {str(year) for year in range(2015, 2026)}


def norm(team):
    return TEAM.get(team, team)


def main():
    raw = urllib.request.urlopen(URL).read()
    text = gzip.decompress(raw).decode("utf-8")
    rows = csv.DictReader(io.StringIO(text))
    out = []

    for r in rows:
        if r["season"] not in SEASONS:
            continue
        if r["game_type"] != "REG":
            continue
        if r["home_score"] == "" or r["away_score"] == "" or r["spread_line"] == "":
            continue

        home_score = int(float(r["home_score"]))
        away_score = int(float(r["away_score"]))
        # nflverse: positive spread_line means home team is favorite
        spread_close = -float(r["spread_line"])
        total_close = float(r["total_line"]) if r["total_line"] else None
        home = norm(r["home_team"])
        away = norm(r["away_team"])
        spread_size = abs(spread_close)
        is_home_favorite = spread_close < 0
        is_home_dog = spread_close > 0

        if spread_close < 0:
            favorite, underdog = home, away
        elif spread_close > 0:
            favorite, underdog = away, home
        else:
            favorite, underdog = "Pick'em", "Pick'em"

        home_adj = home_score + spread_close
        if home_adj == away_score:
            result_ats, home_covered, away_covered, push = "push", False, False, True
        elif home_adj > away_score:
            home_covered, away_covered, push = True, False, False
            result_ats = "favorite" if is_home_favorite else "underdog"
        else:
            home_covered, away_covered, push = False, True, False
            result_ats = "underdog" if is_home_favorite else "favorite"

        if total_close is None:
            result_ou = None
        elif home_score + away_score == total_close:
            result_ou = "push"
        elif home_score + away_score > total_close:
            result_ou = "over"
        else:
            result_ou = "under"

        out.append({
            "season": int(r["season"]),
            "week": int(r["week"]),
            "game_id": f"{r['season']}_{int(r['week']):02d}_{away}_{home}",
            "date": r["gameday"],
            "away_team": away,
            "home_team": home,
            "away_score": away_score,
            "home_score": home_score,
            "spread_close": spread_close,
            "total_close": total_close,
            "favorite": favorite,
            "underdog": underdog,
            "spread_size": spread_size,
            "is_home_favorite": is_home_favorite,
            "is_home_dog": is_home_dog,
            "result_ats": result_ats,
            "result_ou": result_ou,
            "home_covered": home_covered,
            "away_covered": away_covered,
            "push": push
        })

    path = Path("data/historical.json")
    path.write_text(json.dumps(out, indent=2))
    print(f"Wrote {len(out)} games to {path}")


if __name__ == "__main__":
    main()
