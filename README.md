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

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/ev-battery-monitor.git
cd ev-battery-monitor
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your ThingSpeak credentials:

```env
THINGSPEAK_CHANNEL_ID=1234567
THINGSPEAK_READ_API_KEY=YOUR_READ_KEY
THINGSPEAK_WRITE_API_KEY=YOUR_WRITE_KEY
PORT=3000
```

### 4. Run the application

```bash
npm start
```

Open browser: `http://localhost:3000`

## 📡 ThingSpeak Setup

Your ThingSpeak channel should have these fields:

| Field  | Data            | Unit |
| ------ | --------------- | ---- |
| field1 | Voltage         | V    |
| field2 | Current         | A    |
| field3 | Temperature     | °C   |
| field4 | Charging Status | 0/1  |
| field5 | Motor Mode      | 0/1  |

## 🧮 SOC Calculation

Uses **improved piece-wise formula** for accurate Li-ion discharge curve:

```
Voltage Range | SOC Range | Characteristics
--------------|-----------|----------------
4.2V - 4.0V   | 100%-80%  | Steep (final charge)
4.0V - 3.7V   | 80%-40%   | Flat (stable)
3.7V - 3.4V   | 40%-10%   | Moderate
3.4V - 3.0V   | 10%-0%    | Steep (rapid drop)
```

## 🔋 SOH Calculation

Multi-factor health assessment:

1. **Voltage sag under load** (0-10% penalty)
2. **Temperature effects** (0-15% penalty)
3. **Deep discharge stress** (0-20% penalty)
4. **High C-rate discharge** (0-8% penalty)
5. **Overcharge protection** (0-15% penalty)

## 🎯 API Endpoints

### GET /api/data

Fetches latest battery data from ThingSpeak

**Response:**

```json
{
  "success": true,
  "data": {
    "voltage": "3.85",
    "current": "1.50",
    "temperature": "28.5",
    "soc": 58,
    "soh": 95,
    "runtime": "0.91",
    "range": "22.7",
    "power": "5.78",
    "energy": "4.36"
  }
}
```

### POST /api/mode

Sets motor performance mode

**Request:**

```json
{
  "mode": "eco"
}
```

## ⚙️ Customization

### Change Average Speed

Edit `server.js`:

```javascript
const AVERAGE_SPEED = 25; // km/h
```

### Change Battery Capacity

Edit `server.js`:

```javascript
const BATTERY_CAPACITY = 2.0; // 2000mAh = 2.0Ah
```

### Adjust SOC/SOH Formulas

All calculation functions are in `server.js` with detailed comments.

## 📱 Screenshots

_(Add screenshots of your dashboard here)_

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 👨‍💻 Author

**Your Name**

- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

## 🙏 Acknowledgments

- ThingSpeak for IoT platform
- Express.js community
- Li-ion battery discharge curve research

## 📝 Version History

- **v1.0.0** (2025-01) - Initial release
  - Basic monitoring features
  - SOC/SOH calculations
  - ECO/SPORT modes
  - Auto-refresh functionality

---

**⚡ Built with passion for IoT and Electric Vehicles**
