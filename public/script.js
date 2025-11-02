// ============================================
// EV Battery Monitor - Frontend JavaScript
// ============================================

// Configuration
const REFRESH_INTERVAL = 15000; // 15 seconds
let currentMode = "eco";

// ============================================
// INITIALIZE ON PAGE LOAD
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🔋 EV Battery Monitor initialized");

  // Set initial mode
  setActiveMode("eco");

  // Fetch data immediately
  fetchBatteryData();

  // Set up auto-refresh
  setInterval(fetchBatteryData, REFRESH_INTERVAL);

  console.log(
    `✅ Auto-refresh enabled: every ${REFRESH_INTERVAL / 1000} seconds`
  );
});

// ============================================
// FETCH BATTERY DATA FROM SERVER
// ============================================
async function fetchBatteryData() {
  const statusBar = document.getElementById("status-bar");

  try {
    updateStatusBar("🔄 Fetching data...", "loading");

    const response = await fetch("/api/data");
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to fetch data");
    }

    const data = result.data;

    // Update all UI elements
    updateBatteryDisplay(data);
    updateMetrics(data);
    updateChargingStatus(data);

    // Update status bar
    const lastUpdate = new Date(data.lastUpdated).toLocaleTimeString();
    updateStatusBar(`✅ Last updated: ${lastUpdate}`, "success");

    console.log("📊 Battery data updated:", data);
  } catch (error) {
    console.error("❌ Error fetching data:", error);
    updateStatusBar(`❌ Error: ${error.message}`, "error");
  }
}

// ============================================
// UPDATE BATTERY VISUALIZATION
// ============================================
function updateBatteryDisplay(data) {
  const soc = parseInt(data.soc);
  const batteryFill = document.getElementById("battery-fill");
  const socText = document.getElementById("soc-text");
  const socLarge = document.getElementById("soc-large");

  // Calculate fill width (max 180px for battery body)
  const fillWidth = (soc / 100) * 180;

  // Get color based on SOC level
  const color = getBatteryColor(soc);

  // Update battery fill
  batteryFill.setAttribute("width", fillWidth);
  batteryFill.setAttribute("fill", color);

  // Update SOC text
  socText.textContent = `${soc}%`;
  socLarge.textContent = soc;
}

// ============================================
// UPDATE METRICS
// ============================================
function updateMetrics(data) {
  document.getElementById("voltage").textContent = data.voltage;
  document.getElementById("current").textContent = data.current;
  document.getElementById("temperature").textContent = data.temperature;
  document.getElementById("soh").textContent = data.soh;
  document.getElementById("range").textContent = data.range;
}

// ============================================
// UPDATE CHARGING STATUS
// ============================================
function updateChargingStatus(data) {
  const statusElement = document.getElementById("charging-status");
  const statusText = statusElement.querySelector(".status-text");
  const statusIcon = statusElement.querySelector(".status-icon");

  if (data.chargingStatus === 1) {
    statusElement.className = "charging-status charging";
    statusIcon.textContent = "🔌";
    statusText.textContent = "CHARGING";
  } else {
    statusElement.className = "charging-status discharging";
    statusIcon.textContent = "⚡";
    statusText.textContent = "DISCHARGING";
  }
}

// ============================================
// GET BATTERY COLOR BASED ON SOC
// ============================================
function getBatteryColor(soc) {
  if (soc < 20) return "#f44336"; // Red
  if (soc < 50) return "#ff9800"; // Orange
  return "#4caf50"; // Green
}

// ============================================
// SET MOTOR MODE
// ============================================
async function setMode(mode) {
  const statusBar = document.getElementById("status-bar");

  try {
    // Update UI immediately
    setActiveMode(mode);
    updateStatusBar(`🎯 Setting ${mode.toUpperCase()} mode...`, "loading");

    // Send to server
    const response = await fetch("/api/mode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to set mode");
    }

    currentMode = mode;
    document.getElementById("current-mode").textContent = mode.toUpperCase();

    updateStatusBar(`✅ ${result.message}`, "success");
    console.log(`✅ Mode set to: ${mode.toUpperCase()}`);

    // Refresh data after 2 seconds
    setTimeout(fetchBatteryData, 2000);
  } catch (error) {
    console.error("❌ Error setting mode:", error);
    updateStatusBar(`❌ Failed to set mode: ${error.message}`, "error");

    // Revert to previous mode
    setActiveMode(currentMode);
  }
}

// ============================================
// SET ACTIVE MODE UI
// ============================================
function setActiveMode(mode) {
  const ecoBtn = document.getElementById("eco-btn");
  const sportBtn = document.getElementById("sport-btn");

  if (mode === "eco") {
    ecoBtn.classList.add("active");
    sportBtn.classList.remove("active");
  } else {
    sportBtn.classList.add("active");
    ecoBtn.classList.remove("active");
  }
}

// ============================================
// UPDATE STATUS BAR
// ============================================
function updateStatusBar(message, type = "loading") {
  const statusBar = document.getElementById("status-bar");
  const statusMessage = statusBar.querySelector(".status-message");

  // Update message
  statusMessage.textContent = message;

  // Update styling
  statusBar.className = "status-bar";
  if (type === "error") {
    statusBar.classList.add("error");
  } else if (type === "success") {
    statusBar.classList.add("success");
  }
}
