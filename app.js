// ======================
// LIVE ODDS TEMPORARILY TURNED OFF
// ======================
// const ODDS_API_KEY = "YOUR_KEY_HERE";   // kept for later
// ======================

import { fetchSchedule } from "./js/schedule.js";

let historicalGames = [];   // kept for future edge analysis
let currentSchedule = [];   // real games for the selected week

const statusMessage = document.getElementById("status-message");
const weekSelect = document.getElementById("week-select");
const gamesContainer = document.getElementById("games-container");

// ---------- Historical (background only) ----------
async function loadHistorical() {
  try {
    const response = await fetch("data/historical.json");
    if (!response.ok) throw new Error("Could not load historical.json");
    historicalGames = await response.json();
    console.log(`Historical data loaded (${historicalGames.length} games) — available for edge analysis`);
  } catch (error) {
    console.error("Historical load failed:", error);
  }
}

// ---------- Real Schedule ----------
async function loadRealSchedule(week = null) {
  statusMessage.textContent = "Loading real NFL schedule...";
  statusMessage.style.color = "#94a3b8";

  currentSchedule = await fetchSchedule(week);

  if (currentSchedule.length === 0) {
    statusMessage.textContent = "Could not load schedule (check console)";
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

// ---------- Render cards ----------
function renderGames(games) {
  gamesContainer.innerHTML = "";

  if (!games || games.length === 0) {
    gamesContainer.innerHTML = `<p style="color:#94a3b8">No games found for this week</p>`;
    return;
  }

  games.forEach(game => {
    const card = document.createElement("div");
    card.className = "game-card";

    // Simple status badge
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

// ---------- Week dropdown ----------
function buildWeekDropdown() {
  // Simple 1–18 dropdown for now (true NFL weeks)
  weekSelect.innerHTML = "";
  for (let w = 1; w <= 18; w++) {
    const option = document.createElement("option");
    option.value = w;
    option.textContent = `Week ${w}`;
    weekSelect.appendChild(option);
  }

  // Default to current week (ESPN will return whatever is current if we pass null,
  // but for the dropdown we start on week 2 since that’s where we are today)
  weekSelect.value = "2";

  weekSelect.addEventListener("change", () => {
    const selectedWeek = parseInt(weekSelect.value, 10);
    loadRealSchedule(selectedWeek);
  });
}

// ---------- Start ----------
async function init() {
  buildWeekDropdown();
  await loadHistorical();          // background only
  await loadRealSchedule(2);       // start on current week
}

init();
