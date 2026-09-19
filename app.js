// ======================
// LIVE ODDS TEMPORARILY TURNED OFF
// ======================
// const ODDS_API_KEY = "YOUR_KEY_HERE";   // kept for later
// ======================

let historicalGames = [];

async function loadHistorical() {
  const statusMessage = document.getElementById("status-message");
  const weekSelect = document.getElementById("week-select");

  try {
    const response = await fetch("data/historical.json");
    if (!response.ok) throw new Error("Could not load historical.json");

    historicalGames = await response.json();

    statusMessage.textContent = `Historical data loaded (${historicalGames.length} games) — live odds currently turned off`;
    statusMessage.style.color = "#4ade80";

    // Build week dropdown from historical data
    const weeks = [...new Set(historicalGames.map(g => `Week ${g.week} (${g.season})`))].sort();
    
    weekSelect.innerHTML = "";
    weeks.forEach(weekLabel => {
      const option = document.createElement("option");
      option.value = weekLabel;
      option.textContent = weekLabel;
      weekSelect.appendChild(option);
    });

    if (weeks.length > 0) {
      weekSelect.value = weeks[0];
      renderGames(weeks[0]);
    }

    weekSelect.addEventListener("change", () => {
      renderGames(weekSelect.value);
    });

  } catch (error) {
    console.error(error);
    statusMessage.textContent = "Error loading historical data";
    statusMessage.style.color = "#f87171";
  }
}

function renderGames(weekLabel) {
  const container = document.getElementById("games-container");
  container.innerHTML = "";

  const match = weekLabel.match(/Week (\d+) \((\d+)\)/);
  if (!match) return;

  const weekNum = parseInt(match[1]);
  const season = parseInt(match[2]);

  const filtered = historicalGames.filter(g => g.week === weekNum && g.season === season);

  if (filtered.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8">No games found for this week</p>`;
    return;
  }

  filtered.forEach(game => {
    // Determine favorite
    let favoriteName = "Pick'em";
    let spreadDisplay = "0";

    if (game.spread < 0) {
      favoriteName = game.home_team;
      spreadDisplay = game.spread;
    } else if (game.spread > 0) {
      favoriteName = game.away_team;
      spreadDisplay = -game.spread;
    }

    const card = document.createElement("div");
    card.className = "game-card";

    card.innerHTML = `
      <div class="matchup">
        ${game.away_team} @ <span class="${favoriteName === game.home_team ? 'favorite' : ''}">${game.home_team}</span>
      </div>
      <div class="lines">
        <div class="line-item">Favorite: <strong>${favoriteName}</strong></div>
        <div class="line-item">Line: <strong>${spreadDisplay}</strong></div>
        <div class="line-item">Total: <strong>${game.total}</strong></div>
      </div>
      <div class="movement">
        Live odds + opening line coming later
      </div>
    `;

    container.appendChild(card);
  });
}

// Start
loadHistorical();
