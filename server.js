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
// HELPER FUNCTIONS - CALCULATIONS
// Improved Formula Method for 3.7V 2000mAh Li-ion
// ============================================

/**
 * Calculate State of Charge (SOC) - Improved Piece-wise Formula
 * More accurate than linear - accounts for Li-ion discharge curve
 */
function calculateSOC(voltage) {
  const V_MIN = 3.0; // Empty battery
  const V_MAX = 4.2; // Full battery
  const V_NOMINAL = 3.7; // Nominal voltage

  let soc = 0;

  // Piece-wise linear approximation
  // Li-ion has different slopes at different voltage ranges

  if (voltage >= 4.2) {
    // Fully charged (100%)
    soc = 100;
  } else if (voltage >= 4.0) {
    // 80-100% range (steep slope during final charging)
    // Formula: SOC = 80 + (V - 4.0) / (4.2 - 4.0) × 20
    soc = 80 + ((voltage - 4.0) / (4.2 - 4.0)) * 20;
  } else if (voltage >= 3.7) {
    // 40-80% range (flat slope - most stable region)
    // Formula: SOC = 40 + (V - 3.7) / (4.0 - 3.7) × 40
    soc = 40 + ((voltage - 3.7) / (4.0 - 3.7)) * 40;
  } else if (voltage >= 3.4) {
    // 10-40% range (moderate slope)
    // Formula: SOC = 10 + (V - 3.4) / (3.7 - 3.4) × 30
    soc = 10 + ((voltage - 3.4) / (3.7 - 3.4)) * 30;
  } else if (voltage >= 3.0) {
    // 0-10% range (steep drop - critical low)
    // Formula: SOC = 0 + (V - 3.0) / (3.4 - 3.0) × 10
    soc = 0 + ((voltage - 3.0) / (3.4 - 3.0)) * 10;
  } else {
    // Below minimum voltage (0%)
    soc = 0;
  }

  // Ensure SOC is between 0-100%
  return Math.max(0, Math.min(100, soc));
}

/**
 * Calculate State of Health (SOH) - Formula Based
 * Estimates battery health based on voltage behavior and conditions
 */
function calculateSOH(voltage, current, temperature) {
  // Start with 100% health
  let totalDegradation = 0;

  // ==========================================
  // FACTOR 1: Voltage Sag Under Load
  // ==========================================
  // Healthy battery maintains voltage better when current flows

  if (Math.abs(current) > 0) {
    // Expected voltage drop: ~0.1V per Amp is normal for healthy battery
    const expectedVoltageDrop = Math.abs(current) * 0.1;
    const expectedVoltage = 3.7 - expectedVoltageDrop;

    // Check if actual voltage is lower than expected
    if (voltage < expectedVoltage - 0.2) {
      totalDegradation += 10; // High internal resistance
    } else if (voltage < expectedVoltage - 0.1) {
      totalDegradation += 5; // Moderate internal resistance
    }
  }

  // ==========================================
  // FACTOR 2: Temperature Impact
  // ==========================================
  // Optimal: 20-40°C
  // High temp accelerates degradation
  // Low temp reduces performance

  if (temperature > 60) {
    totalDegradation += 15; // Critical - severe damage risk
  } else if (temperature > 50) {
    totalDegradation += 10; // Very high - rapid aging
  } else if (temperature > 40) {
    totalDegradation += 5; // High - accelerated aging
  } else if (temperature < 0) {
    totalDegradation += 8; // Freezing - lithium plating risk
  } else if (temperature < 10) {
    totalDegradation += 3; // Cold - reduced capacity
  }
  // 20-40°C = optimal range (no penalty)

  // ==========================================
  // FACTOR 3: Deep Discharge Stress
  // ==========================================
  // Li-ion should not be discharged below 3.0V

  if (voltage < 3.0) {
    totalDegradation += 20; // Critical - permanent damage
  } else if (voltage < 3.2) {
    totalDegradation += 10; // Deep discharge - accelerated aging
  } else if (voltage < 3.4) {
    totalDegradation += 3; // Low voltage stress
  }

  // ==========================================
  // FACTOR 4: High Discharge Rate (C-Rate)
  // ==========================================
  // C-Rate = Current / Capacity
  // 2000mAh = 2Ah, so 1C = 2A

  const BATTERY_CAPACITY = 2.0; // 2Ah
  const cRate = Math.abs(current) / BATTERY_CAPACITY;

  if (cRate > 2.0) {
    totalDegradation += 8; // > 2C (>4A) - very high stress
  } else if (cRate > 1.5) {
    totalDegradation += 5; // > 1.5C (>3A) - high stress
  } else if (cRate > 1.0) {
    totalDegradation += 2; // > 1C (>2A) - moderate stress
  }
  // < 1C = normal discharge rate (no penalty)

  // ==========================================
  // FACTOR 5: Overcharge Protection
  // ==========================================
  // Li-ion should not exceed 4.2V

  if (voltage > 4.25) {
    totalDegradation += 15; // Dangerous overcharge
  } else if (voltage > 4.22) {
    totalDegradation += 5; // Slight overcharge
  }

  // ==========================================
  // Calculate Final SOH
  // ==========================================
  let soh = 100 - totalDegradation;

  // Ensure SOH is between 0-100%
  return Math.max(0, Math.min(100, soh));
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

    // Calculate derived values using improved formulas
    const soc = calculateSOC(voltage);
    const soh = calculateSOH(voltage, current, temperature);
    const runtime = calculateRuntime(soc, current);
    const range = calculateRange(soc, current);
    const power = calculatePower(voltage, current);
    const energy = calculateEnergy(voltage, soc);

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
