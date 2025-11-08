// ============================================
// IoT EV Battery Monitoring System - Backend
// ============================================

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// ============================================
// THINGSPEAK CONFIGURATION
// ============================================
const THINGSPEAK_CHANNEL_ID = process.env.THINGSPEAK_CHANNEL_ID;
const THINGSPEAK_READ_API_KEY = process.env.THINGSPEAK_READ_API_KEY;
const THINGSPEAK_WRITE_API_KEY = process.env.THINGSPEAK_WRITE_API_KEY;

// Validate environment variables
if (
  !THINGSPEAK_CHANNEL_ID ||
  !THINGSPEAK_READ_API_KEY ||
  !THINGSPEAK_WRITE_API_KEY
) {
  console.error("❌ ERROR: Missing ThingSpeak credentials in .env file!");
  console.error("Please check your .env file and ensure all values are set.");
  process.exit(1);
}

const THINGSPEAK_READ_URL = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds/last.json`;
const THINGSPEAK_WRITE_URL = "https://api.thingspeak.com/update";

// ============================================
// YOUR BATTERY PARAMETERS & STATE VARIABLES
// ============================================
const BATTERY_CAPACITY = 2000.0; // mAh - CHANGE THIS to your battery
const NOMINAL_VOLTAGE = 3.7; // V - Nominal voltage
const MAX_VOLTAGE = 4.2; // V - Fully charged
const MIN_VOLTAGE = 3.0; // V - Empty battery

// State variables for Coulomb Counting (YOUR INITIALIZATIONS)
let totalCurrent_mAh = 0.0;
let initialCapacity = BATTERY_CAPACITY;
let consumedCapacity = 0.0;
let lastUpdateTime = Date.now();
let isCharging = false;
let previousCurrent = 0.0;

// ============================================
// HELPER FUNCTIONS - CALCULATIONS
// ============================================

/**
 * Calculate SOC using YOUR Coulomb Counting Method
 */
function calculateSOC(current_mA, voltage) {
  const currentTime = Date.now();
  const deltaTime_h = (currentTime - lastUpdateTime) / 3600000.0; // ms to hours

  if (deltaTime_h > 0) {
    const deltaCapacity_mAh = current_mA * deltaTime_h;
    totalCurrent_mAh += deltaCapacity_mAh;

    if (current_mA > 0) {
      // Discharging (positive current)
      consumedCapacity += deltaCapacity_mAh;
      isCharging = false;
    } else {
      // Charging (negative current)
      isCharging = true;
    }

    lastUpdateTime = currentTime;
  }

  const remainingCapacity = BATTERY_CAPACITY - consumedCapacity;
  let soc = (remainingCapacity / BATTERY_CAPACITY) * 100.0;

  // Clamp between 0-100
  if (soc > 100.0) soc = 100.0;
  if (soc < 0.0) soc = 0.0;

  console.log(
    `📊 SOC Calculation: ${soc.toFixed(
      2
    )}% (Consumed: ${consumedCapacity.toFixed(2)} mAh)`
  );

  return soc;
}

/**
 * Calculate State of Health (SOH) - Formula Based
 * Estimates battery health based on voltage behavior and conditions
 */
/**
 * Calculate SOH using YOUR formula (voltage + temperature factors)
 */
function calculateSOH(voltage, temperature) {
  let voltageFactor = 1.0;
  let temperatureFactor = 1.0;

  // Voltage-based degradation factor
  if (voltage < MIN_VOLTAGE + 0.2) {
    voltageFactor = 0.8; // Critical low voltage
  } else if (voltage < NOMINAL_VOLTAGE) {
    voltageFactor = 0.9; // Below nominal voltage
  }

  // Temperature-based degradation factor
  if (temperature > 45.0 || temperature < 0.0) {
    temperatureFactor = 0.85; // Extreme temperature
  } else if (temperature > 35.0 || temperature < 10.0) {
    temperatureFactor = 0.95; // Non-optimal temperature
  }

  let soh = voltageFactor * temperatureFactor * 100.0;

  // Clamp between 0-100
  if (soh > 100.0) soh = 100.0;
  if (soh < 0.0) soh = 0.0;

  console.log(
    `💪 SOH Calculation: ${soh.toFixed(
      2
    )}% (V-Factor: ${voltageFactor}, T-Factor: ${temperatureFactor})`
  );

  return soh;
}
/**
 * Calculate Runtime in hours
 * Formula: Runtime = (Available Capacity) / Current / Efficiency
 */
function calculateRuntime(soc, current) {
  const BATTERY_CAPACITY = 2.0; // 2000mAh = 2.0Ah
  const EFFICIENCY = 0.85; // 85% efficiency (real-world factor)

  // Calculate available capacity based on SOC
  const availableCapacity = (soc / 100) * BATTERY_CAPACITY;

  // If not drawing current (idle or charging)
  if (current <= 0 || isNaN(current)) {
    return availableCapacity; // Return capacity in Ah
  }

  // Runtime (hours) = Capacity (Ah) / Current (A)
  let runtime = availableCapacity / Math.abs(current);

  // Apply real-world efficiency factor
  runtime = runtime * EFFICIENCY;

  return Math.max(0, runtime);
}

/**
 * Calculate Range in kilometers
 * Formula: Range = Runtime × Average Speed
 */
function calculateRange(soc, current) {
  const runtime = calculateRuntime(soc, current);

  // Configure your vehicle's average speed here
  const AVERAGE_SPEED = 25; // km/h (adjust for your EV)

  const range = runtime * AVERAGE_SPEED;

  return Math.max(0, range);
}

/**
 * Calculate Power in Watts
 * Formula: Power = Voltage × Current
 */
function calculatePower(voltage, current) {
  return voltage * Math.abs(current);
}

/**
 * Calculate Available Energy in Watt-hours
 * Formula: Energy = Voltage × Available Capacity
 */
function calculateEnergy(voltage, soc) {
  const BATTERY_CAPACITY = 2.0; // 2Ah
  const availableCapacity = (soc / 100) * BATTERY_CAPACITY;
  const energy = voltage * availableCapacity;
  return energy;
}
// ============================================
// API ROUTES
// ============================================

/**
 * GET /api/data
 * Fetches latest battery data from ThingSpeak
 */
app.get("/api/data", async (req, res) => {
  try {
    console.log("📡 Fetching data from ThingSpeak...");

    const response = await axios.get(THINGSPEAK_READ_URL, {
      params: {
        api_key: THINGSPEAK_READ_API_KEY,
      },
      timeout: 10000, // 10 second timeout
    });

    const data = response.data;

    // Extract values from ThingSpeak fields
    const voltage = parseFloat(data.field1) || 0;
    const current = parseFloat(data.field2) || 0;
    const temperature = parseFloat(data.field3) || 0;
    const chargingStatus = parseInt(data.field4) || 0;

    // Convert current from A to mA for YOUR formula
    const current_mA = current * 1000;

    // Calculate derived values using YOUR formulas
    const soc = calculateSOC(current_mA, voltage);
    const soh = calculateSOH(voltage, temperature);

    // Prepare response with all metrics
    const batteryData = {
      // Raw sensor values
      voltage: voltage.toFixed(2),
      current: current.toFixed(2),
      temperature: temperature.toFixed(1),
      chargingStatus: chargingStatus,
      chargingStatusText: chargingStatus === 1 ? "Charging" : "Discharging",

      // Calculated values
      soc: Math.round(soc),
      soh: Math.round(soh),
      runtime: runtime.toFixed(2),
      range: range.toFixed(1),
      power: power.toFixed(2),
      energy: energy.toFixed(2),

      // Battery info
      batteryType: "3.7V Li-ion",
      capacity: "2000mAh",

      // Timestamps
      lastUpdated: data.created_at,
      timestamp: new Date().toISOString(),
    };
    console.log("✅ Data fetched successfully:", batteryData);
    res.json({ success: true, data: batteryData });
  } catch (error) {
    console.error("❌ Error fetching ThingSpeak data:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch battery data",
      message: error.message,
    });
  }
});

/**
 * POST /api/mode
 * Sends motor mode selection to ThingSpeak
 * Body: { mode: 'eco' | 'sport' }
 */
app.post("/api/mode", async (req, res) => {
  try {
    const { mode } = req.body;

    if (!mode || (mode !== "eco" && mode !== "sport")) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be "eco" or "sport"',
      });
    }

    // Convert mode to numeric value
    // eco = 0, sport = 1
    const modeValue = mode === "eco" ? 0 : 1;

    console.log(
      `🎯 Setting mode to: ${mode.toUpperCase()} (value: ${modeValue})`
    );

    // Send to ThingSpeak (assuming mode is stored in field5)
    const response = await axios.get(THINGSPEAK_WRITE_URL, {
      params: {
        api_key: THINGSPEAK_WRITE_API_KEY,
        field5: modeValue,
      },
      timeout: 10000,
    });
    const result = response.data;

    if (result === 0 || result === "0") {
      throw new Error(
        "ThingSpeak write failed (rate limit or invalid API key)"
      );
    }

    console.log("✅ Mode set successfully");
    res.json({
      success: true,
      mode: mode,
      modeValue: modeValue,
      message: `${mode.toUpperCase()} mode activated`,
    });
  } catch (error) {
    console.error("❌ Error setting mode:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to set mode",
      message: error.message,
    });
  }
});

/**
 * POST /api/reset-soc
 * Reset SOC counters when battery is fully charged
 * Body: { soc: 100 } (optional, defaults to 100)
 */
app.post("/api/reset-soc", (req, res) => {
  try {
    const { soc } = req.body;
    const resetSOC = soc || 100;

    // Reset counters
    totalCurrent_mAh = 0.0;
    consumedCapacity = ((100 - resetSOC) / 100) * BATTERY_CAPACITY;
    lastUpdateTime = Date.now();

    console.log(`🔄 SOC Reset to ${resetSOC}%`);

    res.json({
      success: true,
      message: `SOC reset to ${resetSOC}%`,
      consumedCapacity: consumedCapacity.toFixed(2),
    });
  } catch (error) {
    console.error("❌ Error resetting SOC:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to reset SOC",
      message: error.message,
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "EV Battery Monitor",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Serve index.html for root route
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("💥 Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message,
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log("");
  console.log("🔋 ========================================");
  console.log("   IoT EV Battery Monitoring System");
  console.log("   ========================================");
  console.log(`   🚀 Server running on: http://localhost:${PORT}`);
  console.log(`   📡 ThingSpeak Channel ID: ${THINGSPEAK_CHANNEL_ID}`);
  console.log(`   🌐 Open in browser: http://localhost:${PORT}`);
  console.log("   ========================================");
  console.log("");
});
