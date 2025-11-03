# 🔋 IoT EV Battery Monitoring System

Real-time battery monitoring system for electric vehicles using Node.js, Express, and ThingSpeak IoT platform.

![Battery Monitor](https://img.shields.io/badge/Battery-3.7V%20Li--ion-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-16%2B-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## 📊 Features

- **Real-time Monitoring:**

  - Voltage (V)
  - Current (A)
  - Temperature (°C)
  - Charging/Discharging status

- **Calculated Metrics:**

  - State of Charge (SOC) - Improved piece-wise formula
  - State of Health (SOH) - Multi-factor analysis
  - Runtime estimation
  - Range calculation
  - Power consumption
  - Available energy

- **Performance Modes:**

  - 🌿 ECO Mode (Energy Efficient)
  - 🏎️ SPORT Mode (High Performance)

- **Auto-refresh** every 15 seconds
- **Responsive Design** - Desktop, Tablet, Mobile
- **Production-ready** with error handling

## 🛠️ Tech Stack

- **Backend:** Node.js + Express.js
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **IoT Platform:** ThingSpeak
- **Battery:** 3.7V 2000mAh Li-ion

## 📁 Project Structure

```
ev-battery-monitor/
├── server.js              # Express backend
├── .env                   # Environment variables (not in repo)
├── .env.example          # Template for .env
├── package.json          # Dependencies
├── README.md             # Documentation
└── public/               # Frontend files
    ├── index.html        # Main page
    ├── script.js         # Frontend logic
    └── style.css         # Styling

```
