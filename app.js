let allGames = [];

async function loadData() {
  const statusMessage = document.getElementById("status-message");
  const weekSelect = document.getElementById("week-select");
  const gamesBody = document.getElementById("games-body");

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

  // Extract week number and season from the label (e.g. "Week 1 (2024)")
  const match = weekLabel.match(/Week (\d+) \((\d+)\)/);
  if (!match) return;

  const weekNum = parseInt(match[1]);
  const season = parseInt(match[2]);

  const filtered = allGames.filter(g => g.week === weekNum && g.season === season);

  if (filtered.length === 0) {
    gamesBody.innerHTML = `<tr><td colspan="7">No games found for this week</td></tr>`;
    return;
  }

  filtered.forEach(game => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${game.date}</td>
      <td>${game.away_team}</td>
      <td>${game.away_score}</td>
      <td>${game.home_team}</td>
      <td>${game.home_score}</td>
      <td>${game.spread > 0 ? "+" : ""}${game.spread}</td>
      <td>${game.total}</td>
    `;
    gamesBody.appendChild(row);
  });
}

// Start
loadData();
