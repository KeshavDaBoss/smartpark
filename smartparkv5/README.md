<div align="center">
  <img src="frontend/public/smartparklogo-clear.png" alt="SmartPark Logo" width="200" height="auto" />
  <h1>SmartPark v5</h1>
  <p><strong>Advanced Intelligent Parking Management System</strong></p>

  <h3>Project Team</h3>
  <p><strong>Pratham Yadav</strong></p>
  <p> <strong>Kalepu Yashavardhan</strong></p>

  <br />
</div>

## Overview

**SmartPark v5** is a comprehensive IoT-enabled parking management solution designed to optimize urban mobility. By integrating edge computing hardware (ESP32/Raspberry Pi) with a sophisticated web platform, the system delivers real-time occupancy monitoring, seamless capability for advance slot booking, and intelligent navigation assistance.

The platform features a **Dynamic Floor Plan** offering immediate visual feedback on slot availability, utilizing advanced pathfinding algorithms to guide users efficiently to their designated spots.

## System Architecture

The architecture of SmartPark v5 is designed for modularity, scalability, and real-time performance. It consists of three primary layers:

1.  **Presentation Layer (Frontend)**:
    -   Built with **React.js** and **Vite** for high-performance rendering.
    -   Visualizes the parking floor plan dynamically.
    -   Communicates with the backend via RESTful APIs to fetch slot status and manage bookings.

2.  **Logic & Data Layer (Backend)**:
    -   Powered by **FastAPI (Python)**, ensuring low-latency request handling.
    -   Manages the state of all parking slots, processing data from hardware sensors and user interactions.
    -   Implements complex logic for pathfinding (A* algorithm), conflict resolution for bookings, and user authentication.

3.  **Physical Layer (Hardware & Edge Computing)**:
    -   **Raspberry Pi 4**: Acts as the central gateway and controls local sensors for Mall 1. It hosts the backend server.
    -   **ESP32 Node**: A wireless sensor node for Mall 2 that transmits ultrasonic sensor data to the main server over WiFi. It also controls local LED indicators for booking visualization.

## Key Capabilities

- **Real-Time Occupancy Detection**: Precision monitoring using HC-SR04 ultrasonic sensors.
- **Advanced Booking Engine**:
  - Flexible scheduling for **Today** and **Tomorrow**.
  - Multi-slot reservation capability.
  - Automated conflict resolution logic.
- **Intelligent Navigation**:
  - **Interactive Floor Plan**: Dynamic visualization of slot states (Free, Occupied, Booked, My Booking).
  - **A* Pathfinding**: Optimal route calculation from entry to slot.
  - **Load Balancing**: Automated redirection to alternative levels when capacity is reached.
- **Accessibility Focus**:
  - Reserved zones for **Disabled** and **Elderly** users.
  - Profile-based access control ensuring restricted slots are only bookable by authorized users.
- **Hardware Feedback Loop**:
  - Physical LED indicators sync with digital booking state in real-time.

---

## Technology Stack

### Software
- **Frontend**: React.js, Vite, Canvas API, GSAP.
- **Backend**: FastAPI (Python), Uvicorn, Pydantic.
- **Data Persistence**: In-memory structure (Performance-optimized for demonstration).
- **Protocols**: REST API, HTTP/JSON.

### Hardware
- **Central Unit**: Raspberry Pi 4.
- **Sensor Nodes**: ESP32 (WiFi-enabled Microcontroller).
- **Sensors**: HC-SR04 Ultrasonic modules.
- **Actuators**: Status LEDs.

---

## Installation & Deployment

### Prerequisites
- Python 3.9+
- Node.js & npm
- Raspberry Pi (Generic Linux environment supported)
- ESP32 Development Board

### 1. Repository Setup
```bash
git clone https://github.com/YourRepo/SmartPark.git
cd SmartPark/smartparkv5
```

### 2. Backend Initialization
The backend server manages logic and hardware communication.
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 3. Frontend Initialization
The React-based user interface.
```bash
cd frontend
npm install
cd ..
```

### 4. Application Launch
A unified script is provided for development convenience.
```bash
chmod +x run_dev.sh
./run_dev.sh
```
- **Backend API**: `http://localhost:8000`
- **User Interface**: `http://localhost:5173`

---

## Hardware Configuration

### Pinout Mapping

#### **Raspberry Pi (Mall 1)**
Directly GPIO-connected sensors.
- **Slot 1**: Trig `GPIO 23`, Echo `GPIO 24`
- **Slot 2**: Trig `GPIO 27`, Echo `GPIO 22`
- **Slot 3**: Trig `GPIO 5`, Echo `GPIO 6`
- **Slot 4**: Trig `GPIO 13`, Echo `GPIO 19`

#### **ESP32 (Mall 2 - Wireless Node)**
Operates as a remote client sending data to the Main Server.

- **WiFi Configuration**: Update credentials in `firmware/smartpark_esp32/smartpark_esp32.ino`.
- **Sensor Map**:
  - S1: Trig `13`, Echo `33`
  - S2: Trig `12`, Echo `32`
  - S3: Trig `14`, Echo `35`
  - S4: Trig `27`, Echo `34`
- **Indicators**:
  - S1 LED: Pin `25`
  - S2 LED: Pin `26`

### Firmware Deployment
1. Load `firmware/smartpark_esp32/smartpark_esp32.ino` in Arduino IDE.
2. Target Board: **AI Thinker ESP32-CAM** or **DOIT ESP32 DEVKIT V1**.
3. Verify `serverUrl` matches the backend host IP.
4. Flash firmware.

---

## User Manual

1. **Dashboard Access**: Launch the web interface and select a target facility (Mall 1 or Mall 2).
2. **Slot Reservation**: Tap any available Green slot. Choose the booking date ("Today" or "Tomorrow") and confirm.
3. **Route Guidance**: Select **"Navigate"** on your booked slot to visualize the path.
4. **Smart Redirection**: Use **"Navigate to Closest"** for automated assignment of the best available parking spot.


<div align="center">
  <p>Maintained by <strong>Pratham Yadav and Kalepu Yashvardhan</strong></p>
</div>
