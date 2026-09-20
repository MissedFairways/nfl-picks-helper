// ======================
// LIVE ODDS TEMPORARILY TURNED OFF
// ======================
// const ODDS_API_KEY = "YOUR_KEY_HERE";   // kept for later
// ======================

import { fetchSchedule } from "./js/schedule.js";
import { homeDogsUnder, underdogsUnder, homeFavoritesOver } from "./js/edge.js";

let historicalGames = [];
let currentSchedule = [];

const statusMessage = document.getElementById("status-message");
const weekSelect = document.getElementById("week-select");
const gamesContainer = document.getElementById("games-container");
const edgeBox = document.getElementById("edge-box");

// ---------- Historical (background + edge analysis) ----------
async function loadHistorical() {
  try {
    const response = await fetch("data/historical.json");
    if (!response.ok) throw new Error("Could not load historical.json");
    historicalGames = await response.json();
    console.log(`Historical data loaded (${historicalGames.length} games)`);
    renderEdgeInsights();
  } catch (error) {
    console.error("Historical load failed:", error);
    edgeBox.innerHTML = `<p style="color:#f87171">Could not load historical data for edge analysis</p>`;
  }
}

// ---------- Real Schedule ----------
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

  const season = currentSchedule[0]?.season ?? "????";
  const weekNum = currentSchedule[0]?.week ?? "?";

  statusMessage.textContent = `Real schedule loaded — ${season} Week ${weekNum} (${currentSchedule.length} games) • live odds still off`;
  statusMessage.style.color = "#4ade80";

  renderGames(currentSchedule);
}

// ---------- Render game cards ----------
function renderGames(games) {
  gamesContainer.innerHTML = "";

  if (!games || games.length === 0) {
    gamesContainer.innerHTML = `<p style="color:#94a3b8">No games found for this week</p>`;
    return;
  }

  games.forEach(game => {
    const card = document.createElement("div");
    card.className = "game-card";

    let statusText = "Scheduled";
    if (game.is_final) statusText = "Final";
    else if (game.is_in_progress) statusText = "In Progress";

    card.innerHTML = `
      <div class="matchup">
        ${game.away_team} @ ${game.home_team}
      </div>
      <div class="lines">
        <div class="line-item">Status: <strong>${statusText}</strong></div>
        <div class="line-item">Favorite: <strong>—</strong></div>
        <div class="line-item">Line: <strong>—</strong></div>
        <div class="line-item">Total: <strong>—</strong></div>
      </div>
      <div class="movement">
        Live odds + opening line coming later
      </div>
    `;
    gamesContainer.appendChild(card);
  });
}

// ---------- Edge Insights ----------
function renderEdgeInsights() {
  if (!historicalGames || historicalGames.length === 0) {
    edgeBox.innerHTML = `<p>No historical data available</p>`;
    return;
  }

  const homeDogs = homeDogsUnder(historicalGames, 7);
  const allDogs = underdogsUnder(historicalGames, 7);
  const bigHomeFavs = homeFavoritesOver(historicalGames, 7);

  edgeBox.innerHTML = `
    <div class="edge-stat">
      <strong>Home dogs ≤ 7</strong><br>
      ${homeDogs.covers} covers out of ${homeDogs.total} games → <strong>${homeDogs.rate ?? "n/a"}%</strong>
    </div>
    <div class="edge-stat">
      <strong>All underdogs ≤ 7</strong><br>
      ${allDogs.covers} covers out of ${allDogs.total} games → <strong>${allDogs.rate ?? "n/a"}%</strong>
    </div>
    <div class="edge-stat">
      <strong>Home favorites ≥ 7</strong><br>
      ${bigHomeFavs.covers} covers out of ${bigHomeFavs.total} games → <strong>${bigHomeFavs.rate ?? "n/a"}%</strong>
    </div>
    <p class="edge-note">Based on small 2024 sample only. More data will improve these numbers.</p>
  `;
}

// ---------- Week dropdown ----------
function buildWeekDropdown() {
  weekSelect.innerHTML = "";
  for (let w = 1; w <= 18; w++) {
    const option = document.createElement("option");
    option.value = w;
    option.textContent = `Week ${w}`;
    weekSelect.appendChild(option);
  }

  weekSelect.value = "2";

  weekSelect.addEventListener("change", () => {
    const selectedWeek = parseInt(weekSelect.value, 10);
    loadRealSchedule(selectedWeek);
  });
}

// ---------- Start ----------
async function init() {
  buildWeekDropdown();
  await loadHistorical();
  await loadRealSchedule(2);
}

init();
