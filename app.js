import { fetchSchedule } from "./js/schedule.js";
import { analyzeMatchup } from "./js/edge.js";
import { fetchLiveOdds, mergeOddsIntoSchedule } from "./js/odds.js";

let historicalGames = [];
let currentSchedule = [];

const statusMessage = document.getElementById("status-message");
const weekSelect = document.getElementById("week-select");
const gamesContainer = document.getElementById("games-container");
const loadOddsBtn = document.getElementById("load-odds-btn");

async function loadHistorical() {
  try {
    const response = await fetch("data/historical.json");
    if (!response.ok) throw new Error("Could not load historical.json");
    historicalGames = await response.json();
    console.log(`Historical data loaded (${historicalGames.length} games)`);
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

  const season = currentSchedule[0]?.season ?? "????";
  const weekNum = currentSchedule[0]?.week ?? "?";

  statusMessage.textContent = `Real schedule loaded — ${season} Week ${weekNum} (${currentSchedule.length} games) • live odds off until you click the button`;
  statusMessage.style.color = "#4ade80";

  renderGames(currentSchedule);
}

function renderGames(games) {
  gamesContainer.innerHTML = "";

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
      <div class="movement">
        ${hasLine ? `Current line from ${game.bookmaker || "sportsbook"}` : "Live odds + opening line coming later"}
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
    currentSchedule = mergeOddsIntoSchedule(currentSchedule, oddsGames);
    renderGames(currentSchedule);

    const matched = currentSchedule.filter(g => typeof g.spread_close === "number").length;
    statusMessage.textContent = `Live odds loaded for ${matched} game(s). Quota used for this click only.`;
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

  weekSelect.value = "2";

  weekSelect.addEventListener("change", () => {
    const selectedWeek = parseInt(weekSelect.value, 10);
    loadRealSchedule(selectedWeek);
  });
}

async function init() {
  buildWeekDropdown();
  loadOddsBtn.addEventListener("click", loadOdds);
  await loadHistorical();
  await loadRealSchedule(2);
}

init();
