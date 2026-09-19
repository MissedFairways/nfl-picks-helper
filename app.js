let allGames = [];

async function loadData() {
  const statusMessage = document.getElementById("status-message");
  const weekSelect = document.getElementById("week-select");

  try {
    const response = await fetch("data/historical.json");
    if (!response.ok) throw new Error("Could not load historical.json");

    allGames = await response.json();

    statusMessage.textContent = `Data loaded successfully. Currently ${allGames.length} historical games ready.`;
    statusMessage.style.color = "#4ade80";

    // Build the week dropdown
    const weeks = [...new Set(allGames.map(g => `Week ${g.week} (${g.season})`))].sort();
    
    weekSelect.innerHTML = "";
    weeks.forEach(weekLabel => {
      const option = document.createElement("option");
      option.value = weekLabel;
      option.textContent = weekLabel;
      weekSelect.appendChild(option);
    });

    // Show the first week by default
    if (weeks.length > 0) {
      weekSelect.value = weeks[0];
      renderTable(weeks[0]);
    }

    // Listen for dropdown changes
    weekSelect.addEventListener("change", () => {
      renderTable(weekSelect.value);
    });

  } catch (error) {
    console.error(error);
    statusMessage.textContent = "Error loading data. Check historical.json";
    statusMessage.style.color = "#f87171";
  }
}

function renderTable(weekLabel) {
  const gamesBody = document.getElementById("games-body");
  gamesBody.innerHTML = "";

  const match = weekLabel.match(/Week (\d+) \((\d+)\)/);
  if (!match) return;

  const weekNum = parseInt(match[1]);
  const season = parseInt(match[2]);

  const filtered = allGames.filter(g => g.week === weekNum && g.season === season);

  if (filtered.length === 0) {
    gamesBody.innerHTML = `<tr><td colspan="9">No games found for this week</td></tr>`;
    return;
  }

  filtered.forEach(game => {
    // Determine the favorite and spread from favorite's perspective
    let favorite, spreadFav, atsResult;

    if (game.spread < 0) {
      // Home team is favorite
      favorite = game.home_team;
      spreadFav = game.spread; // already negative
    } else if (game.spread > 0) {
      // Away team is favorite
      favorite = game.away_team;
      spreadFav = -game.spread; // make it negative
    } else {
      favorite = "Pick'em";
      spreadFav = 0;
    }

    // Calculate ATS result
    const homeMargin = game.home_score - game.away_score;
    const adjustedMargin = homeMargin + game.spread; // positive = home covered

    if (game.spread === 0) {
      atsResult = "Pick'em";
    } else if (adjustedMargin > 0) {
      atsResult = game.home_team + " covered";
    } else if (adjustedMargin < 0) {
      atsResult = game.away_team + " covered";
    } else {
      atsResult = "Push";
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${game.date}</td>
      <td>${game.away_team}</td>
      <td>${game.away_score}</td>
      <td>${game.home_team}</td>
      <td>${game.home_score}</td>
      <td>${favorite}</td>
      <td>${spreadFav}</td>
      <td>${game.total}</td>
      <td>${atsResult}</td>
    `;
    gamesBody.appendChild(row);
  });
}

// Start
loadData();
