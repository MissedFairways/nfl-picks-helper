// Simple starter script for NFL Picks Helper

async function loadData() {
  const statusMessage = document.getElementById("status-message");

  try {
    const response = await fetch("data/historical.json");

    if (!response.ok) {
      throw new Error("Could not load historical.json");
    }

    const data = await response.json();

    // For now just show how many records we have (will be 0 until we add data)
    const count = Array.isArray(data) ? data.length : 0;

    statusMessage.textContent = `Data loaded successfully. Currently ${count} historical games ready.`;
    statusMessage.style.color = "#4ade80"; // green

  } catch (error) {
    console.error(error);
    statusMessage.textContent = "Waiting for historical data... (file is empty or not ready yet)";
    statusMessage.style.color = "#fbbf24"; // yellow/orange
  }
}

// Run when the page loads
loadData();
