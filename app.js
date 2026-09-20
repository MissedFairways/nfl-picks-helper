import { fetchSchedule, fetchCurrentWeekNumber } from "./js/schedule.js";
import { analyzeMatchup } from "./js/edge.js";
import { fetchLiveOdds, mergeOddsIntoSchedule } from "./js/odds.js";

const ODDS_CACHE_KEY = "nflPicksOddsCache";
const LINE_STORE_KEY = "nflPicksLineStore";

let historicalGames = [];
let currentSchedule = [];

const statusMessage = document.getElementById("status-message");
const recordMessage = document.getElementById("record-message");
const weekSelect = document.getElementById("week-select");
const gamesContainer = document.getElementById("games-container");
const loadOddsBtn = document.getElementById("load-odds-btn");
const downloadBtn = document.getElementById("download-snapshot-btn");
const importInput = document.getElementById("import-snapshot-input");

function saveOddsCache(oddsGames) {
  localStorage.setItem(ODDS_CACHE_KEY, JSON.stringify({
    savedAt: new Date().toISOString(),
    oddsGames
  }));
}

function loadOddsCache() {
  try {
    const raw = localStorage.getItem(ODDS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error("Could not read saved odds:", error);
    return null;
  }
}

function loadLineStore() {
  try {
    return JSON.parse(localStorage.getItem(LINE_STORE_KEY) || "{}");
  } catch (error) {
    console.error("Could not read saved lines:", error);
    return {};
  }
}

function saveLineStore(store) {
  localStorage.setItem(LINE_STORE_KEY, JSON.stringify(store));
}

function gameKey(game) {
  return `${game.season}_${game.week}_${game.away_team}_${game.home_team}`;
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
      spread_close: typeof game.spread_close === "number" ? game.spread_close : (prev.spread_close ?? null),
      total_close: typeof game.total_close === "number" ? game.total_close : (prev.total_close ?? null),
      favorite: game.favorite || prev.favorite || null,
      bookmaker: game.bookmaker || prev.bookmaker || null,
      away_score: game.away_score ?? prev.away_score ?? null,
      home_score: game.home_score ?? prev.home_score ?? null,
      is_final: game.is_final ?? prev.is_final ?? false,
      pick: game.pick || prev.pick || null,
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
      spread_close: typeof game.spread_close === "number" ? game.spread_close : saved.spread_close,
      total_close: typeof game.total_close === "number" ? game.total_close : saved.total_close,
      favorite: game.favorite || saved.favorite,
      bookmaker: game.bookmaker || saved.bookmaker,
      pick: saved.pick || null,
      away_score: game.away_score ?? saved.away_score,
      home_score: game.home_score ?? saved.home_score
    };
  });
}

function applyRepoSnapshot(games, snapshotGames) {
  return games.map(game => {
    const match = snapshotGames.find(s =>
      s.away_team === game.away_team && s.home_team === game.home_team
    );
    if (!match) return game;

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
    const res = await fetch(`data/snapshots/${season}_week_${week}.json`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.games) ? data.games : [];
  } catch (error) {
    return [];
  }
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

  const scoreLine = `${game.away_team} ${game.away_score}, ${game.home_team} ${game.home_score}`;
  const cover = getCoverSide(game);

  if (cover === "push") return `${scoreLine} • Push`;
  if (cover === "home") return `${scoreLine} • ${game.home_team} covered`;
  if (cover === "away") return `${scoreLine} • ${game.away_team} covered`;
  return scoreLine;
}

function getPickResult(game) {
  const cover = getCoverSide(game);
  if (!game.pick || !cover) return "";
  if (cover === "push") return "Push";
  return game.pick === cover ? "Win" : "Loss";
}

function updateRecord() {
  const store = loadLineStore();
  let wins = 0;
  let losses = 0;
  let pushes = 0;

  Object.values(store).forEach(game => {
    if (!game.pick || !game.is_final || typeof game.spread_close !== "number") return;
    if (game.home_score == null || game.away_score == null) return;

    const cover = getCoverSide(game);
    if (cover === "push") pushes += 1;
    else if (game.pick === cover) wins += 1;
    else losses += 1;
  });

  recordMessage.textContent = `Your ATS record: ${wins}-${losses}-${pushes}`;
}

function setPick(game, side) {
  game.pick = side;
  rememberGames([game]);
  renderGames(currentSchedule);
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadSnapshot() {
  const store = loadLineStore();
  const rows = Object.values(store);

  if (rows.length === 0) {
    statusMessage.textContent = "Nothing to download yet. Load odds or make a pick first.";
    statusMessage.style.color = "#fbbf24";
    return;
  }

  const headers = [
    "season","week","away_team","home_team","spread_close","total_close",
    "favorite","bookmaker","away_score","home_score","is_final","pick"
  ];

  const lines = [headers.join(",")];

  rows.forEach(g => {
    lines.push([
      csvEscape(g.season),
      csvEscape(g.week),
      csvEscape(g.away_team),
      csvEscape(g.home_team),
      csvEscape(g.spread_close),
      csvEscape(g.total_close),
      csvEscape(g.favorite),
      csvEscape(g.bookmaker),
      csvEscape(g.away_score),
      csvEscape(g.home_score),
      csvEscape(g.is_final),
      csvEscape(g.pick)
    ].join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nfl-picks-snapshot.csv";
  a.click();
  URL.revokeObjectURL(url);

  statusMessage.textContent = "Snapshot downloaded. Keep this file on your phone.";
  statusMessage.style.color = "#4ade80";
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replaceAll('"', "").trim());

  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.replaceAll('"', "").trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function importSnapshot(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = parseCsv(String(reader.result));
      const store = loadLineStore();

      rows.forEach(row => {
        if (!row.away_team || !row.home_team) return;
        const game = {
          season: row.season ? Number(row.season) : null,
          week: row.week ? Number(row.week) : null,
          away_team: row.away_team,
          home_team: row.home_team,
          spread_close: row.spread_close === "" ? null : Number(row.spread_close),
          total_close: row.total_close === "" ? null : Number(row.total_close),
          favorite: row.favorite || null,
          bookmaker: row.bookmaker || null,
          away_score: row.away_score === "" ? null : Number(row.away_score),
          home_score: row.home_score === "" ? null : Number(row.home_score),
          is_final: row.is_final === "true",
          pick: row.pick || null
        };
        store[gameKey(game)] = { ...game, savedAt: new Date().toISOString() };
      });

      saveLineStore(store);
      currentSchedule = applySavedGames(currentSchedule);
      rememberGames(currentSchedule);
      renderGames(currentSchedule);

      statusMessage.textContent = `Imported ${rows.length} saved game(s).`;
      statusMessage.style.color = "#4ade80";
    } catch (error) {
      console.error(error);
      statusMessage.textContent = "Could not import that file.";
      statusMessage.style.color = "#f87171";
    }
  };
  reader.readAsText(file);
}

async function loadHistorical() {
  try {
    const response = await fetch("data/historical.json");
    if (!response.ok) throw new Error("Could not load historical.json");
    historicalGames = await response.json();
  } catch (error) {
    console.error("Historical load failed:", error);
  }
}

async function loadRealSchedule(week = null) {
  statusMessage.textContent = "Loading real NFL schedule...";
  statusMessage.style.color = "#94a3b8";

  currentSchedule = await fetchSchedule(week);

  if (currentSchedule.length === 0) {
    statusMessage.textContent = "Could not load schedule";
    statusMessage.style.color = "#f87171";
    gamesContainer.innerHTML = `<p style="color:#94a3b8">No games found</p>`;
    return;
  }

  const cache = loadOddsCache();
  if (cache && Array.isArray(cache.oddsGames)) {
    currentSchedule = mergeOddsIntoSchedule(currentSchedule, cache.oddsGames);
  }

  const season = currentSchedule[0]?.season;
  const weekNum = currentSchedule[0]?.week;
  const repoGames = await loadRepoSnapshot(season, weekNum);
  currentSchedule = applyRepoSnapshot(currentSchedule, repoGames);
  currentSchedule = applySavedGames(currentSchedule);
  rememberGames(currentSchedule);

  const matched = currentSchedule.filter(g => typeof g.spread_close === "number").length;
  statusMessage.textContent = `Week ${weekNum} ${season} loaded • ${matched} game(s) have a saved line`;
  statusMessage.style.color = "#4ade80";

  renderGames(currentSchedule);
}

function renderGames(games) {
  gamesContainer.innerHTML = "";
  updateRecord();

  if (!games || games.length === 0) {
    gamesContainer.innerHTML = `<p style="color:#94a3b8">No games found for this week</p>`;
    return;
  }

  games.forEach((game, index) => {
    const card = document.createElement("div");
    card.className = "game-card";

    let statusText = "Scheduled";
    if (game.is_final) statusText = "Final";
    else if (game.is_in_progress) statusText = "In Progress";

    const hasLine = typeof game.spread_close === "number";
    const favoriteName = game.favorite || "—";
    const spreadDisplay = hasLine ? game.spread_close : "—";
    const totalDisplay = typeof game.total_close === "number" ? game.total_close : "—";
    const resultText = getCoverResult(game);
    const pickResult = getPickResult(game);

    const homeClass = favoriteName === game.home_team ? "favorite" : "";
    const awayClass = favoriteName === game.away_team ? "favorite" : "";

    const edge = analyzeMatchup(game, historicalGames);
    const notesHtml = edge.notes.map(n => `<li>${n}</li>`).join("");
    const detailsId = `edge-details-${index}`;

    card.innerHTML = `
      <div class="matchup">
        <span class="${awayClass}">${game.away_team}</span>
        @
        <span class="${homeClass}">${game.home_team}</span>
      </div>
      <div class="lines">
        <div class="line-item">Status: <strong>${statusText}</strong></div>
        <div class="line-item">Favorite: <strong>${favoriteName}</strong></div>
        <div class="line-item">Line: <strong>${spreadDisplay}</strong></div>
        <div class="line-item">Total: <strong>${totalDisplay}</strong></div>
      </div>
      ${resultText ? `<div class="result-line">${resultText}</div>` : ""}
      <div class="pick-row">
        <button class="pick-btn ${game.pick === "away" ? "active" : ""}" data-side="away">Pick ${game.away_team}</button>
        <button class="pick-btn ${game.pick === "home" ? "active" : ""}" data-side="home">Pick ${game.home_team}</button>
      </div>
      <div class="pick-status">
        ${game.pick ? `Your pick: ${game.pick === "home" ? game.home_team : game.away_team}${pickResult ? " • " + pickResult : ""}` : "No pick yet"}
      </div>
      <div class="movement">
        ${hasLine ? `Saved/current line from ${game.bookmaker || "sportsbook"}` : "Live odds + opening line coming later"}
      </div>
      <button class="edge-toggle" type="button" data-target="${detailsId}">
        Edge insights
      </button>
      <div class="edge-details hidden" id="${detailsId}">
        <div class="edge-lean">${edge.leanText}</div>
        <ul class="edge-notes">
          ${notesHtml}
        </ul>
      </div>
    `;

    card.querySelectorAll(".pick-btn").forEach(btn => {
      btn.addEventListener("click", () => setPick(game, btn.dataset.side));
    });

    gamesContainer.appendChild(card);
  });

  document.querySelectorAll(".edge-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.target);
      if (!target) return;
      const isHidden = target.classList.contains("hidden");
      target.classList.toggle("hidden");
      button.textContent = isHidden ? "Hide insights" : "Edge insights";
    });
  });
}

async function loadOdds() {
  loadOddsBtn.disabled = true;
  loadOddsBtn.textContent = "Loading odds...";
  statusMessage.textContent = "Requesting live odds (this uses API quota)...";
  statusMessage.style.color = "#fbbf24";

  try {
    const oddsGames = await fetchLiveOdds();
    saveOddsCache(oddsGames);
    currentSchedule = mergeOddsIntoSchedule(currentSchedule, oddsGames);
    currentSchedule = applySavedGames(currentSchedule);
    rememberGames(currentSchedule);
    renderGames(currentSchedule);

    const matched = currentSchedule.filter(g => typeof g.spread_close === "number").length;
    statusMessage.textContent = `Live odds loaded for ${matched} game(s).`;
    statusMessage.style.color = "#4ade80";
  } catch (error) {
    console.error(error);
    statusMessage.textContent = error.message;
    statusMessage.style.color = "#f87171";
  } finally {
    loadOddsBtn.disabled = false;
    loadOddsBtn.textContent = "Load live odds";
  }
}

function buildWeekDropdown() {
  weekSelect.innerHTML = "";
  for (let w = 1; w <= 18; w++) {
    const option = document.createElement("option");
    option.value = w;
    option.textContent = `Week ${w}`;
    weekSelect.appendChild(option);
  }

  weekSelect.addEventListener("change", () => {
    loadRealSchedule(parseInt(weekSelect.value, 10));
  });
}

async function init() {
  buildWeekDropdown();
  loadOddsBtn.addEventListener("click", loadOdds);
  downloadBtn.addEventListener("click", downloadSnapshot);
  importInput.addEventListener("change", () => {
    if (importInput.files[0]) importSnapshot(importInput.files[0]);
  });

  await loadHistorical();
  const currentWeek = await fetchCurrentWeekNumber();
  weekSelect.value = String(currentWeek);
  await loadRealSchedule(currentWeek);
}

init();
