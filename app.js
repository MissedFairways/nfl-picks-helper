import { fetchSchedule, fetchCurrentWeekNumber } from "./js/schedule.js";
import { analyzeMatchup } from "./js/edge.js";
import { fetchLiveOdds, mergeOddsIntoSchedule } from "./js/odds.js";
import { loadSagarin, sagarinForGame } from "./js/sagarin.js";
import { scoreGame } from "./js/system.js";
import { fetchInjuries, loadCachedInjuries, formatGameInjuries, shouldHighlightInjuries } from "./js/injuries.js";

const ODDS_CACHE_KEY = "nflPicksOddsCache";
const LINE_STORE_KEY = "nflPicksLineStore";

let historicalGames = [];
let currentSchedule = [];
let sagarinData = null;
let injurySnapshot = loadCachedInjuries();

const statusMessage = document.getElementById("status-message");
const recordMessage = document.getElementById("record-message");
const weekSelect = document.getElementById("week-select");
const gamesContainer = document.getElementById("games-container");
const loadOddsBtn = document.getElementById("load-odds-btn");
const downloadBtn = document.getElementById("download-snapshot-btn");
const importInput = document.getElementById("import-snapshot-input");

function getLoadInjuriesBtn() {
  let btn = document.getElementById("load-injuries-btn");
  if (!btn) {
    if (!loadOddsBtn || !loadOddsBtn.parentNode) return null;
    btn = document.createElement("button");
    btn.id = "load-injuries-btn";
    btn.type = "button";
    loadOddsBtn.parentNode.insertBefore(btn, loadOddsBtn.nextSibling);
  }
  if (loadOddsBtn) {
    btn.className = loadOddsBtn.className;
    const cs = window.getComputedStyle(loadOddsBtn);
    ["margin","padding","height","lineHeight","display","verticalAlign","background","backgroundColor","color","border","borderRadius","font","fontSize","fontWeight","letterSpacing","textTransform","boxShadow","cursor"].forEach(function(prop) {
      btn.style[prop] = cs[prop];
    });
    btn.style.position = "relative";
    btn.style.top = "0";
  }
  if (!btn.textContent) btn.textContent = "Load injuries";
  return btn;
}

function saveOddsCache(oddsGames) {
  localStorage.setItem(ODDS_CACHE_KEY, JSON.stringify({
    savedAt: new Date().toISOString(),
    oddsGames
  }));
}

function loadOddsCache() {
  try {
    const raw = localStorage.getItem(ODDS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function loadLineStore() {
  try {
    return JSON.parse(localStorage.getItem(LINE_STORE_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function saveLineStore(store) {
  localStorage.setItem(LINE_STORE_KEY, JSON.stringify(store));
}

function gameKey(game) {
  return game.season + "_" + game.week + "_" + game.away_team + "_" + game.home_team;
}


const PICK_ABBR = {
  "Arizona Cardinals":"ARI","Atlanta Falcons":"ATL","Baltimore Ravens":"BAL","Buffalo Bills":"BUF",
  "Carolina Panthers":"CAR","Chicago Bears":"CHI","Cincinnati Bengals":"CIN","Cleveland Browns":"CLE",
  "Dallas Cowboys":"DAL","Denver Broncos":"DEN","Detroit Lions":"DET","Green Bay Packers":"GB",
  "Houston Texans":"HOU","Indianapolis Colts":"IND","Jacksonville Jaguars":"JAX","Kansas City Chiefs":"KC",
  "Las Vegas Raiders":"LV","Los Angeles Chargers":"LAC","Los Angeles Rams":"LAR","Miami Dolphins":"MIA",
  "Minnesota Vikings":"MIN","New England Patriots":"NE","New Orleans Saints":"NO","New York Giants":"NYG",
  "New York Jets":"NYJ","Philadelphia Eagles":"PHI","Pittsburgh Steelers":"PIT","San Francisco 49ers":"SF",
  "Seattle Seahawks":"SEA","Tampa Bay Buccaneers":"TB","Tennessee Titans":"TEN","Washington Commanders":"WSH",
  ARI:"ARI",ATL:"ATL",BAL:"BAL",BUF:"BUF",CAR:"CAR",CHI:"CHI",CIN:"CIN",CLE:"CLE",DAL:"DAL",DEN:"DEN",
  DET:"DET",GB:"GB",HOU:"HOU",IND:"IND",JAX:"JAX",KC:"KC",LV:"LV",LAC:"LAC",LAR:"LAR",MIA:"MIA",
  MIN:"MIN",NE:"NE",NO:"NO",NYG:"NYG",NYJ:"NYJ",PHI:"PHI",PIT:"PIT",SF:"SF",SEA:"SEA",TB:"TB",TEN:"TEN",
  WAS:"WSH",WSH:"WSH"
};

function teamAbbr(name) {
  if (!name) return "";
  return PICK_ABBR[name] || PICK_ABBR[String(name).toUpperCase()] || name;
}

function pickTeamName(game) {
  if (game.pick === "home") return game.home_team;
  if (game.pick === "away") return game.away_team;
  return null;
}

function rememberGames(games) {
  const store = loadLineStore();
  games.forEach(game => {
    const key = gameKey(game);
    const prev = store[key] || {};
    store[key] = {
      season: game.season ?? prev.season ?? null,
      week: game.week ?? prev.week ?? null,
      away_team: game.away_team,
      home_team: game.home_team,
      spread_open: typeof game.spread_open === "number" ? game.spread_open : (prev.spread_open ?? null),
      spread_close: typeof game.spread_close === "number" ? game.spread_close : (prev.spread_close ?? null),
      total_close: typeof game.total_close === "number" ? game.total_close : (prev.total_close ?? null),
      favorite: game.favorite || prev.favorite || null,
      bookmaker: game.bookmaker || prev.bookmaker || null,
      away_score: game.away_score ?? prev.away_score ?? null,
      home_score: game.home_score ?? prev.home_score ?? null,
      is_final: game.is_final ?? prev.is_final ?? false,
      pick: game.pick || prev.pick || null,
      target_win: game.pick ? (typeof game.target_win === "number" ? game.target_win : (prev.target_win ?? null)) : null,
      stake: game.pick ? (typeof game.stake === "number" ? game.stake : (prev.stake ?? null)) : null,
      savedAt: new Date().toISOString()
    };
  });
  saveLineStore(store);
}

function applySavedGames(games) {
  const store = loadLineStore();
  return games.map(game => {
    const saved = store[gameKey(game)];
    if (!saved) return game;
    return {
      ...game,
      spread_open: typeof game.spread_open === "number" ? game.spread_open : saved.spread_open,
      spread_close: typeof game.spread_close === "number" ? game.spread_close : saved.spread_close,
      total_close: typeof game.total_close === "number" ? game.total_close : saved.total_close,
      favorite: game.favorite || saved.favorite,
      bookmaker: game.bookmaker || saved.bookmaker,
      pick: saved.pick || null,
      target_win: saved.target_win ?? game.target_win ?? null,
      stake: saved.stake ?? game.stake ?? null,
      away_score: game.away_score ?? saved.away_score,
      home_score: game.home_score ?? saved.home_score
    };
  });
}

function applySnapshotList(games, snapshotGames, field) {
  return games.map(game => {
    const match = (snapshotGames || []).find(s => s.away_team === game.away_team && s.home_team === game.home_team);
    if (!match || typeof match.spread_close !== "number") return game;
    if (field === "open") return { ...game, spread_open: game.spread_open ?? match.spread_close };
    return {
      ...game,
      spread_close: typeof game.spread_close === "number" ? game.spread_close : match.spread_close,
      total_close: typeof game.total_close === "number" ? game.total_close : match.total_close,
      favorite: game.favorite || match.favorite,
      bookmaker: game.bookmaker || match.bookmaker
    };
  });
}

async function loadRepoSnapshot(season, week) {
  try {
    const res = await fetch("data/snapshots/" + season + "_week_" + week + ".json");
    if (!res.ok) return { open: [], late: [] };
    const data = await res.json();
    if (Array.isArray(data.games)) return { open: data.games, late: data.games };
    return { open: data.open?.games || [], late: data.late?.games || [] };
  } catch (error) {
    return { open: [], late: [] };
  }
}

function movementText(game) {
  if (typeof game.spread_open !== "number" || typeof game.spread_close !== "number") {
    return "Need Tuesday + Saturday lines to show movement";
  }
  if (game.spread_open === game.spread_close) {
    return "Open " + game.spread_open + " → current " + game.spread_close + " • no move";
  }
  const team = game.spread_close < game.spread_open ? game.home_team : game.away_team;
  return "Open " + game.spread_open + " → current " + game.spread_close + " • moved toward " + team;
}

function getCoverSide(game) {
  if (!game.is_final || game.home_score == null || game.away_score == null) return null;
  if (typeof game.spread_close !== "number") return null;
  const homeMargin = game.home_score + game.spread_close;
  if (homeMargin === game.away_score) return "push";
  return homeMargin > game.away_score ? "home" : "away";
}

function getCoverResult(game) {
  if (!game.is_final || game.home_score == null || game.away_score == null) return "";
  const scoreLine = game.away_team + " " + game.away_score + ", " + game.home_team + " " + game.home_score;
  const cover = getCoverSide(game);
  if (cover === "push") return scoreLine + " • Push";
  if (cover === "home") return scoreLine + " • " + game.home_team + " covered";
  if (cover === "away") return scoreLine + " • " + game.away_team + " covered";
  return scoreLine;
}

function getPickResult(game) {
  const cover = getCoverSide(game);
  if (!game.pick || !cover) return "";
  if (cover === "push") return "Push";
  return game.pick === cover ? "Win" : "Loss";
}

function juiceStake(targetWin) {
  if (typeof targetWin !== "number" || !(targetWin > 0)) return null;
  return Math.round(targetWin * 1.1 * 100) / 100;
}

function money(n) {
  const v = Number(n) || 0;
  return (v < 0 ? "-$" : "$") + Math.abs(v).toFixed(2);
}

function settledResult(game) {
  const cover = getCoverSide(game);
  if (!game.pick || !cover) return null;
  if (cover === "push") return "push";
  return game.pick === cover ? "win" : "loss";
}

function tallyMoney(games) {
  let risked = 0, toCollect = 0, collected = 0, settledRisk = 0, openRisk = 0;
  (games || []).forEach(game => {
    if (!game.pick || typeof game.stake !== "number") return;
    const result = settledResult(game);
    if (!result) {
      openRisk += game.stake;
      risked += game.stake;
      toCollect += (game.stake + (game.target_win || 0));
      return;
    }
    settledRisk += game.stake;
    risked += game.stake;
    if (result === "win") collected += game.stake + (game.target_win || 0);
    else if (result === "push") collected += game.stake;
  });
  return {
    risked,
    openRisk,
    settledRisk,
    toCollect,
    collected,
    net: collected - settledRisk
  };
}

function updateRecord() {
  const store = loadLineStore();
  const all = Object.values(store);
  let wins = 0, losses = 0, pushes = 0;
  all.forEach(game => {
    const result = settledResult(game);
    if (result === "push") pushes += 1;
    else if (result === "win") wins += 1;
    else if (result === "loss") losses += 1;
  });
  const bank = tallyMoney(all);
  recordMessage.textContent = "Your ATS record: " + wins + "-" + losses + "-" + pushes +
    " • Net " + money(bank.net) + " (risked " + money(bank.risked) + ", collected " + money(bank.collected) + ")";
}

function setPick(game, side) {
  game.pick = game.pick === side ? null : side;
  if (!game.pick) {
    game.target_win = null;
    game.stake = null;
  }
  rememberGames([game]);
  renderGames(currentSchedule);
}

function setTargetWin(game, raw) {
  const target = Number(raw);
  if (!game.pick || !Number.isFinite(target) || target <= 0) {
    game.target_win = null;
    game.stake = null;
  } else {
    game.target_win = Math.round(target * 100) / 100;
    game.stake = juiceStake(game.target_win);
  }
  rememberGames([game]);
  renderGames(currentSchedule);
}

function csvEscape(value) {
  return '"' + String(value == null ? "" : value).replaceAll('"', '""') + '"';
}

function downloadSnapshot() {
  const rows = Object.values(loadLineStore());
  if (rows.length === 0) {
    statusMessage.textContent = "Nothing to download yet.";
    statusMessage.style.color = "#fbbf24";
    return;
  }
  const headers = ["season","week","away_team","home_team","spread_open","spread_close","total_close","favorite","bookmaker","away_score","home_score","is_final","pick","target_win","stake"];
  const lines = [headers.join(",")];
  rows.forEach(g => {
    lines.push([g.season,g.week,g.away_team,g.home_team,g.spread_open,g.spread_close,g.total_close,g.favorite,g.bookmaker,g.away_score,g.home_score,g.is_final,g.pick,g.target_win,g.stake].map(csvEscape).join(","));
  });
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "nfl-picks-snapshot.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replaceAll('"', "").trim());
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.replaceAll('"', "").trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
    return row;
  });
}

function importSnapshot(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCsv(String(reader.result));
    const store = loadLineStore();
    rows.forEach(row => {
      if (!row.away_team || !row.home_team) return;
      const game = {
        season: row.season ? Number(row.season) : null,
        week: row.week ? Number(row.week) : null,
        away_team: row.away_team,
        home_team: row.home_team,
        spread_open: row.spread_open === "" ? null : Number(row.spread_open),
        spread_close: row.spread_close === "" ? null : Number(row.spread_close),
        total_close: row.total_close === "" ? null : Number(row.total_close),
        favorite: row.favorite || null,
        bookmaker: row.bookmaker || null,
        away_score: row.away_score === "" ? null : Number(row.away_score),
        home_score: row.home_score === "" ? null : Number(row.home_score),
        is_final: row.is_final === "true",
        pick: row.pick || null,
        target_win: row.target_win === "" || row.target_win == null ? null : Number(row.target_win),
        stake: row.stake === "" || row.stake == null ? null : Number(row.stake)
      };
      store[gameKey(game)] = { ...game, savedAt: new Date().toISOString() };
    });
    saveLineStore(store);
    currentSchedule = applySavedGames(currentSchedule);
    rememberGames(currentSchedule);
    renderGames(currentSchedule);
  };
  reader.readAsText(file);
}

async function loadHistorical() {
  try {
    const response = await fetch("data/historical.json");
    historicalGames = await response.json();
  } catch (error) {
    console.error(error);
  }
}

async function loadRealSchedule(week) {
  statusMessage.textContent = "Loading real NFL schedule...";
  currentSchedule = await fetchSchedule(week);
  if (!currentSchedule.length) {
    statusMessage.textContent = "Could not load schedule";
    statusMessage.style.color = "#f87171";
    return;
  }
  const cache = loadOddsCache();
  if (cache && Array.isArray(cache.oddsGames)) {
    currentSchedule = mergeOddsIntoSchedule(currentSchedule, cache.oddsGames);
  }
  const season = currentSchedule[0].season;
  const weekNum = currentSchedule[0].week;
  const repo = await loadRepoSnapshot(season, weekNum);
  currentSchedule = applySnapshotList(currentSchedule, repo.open, "open");
  currentSchedule = applySnapshotList(currentSchedule, repo.late, "late");
  currentSchedule = applySavedGames(currentSchedule);
  rememberGames(currentSchedule);
  statusMessage.textContent = "Week " + weekNum + " " + season + " loaded";
  statusMessage.style.color = "#4ade80";
  renderGames(currentSchedule);
}

function isThursdayGame(game) {
  const raw = game.date || game.start_date || game.kickoff || game.commence_time || game.start;
  if (!raw) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  return d.getDay() === 4 || d.getUTCDay() === 4;
}

function renderSystemBoard(games) {
  const board = document.createElement("div");
  board.className = "system-board";
  const scored = games
    .filter(g => !g.is_final && !isThursdayGame(g))
    .map(g => ({ game: g, system: scoreGame(g, historicalGames, sagarinData) }))
    .filter(row => row.system.pickTeam && row.system.margin >= 0.30)
    .sort((a, b) => b.system.margin - a.system.margin)
    .slice(0, 5);
  if (!scored.length) {
    board.innerHTML = "<strong>System plays</strong><div>No ranked plays yet. Need Sagarin vs Vegas and/or historical arrows.</div>";
    return board;
  }
  const items = scored.map((row, i) => {
    const g = row.game;
    const s = row.system;
    return "<li>" + (i + 1) + ". " + g.away_team + " @ " + g.home_team + " — " + s.pickTeam + " " + s.margin.toFixed(2) + " (" + s.confidence + ", " + s.units + "u)</li>";
  }).join("");
  board.innerHTML = "<strong>System plays (strongest first)</strong><ol>" + items + "</ol>";
  return board;
}

function renderPicksBoard(games) {
  const board = document.createElement("div");
  board.className = "picks-board";
  const picked = (games || []).filter(g => g.pick === "home" || g.pick === "away");
  const line = picked.length ? picked.map(g => teamAbbr(pickTeamName(g))).join(", ") : "none yet";
  const weekMoney = tallyMoney(picked);
  board.innerHTML =
    '<div class="picks-board-title">Your picks this week</div>' +
    '<div class="picks-board-list">' + line + "</div>" +
    '<div class="picks-board-money">This week risked ' + money(weekMoney.risked) +
    " • if all pending win, collect " + money(weekMoney.toCollect) +
    " • settled net " + money(weekMoney.net) + "</div>";
  board.style.fontSize = "1.35rem";
  board.style.margin = "12px 0 20px";
  return board;
}

function renderGames(games) {
  gamesContainer.innerHTML = "";
  updateRecord();
  gamesContainer.appendChild(renderSystemBoard(games));
  gamesContainer.appendChild(renderPicksBoard(games));
  games.forEach((game, index) => {
    const card = document.createElement("div");
    card.className = "game-card";
    let statusText = "Scheduled";
    if (game.is_final) statusText = "Final";
    else if (game.is_in_progress) statusText = "In Progress";
    const favoriteName = game.favorite || "—";
    const edge = analyzeMatchup(game, historicalGames);
    const sagarin = sagarinForGame(game, sagarinData);
    const system = scoreGame(game, historicalGames, sagarinData);
    const detailsId = "edge-details-" + index;
    const injuryId = "injury-details-" + index;
    const pickResult = getPickResult(game);
    const resultText = getCoverResult(game);
    const injuryText = formatGameInjuries(injurySnapshot, game);
    const injuryLabel = shouldHighlightInjuries(system) ? "Injuries (check)" : "Injuries";
    card.innerHTML =
      '<div class="matchup"><span class="' + (favoriteName === game.away_team ? "favorite" : "") + (game.pick === "away" ? " picked-team" : "") + '" style="color:' + (game.pick === "away" ? "#22c55e" : "#111111") + '">' + game.away_team + '</span> @ <span class="' + (favoriteName === game.home_team ? "favorite" : "") + (game.pick === "home" ? " picked-team" : "") + '" style="color:' + (game.pick === "home" ? "#22c55e" : "#111111") + '">' + game.home_team + '</span></div>' +
      '<div class="lines">' +
      '<div class="line-item">Status: <strong>' + statusText + '</strong></div>' +
      '<div class="line-item">Favorite: <strong>' + favoriteName + '</strong></div>' +
      '<div class="line-item">Open: <strong>' + (typeof game.spread_open === "number" ? game.spread_open : "—") + '</strong></div>' +
      '<div class="line-item">Current: <strong>' + (typeof game.spread_close === "number" ? game.spread_close : "—") + '</strong></div>' +
      '<div class="line-item">Total: <strong>' + (typeof game.total_close === "number" ? game.total_close : "—") + '</strong></div>' +
      '</div>' +
      (resultText ? '<div class="result-line">' + resultText + '</div>' : '') +
      '<div class="pick-row"><button class="pick-btn' + (game.pick === "away" ? " active" : "") + '" data-side="away">Pick ' + game.away_team + '</button><button class="pick-btn' + (game.pick === "home" ? " active" : "") + '" data-side="home">Pick ' + game.home_team + '</button></div>' +
      '<div class="pick-status">' + (game.pick ? ("Your pick: " + (game.pick === "home" ? game.home_team : game.away_team) + (pickResult ? " • " + pickResult : "")) : "No pick yet") + '</div>' +
      (game.pick ? ('<div class="stake-row">To win $ <input class="stake-input" type="number" min="1" step="10" value="' + (typeof game.target_win === "number" ? game.target_win : "") + '"> • Risk ' + (typeof game.stake === "number" ? money(game.stake) : "$0.00") + ' (win pays ' + (typeof game.stake === "number" && typeof game.target_win === "number" ? money(game.stake + game.target_win) : "$0.00") + ')</div>') : '') +
      '<div class="movement">' + movementText(game) + '</div>' +
      '<div class="sagarin-line">' + sagarin.note + '</div>' +
      '<div class="historical-line">Historical insight: ' + (edge.leanTeam ? ("EDGE " + edge.leanTeam) : edge.leanText) + '</div>' +
      '<div class="system-line">' + system.text + (system.flags[0] ? " • " + system.flags[0] : "") + '</div>' +
      '<div class="system-breakdown">' + system.breakdown + '</div>' +
      '<button class="edge-toggle" type="button" data-target="' + detailsId + '">Edge insights</button>' +
      '<div class="edge-details hidden" id="' + detailsId + '"><div class="edge-lean">' + edge.leanText + '</div><ul class="edge-notes">' + edge.notes.map(n => "<li>" + n + "</li>").join("") + '</ul></div>' +
      '<button class="edge-toggle injury-toggle" type="button" data-target="' + injuryId + '" data-closed-label="' + injuryLabel + '">' + injuryLabel + '</button>' +
      '<div class="edge-details hidden" id="' + injuryId + '">' + injuryText + '</div>';
    card.querySelectorAll(".pick-btn").forEach(btn => {
      btn.addEventListener("click", () => setPick(game, btn.dataset.side));
    });
    const stakeInput = card.querySelector(".stake-input");
    if (stakeInput) {
      stakeInput.addEventListener("change", () => setTargetWin(game, stakeInput.value));
      stakeInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          setTargetWin(game, stakeInput.value);
        }
      });
    }
    gamesContainer.appendChild(card);
  });
  document.querySelectorAll(".edge-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.target);
      if (!target) return;
      const isHidden = target.classList.contains("hidden");
      target.classList.toggle("hidden");
      if (button.classList.contains("injury-toggle")) {
        const closed = button.dataset.closedLabel || "Injuries";
        button.textContent = isHidden ? "Hide injuries" : closed;
      } else {
        button.textContent = isHidden ? "Hide insights" : "Edge insights";
      }
    });
  });
}

async function loadOdds() {
  loadOddsBtn.disabled = true;
  try {
    const oddsGames = await fetchLiveOdds();
    saveOddsCache(oddsGames);
    currentSchedule = mergeOddsIntoSchedule(currentSchedule, oddsGames);
    currentSchedule = applySavedGames(currentSchedule);
    rememberGames(currentSchedule);
    renderGames(currentSchedule);
    statusMessage.textContent = "Live odds loaded";
    statusMessage.style.color = "#4ade80";
  } catch (error) {
    statusMessage.textContent = error.message;
    statusMessage.style.color = "#f87171";
  } finally {
    loadOddsBtn.disabled = false;
    loadOddsBtn.textContent = "Load live odds";
  }
}

async function loadInjuries() {
  const btn = getLoadInjuriesBtn();
  if (btn) btn.disabled = true;
  try {
    injurySnapshot = await fetchInjuries();
    renderGames(currentSchedule);
    statusMessage.textContent = "Injuries loaded from ESPN";
    statusMessage.style.color = "#4ade80";
  } catch (error) {
    statusMessage.textContent = error.message || "Could not load injuries";
    statusMessage.style.color = "#f87171";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Load injuries";
    }
  }
}

function buildWeekDropdown() {
  weekSelect.innerHTML = "";
  for (let w = 1; w <= 18; w++) {
    const option = document.createElement("option");
    option.value = w;
    option.textContent = "Week " + w;
    weekSelect.appendChild(option);
  }
  weekSelect.addEventListener("change", () => loadRealSchedule(parseInt(weekSelect.value, 10)));
}

async function startApp() {
  buildWeekDropdown();
  loadOddsBtn.addEventListener("click", loadOdds);
  const injuriesBtn = getLoadInjuriesBtn();
  if (injuriesBtn) injuriesBtn.addEventListener("click", loadInjuries);
  downloadBtn.addEventListener("click", downloadSnapshot);
  importInput.addEventListener("change", () => {
    if (importInput.files[0]) importSnapshot(importInput.files[0]);
  });
  await loadHistorical();
  try {
    sagarinData = await loadSagarin();
  } catch (error) {
    sagarinData = null;
  }
  const currentWeek = await fetchCurrentWeekNumber();
  weekSelect.value = String(currentWeek);
  await loadRealSchedule(currentWeek);
}

startApp();

