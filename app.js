// ======================
// PUT YOUR API KEY HERE
// ======================
const ODDS_API_KEY = "6e1bbc6d8091b3e0db2cd52bff537d33";

// ======================

let historicalGames = [];
let liveOdds = [];

async function loadHistorical() {
  try {
    const response = await fetch("data/historical.json");
    if (!response.ok) throw new Error("Could not load historical.json");
    historicalGames = await response.json();
  } catch (error) {
    console.error("Historical data error:", error);
  }
}

async function loadLiveOdds() {
  const statusMessage = document.getElementById("status-message");
  const weekSelect = document.getElementById("week-select");

  statusMessage.textContent = "Loading live odds...";
  statusMessage.style.color = "#fbbf24";

  try {
    const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?regions=us&markets=spreads,totals&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to load odds");
    }

    liveOdds = await response.json();

    statusMessage.textContent = `Live odds loaded — ${liveOdds.length} games available`;
    statusMessage.style.color = "#4ade80";

    // Build a simple "Current Games" option for now
    weekSelect.innerHTML = "";
    const option = document.createElement("option");
    option.value = "current";
    option.textContent = "Current NFL Games";
    weekSelect.appendChild(option);

    renderLiveGames();

  } catch (error) {
    console.error(error);
    statusMessage.textContent = `Error loading odds: ${error.message}`;
    statusMessage.style.color = "#f87171";
  }
}

function renderLiveGames() {
  const container = document.getElementById("games-container");
  container.innerHTML = "";

  if (liveOdds.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8">No live games found right now.</p>`;
    return;
  }

  liveOdds.forEach(game => {
    // Get the first bookmaker that has spreads (usually reliable)
    const bookmaker = game.bookmakers?.[0];
    if (!bookmaker) return;

    const spreadMarket = bookmaker.markets.find(m => m.key === "spreads");
    const totalsMarket = bookmaker.markets.find(m => m.key === "totals");

    let homeSpread = "N/A";
    let total = "N/A";
    let favorite = "N/A";

    if (spreadMarket) {
      const homeOutcome = spreadMarket.outcomes.find(o => o.name === game.home_team);
      const awayOutcome = spreadMarket.outcomes.find(o => o.name === game.away_team);

      if (homeOutcome) {
        homeSpread = homeOutcome.point;
        // Negative point means home is favorite
        favorite = homeOutcome.point < 0 ? game.home_team : game.away_team;
      }
    }

    if (totalsMarket) {
      const over = totalsMarket.outcomes.find(o => o.name === "Over");
      if (over) total = over.point;
    }

    const card = document.createElement("div");
    card.className = "game-card";

    card.innerHTML = `
      <div class="matchup">
        ${game.away_team} @ <span class="${favorite === game.home_team ? 'favorite' : ''}">${game.home_team}</span>
      </div>
      <div class="lines">
        <div class="line-item">Favorite: <strong>${favorite}</strong></div>
        <div class="line-item">Current Line: <strong>${homeSpread}</strong></div>
        <div class="line-item">Total: <strong>${total}</strong></div>
      </div>
      <div class="movement">
        Opening line & movement coming later
      </div>
    `;

    container.appendChild(card);
  });
}

// Start everything
async function init() {
  await loadHistorical();   // still loads in the background
  await loadLiveOdds();     // main thing we show
}

init();
