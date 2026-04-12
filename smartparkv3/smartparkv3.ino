#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "Anil 2G";
const char* password = "Anil@1812";

// Create web server on port 80
WebServer server(80);

// Ultrasonic sensor pins
const int trigPins[] = {13, 12, 14, 27}; // Slot 1-4 Trig
const int echoPins[] = {33, 32, 35, 34}; // Slot 1-4 Echo

// LED pins for booking indicators (Slots 1 & 2 only)
const int ledPins[] = {25, 26};

// Parking slot status
bool slotOccupied[4] = {false, false, false, false};
bool slotBooked[2] = {false, false}; // Only slots 1 & 2 are bookable

// Distance threshold (cm) - adjust based on your setup
const int DISTANCE_THRESHOLD = 15;

// Timing
unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 1000; // Read sensors every 1 second

// Forward declarations for server handlers
void handleRoot();
void handleStatus();
void handleBook();
void handleCancel();

void setup() {
  Serial.begin(115200);
  
  // Initialize sensor pins
  for (int i = 0; i < 4; i++) {
    pinMode(trigPins[i], OUTPUT);
    pinMode(echoPins[i], INPUT);
  }
  
  // Initialize LED pins
  for (int i = 0; i < 2; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }
  
  // Connect to WiFi
  Serial.println("\nConnecting to WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi Connected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());
  
  // Setup server routes
  server.on("/", handleRoot);
  server.on("/api/status", handleStatus);
  server.on("/api/book", HTTP_POST, handleBook);
  server.on("/api/cancel", HTTP_POST, handleCancel);
  
  // Enable CORS
  server.enableCORS(true);
  
  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
  
  // Read sensors periodically
  if (millis() - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = millis();
    readAllSensors();
    updateLEDs();
  }
}

// Read distance from ultrasonic sensor
long readDistance(int slot) {
  digitalWrite(trigPins[slot], LOW);
  delayMicroseconds(2);
  digitalWrite(trigPins[slot], HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPins[slot], LOW);
  
  long duration = pulseIn(echoPins[slot], HIGH, 30000); // 30ms timeout
  long distance = duration * 0.034 / 2;
  
  return distance;
}

// Read all sensors and update slot status
void readAllSensors() {
  for (int i = 0; i < 4; i++) {
    long distance = readDistance(i);
    
    // Basic debounce: only change status if reading is consistent or out of range
    if (distance > 0 && distance < DISTANCE_THRESHOLD) {
      slotOccupied[i] = true;
    } else if (distance >= DISTANCE_THRESHOLD || distance == 0) { // Also treat timeout (0) as free
      slotOccupied[i] = false;
    }
    
    // Serial logging removed to reduce load, but can be re-enabled for debugging
  }
}

// Update LED indicators based on booking status
void updateLEDs() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(ledPins[i], slotBooked[i] ? HIGH : LOW);
  }
}

// HTML content split into parts
const char htmlPart1[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SmartPark</title>
<style>
/* --- Global Dark Mode Variables --- */
:root {
  --color-bg-dark: #121212;
  --color-bg-mid: #1e1e1e;
  --color-bg-light: #2d2d2d;
  --color-text-light: #e0e0e0;
  --color-text-primary: #ffffff;
  --color-border: #444444;
  --color-accent: #7c3aed; /* Purple */
}

*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  background:var(--color-bg-dark);
  height:100vh;
  overflow:hidden;
  color: var(--color-text-light); /* Default text color */
}

/* Reusable SVG Icon container */
.icon{display:inline-block;width:32px;height:32px;vertical-align:middle;color:var(--color-text-light)}
.icon svg{width:100%;height:100%;fill:currentColor;}

/* --- Login Page Styles (Dark) --- */
.login-container{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:var(--color-bg-dark);padding:20px}
.login-card{
  background:var(--color-bg-mid);
  border-radius:20px;
  padding:40px;
  box-shadow:0 10px 25px rgba(0,0,0,.5);
  max-width:400px;
  width:100%;
  text-align:center
}
.login-logo{margin-bottom:30px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:var(--color-text-primary)}
.login-logo-icon{width:32px;height:32px;margin-right:4px;color:var(--color-text-primary);}
.login-title{font-size:24px;font-weight:600;color:var(--color-text-primary);margin-bottom:10px}
.login-subtitle{font-size:14px;color:var(--color-text-light);margin-bottom:30px}
.login-input{
  width:100%;
  padding:14px 20px;
  border:2px solid var(--color-border);
  border-radius:12px;
  font-size:16px;
  margin-bottom:20px;
  transition:all .2s;
  background:var(--color-bg-light);
  color:var(--color-text-primary);
}
.login-input:focus{outline:none;border-color:var(--color-accent);box-shadow:0 0 0 4px rgba(124,58,237,.3)}

/* --- Main App Styles (Dark) --- */
.top-bar{
  background:var(--color-bg-mid);
  color:var(--color-text-primary);
  padding:0 40px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  height:64px;
  box-shadow:0 2px 4px rgba(0,0,0,.4);
  border-bottom: 1px solid var(--color-border);
}
.top-bar .logo{display:flex;align-items:center;gap:4px;font-size:18px;font-weight:600;color:var(--color-text-primary);}
.top-bar .logo-icon{width:24px;height:24px;color:var(--color-text-primary);}
.top-bar .logo-icon svg path{fill:currentColor;}
.user-info{display:flex;align-items:center;gap:16px;font-size:14px;color:var(--color-text-light);}
.logout-btn{color:var(--color-text-light);border:1px solid var(--color-border);padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:600;transition:all .2s;background:transparent}
.logout-btn:hover{background:var(--color-accent);color:var(--color-text-primary);border-color:var(--color-accent);}

.app-container{display:flex;height:calc(100vh - 64px)}
.sidebar{
  width:280px;
  background:var(--color-bg-mid);
  padding:24px;
  box-shadow:2px 0 12px rgba(0,0,0,.3);
  position:relative;
  height:100%;
  overflow-y:auto;
  border-right: 1px solid var(--color-border);
}
.nav-menu{list-style:none}
.nav-item{margin-bottom:8px}
.nav-link{
  display:flex;
  align-items:center;
  gap:12px;
  padding:14px 16px;
  border-radius:12px;
  color:var(--color-text-light);
  text-decoration:none;
  transition:all .2s;
  font-size:15px;
  cursor:pointer
}
.nav-link:hover{background:var(--color-bg-light);color:var(--color-text-primary)}
.nav-link.active{background:var(--color-accent);color:var(--color-text-primary);font-weight:600} 
.nav-link.active .nav-icon svg path{fill:var(--color-text-primary);}
.nav-icon{width:24px;height:24px;}
.nav-icon svg path{fill:currentColor;}

.main-content{flex:1;padding:32px 40px;overflow-y:auto;height:100%;background:var(--color-bg-dark)}
.page{display:none}
.page.active{display:block}
.page-header{margin-bottom:32px}
.page-title{font-size:32px;font-weight:700;color:var(--color-text-primary);margin-bottom:8px}
.page-subtitle{font-size:16px;color:var(--color-text-light)}

.parking-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:24px}
.parking-card{
  background:var(--color-bg-mid);
  border-radius:20px;
  padding:28px;
  box-shadow:0 2px 8px rgba(0,0,0,.2);
  transition:transform .2s,box-shadow .2s;
  position:relative;
  border:2px solid var(--color-border);
}
.parking-card:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,.4)}

/* Dark Theme Status Colors */
.parking-card.occupied{
  background:#331a1a; /* Dark Red */
  border-color:#883333;
}
.parking-card.empty{
  background:#1a331a; /* Dark Green */
  border-color:#338833;
}
.parking-card.booked{
  background:#1a1a33; /* Dark Blue */
  border-color:#333388;
}

.card-icon-wrapper{width:90px;height:90px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:48px}
.card-icon-wrapper svg{width:50px;height:50px;}

.occupied .card-icon-wrapper{background:#5c2424;color:#f87171}
.empty .card-icon-wrapper{background:#245c24;color:#4ade80}
.booked .card-icon-wrapper{background:#24245c;color:#93c5fd}

.slot-title{text-align:center;font-size:20px;font-weight:600;color:var(--color-text-primary);margin-bottom:12px}
.status-badge{display:block;text-align:center;padding:10px 20px;border-radius:24px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px; color: var(--color-text-primary);}

.status-occupied{background:#b91c1c; color: white;}
.status-empty{background:#059669; color: white;}
.status-booked{background:#2563eb; color: white;}

.section-title{font-size:20px;font-weight:600;color:var(--color-text-primary);margin-bottom:20px}

.booking-slots-grid{display:grid;grid-template-columns:repeat(4, 1fr);gap:20px;margin-bottom:48px}
.booking-slot-card{
  background:var(--color-bg-mid);
  border-radius:16px;
  padding:24px;
  text-align:center;
  cursor:pointer;
  transition:all .2s;
  border:2px solid var(--color-border);
  color: var(--color-text-light);
}
.booking-slot-card:hover:not(.disabled){transform:translateY(-2px);box-shadow:0 8px 16px rgba(0,0,0,.3)}
.booking-slot-card.available{background:#059669;color:var(--color-text-primary);border-color:#059669;}
.booking-slot-card.occupied{background:#b91c1c;color:var(--color-text-primary);cursor:not-allowed;border-color:#b91c1c;}
.booking-slot-card.your-booking{background:#2563eb;color:var(--color-text-primary);border-color:#2563eb;}
.booking-slot-card.disabled{opacity:.6;cursor:not-allowed;border-color:var(--color-border);}

.booking-card-icon{width:70px;height:70px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:36px;background:rgba(255,255,255,.2);color:inherit;}
.booking-card-icon svg{width:36px;height:36px;fill:currentColor}

.booking-card-title{font-size:18px;font-weight:600;margin-bottom:12px;color:inherit;}
.booking-card-status{display:inline-block;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;background:rgba(0,0,0,.2);color:inherit}

.bookings-container{background:var(--color-bg-mid);border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.empty-state{text-align:center;padding:60px 20px;color:var(--color-text-light)}
.empty-icon{font-size:72px;margin-bottom:16px;opacity:.5}
.empty-text{font-size:16px}
.booking-item{background:var(--color-bg-light);border-radius:12px;padding:20px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
.booking-info h3{font-size:18px;font-weight:600;color:var(--color-text-primary);margin-bottom:8px}
.booking-details{font-size:14px;color:var(--color-text-light);margin-bottom:4px}
.cancel-btn{padding:10px 24px;background:transparent;color:#f87171;border:2px solid #f87171;border-radius:8px;font-weight:600;cursor:pointer;transition:all .2s}
.cancel-btn:hover{background:#dc2626;color:var(--color-text-primary);border-color:#dc2626;}

.modal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:1000;align-items:center;justify-content:center;padding:20px}
.modal.active{display:flex}
.modal-content{background:var(--color-bg-mid);border-radius:20px;padding:32px;max-width:500px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5);position:relative}
.modal-close{position:absolute;top:20px;right:20px;font-size:24px;cursor:pointer;color:var(--color-text-light);width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;transition:all .2s}
.modal-close:hover{background:var(--color-bg-light);color:var(--color-text-primary)}
.modal-title{font-size:24px;font-weight:700;color:var(--color-text-primary);margin-bottom:24px}
.form-group{margin-bottom:20px}
.form-label{display:block;font-size:14px;font-weight:600;color:var(--color-text-light);margin-bottom:8px}
.form-input,.form-select{
  width:100%;
  padding:12px 16px;
  border:2px solid var(--color-border);
  border-radius:10px;
  font-size:15px;
  transition:all .2s;
  background:var(--color-bg-light);
  color:var(--color-text-primary);
}
.form-input:focus,.form-select:focus{outline:none;border-color:var(--color-accent);box-shadow:0 0 0 3px rgba(124,58,237,.3)}
.form-input:disabled{background:var(--color-bg-light);color:var(--color-text-light)}
.primary-btn{display:inline-block;padding:14px 28px;background:var(--color-accent);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;transition:all .2s;text-decoration:none;text-align:center;}
.primary-btn:hover{background:#6d28d9;transform:translateY(-2px);box-shadow:0 4px 12px rgba(124,58,237,.5)}
.primary-btn:disabled{background:#4b5563;cursor:not-allowed;transform:none}
@media (max-width:992px){
.booking-slots-grid{grid-template-columns:repeat(2, 1fr)}
}
@media (max-width:768px){
.top-bar{padding:0 20px;height:60px;}
.app-container{flex-direction:column;height:calc(100vh - 60px)}
.sidebar{width:100%;height:auto;position:relative;box-shadow:0 2px 8px rgba(0,0,0,.3);}
.main-content{margin-left:0;padding:20px;flex:1}
.parking-grid{grid-template-columns:1fr}
.booking-slots-grid{grid-template-columns:1fr}
}
</style>
</head>
<body>

<!-- Login Page -->
<div id="loginPage" class="login-container">
  <div class="login-card">
    <div class="login-logo">
      <div class="login-logo-icon">
        <!-- Main Logo Car SVG -->
        <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="currentColor">
          <path d="M240-200v40q0 17-11.5 28.5T200-120h-40q-17 0-28.5-11.5T120-160v-320l84-240q6-18 21.5-29t34.5-11h440q19 0 34.5 11t21.5 29l84 240v320q0 17-11.5 28.5T800-120h-40q-17 0-28.5-11.5T720-160v-40H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z"/>
        </svg>
      </div>
      <span class="logo-text-smart">Smart</span><span class="logo-text-park">Park.</span>
    </div>
    <h1 class="login-title">Welcome Back</h1>
    <p class="login-subtitle">Please enter your credentials to access the dashboard.</p>
    <form id="loginForm">
      <input type="email" id="userEmailInput" class="login-input" placeholder="Your Email Address" required>
      <!-- ADDED PASSWORD FIELD -->
      <input type="password" id="userPasswordInput" class="login-input" placeholder="Password" required>
      <button type="submit" class="primary-btn" style="width:100%;">Login to Dashboard</button>
    </form>
  </div>
</div>

<!-- Main Application Wrapper (Hidden initially) -->
<div id="mainApp" style="display:none;">

<header class="top-bar">
  <div class="logo">
    <div class="logo-icon">
        <!-- Header Logo Car SVG (same as login) -->
        <svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 -960 960 960" width="28px" fill="currentColor">
          <path d="M240-200v40q0 17-11.5 28.5T200-120h-40q-17 0-28.5-11.5T120-160v-320l84-240q6-18 21.5-29t34.5-11h440q19 0 34.5 11t21.5 29l84 240v320q0 17-11.5 28.5T800-120h-40q-17 0-28.5-11.5T720-160v-40H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z"/>
        </svg>
    </div>
    <span class="logo-text-smart">Smart</span><span class="logo-text-park">Park.</span>
  </div>
  <div class="user-info">
    <span id="headerUserEmail">Loading...</span>
    <button class="logout-btn" onclick="logout()">Logout</button>
  </div>
</header>

<div class="app-container">
<aside class="sidebar">
<nav>
<ul class="nav-menu">
<li class="nav-item"><a class="nav-link active" data-page="dashboard"><div class="nav-icon">
  <!-- Dashboard Icon -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/></svg>
</div><span>Dashboard</span></a></li>
<li class="nav-item"><a class="nav-link" data-page="booking"><div class="nav-icon">
  <!-- Booking Icon -->
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M680-80v-120H560v-80h120v-120h80v120h120v80H760v120h-80Zm-480-80q-33 0-56.5-23.5T120-240v-480q0-33 23.5-56.5T200-800h40v-80h80v80h240v-80h80v80h40q33 0 56.5 23.5T760-720v244q-20-3-40-3t-40 3v-84H200v320h280q0 20 3 40t11 40H200Zm0-480h480v-80H200v80Zm0 0v-80 80Z"/></svg>
</div><span>Booking</span></a></li>
</ul>
</nav>
</aside>
<main class="main-content">
<div id="dashboard" class="page active">
<div class="page-header">
<h1 class="page-title">Parking Monitor</h1>
<p class="page-subtitle" id="occupancyText">0/4 Occupied</p>
</div>
<div class="parking-grid" id="dashboardGrid"></div>
<button class="primary-btn" id="btnGoToBooking" style="margin-top: 32px; max-width: 200px;">Book a Slot</button>
</div>
<div id="booking" class="page">
<div class="page-header">
<h1 class="page-title">Book a Parking Slot</h1>
<p class="page-subtitle">Select an available slot to book</p>
</div>
<div class="slots-section">
<h2 class="section-title">Available Slots</h2>
<div class="booking-slots-grid" id="bookingSlotsGrid"></div>
</div>
<div class="slots-section">
<h2 class="section-title">Your Bookings</h2>
<div class="bookings-container" id="bookingsContainer">
<div class="empty-state">
<div class="empty-icon">
  <!-- Booking Icon for Empty State -->
  <svg xmlns="http://www.w3.org/2000/svg" height="64px" viewBox="0 -960 960 960" width="64px"><path d="M680-80v-120H560v-80h120v-120h80v120h120v80H760v120h-80Zm-480-80q-33 0-56.5-23.5T120-240v-480q0-33 23.5-56.5T200-800h40v-80h80v80h240v-80h80v80h40q33 0 56.5 23.5T760-720v244q-20-3-40-3t-40 3v-84H200v320h280q0 20 3 40t11 40H200Zm0-480h480v-80H200v80Zm0 0v-80 80Z"/></svg>
</div>
<div class="empty-text">No active bookings</div>
</div>
</div>
</div>
</div>
)rawliteral";

const char htmlPart2[] PROGMEM = R"rawliteral(
<!-- Booking Modal Structure (ADDED) -->
<div id="bookingModal" class="modal">
  <div class="modal-content">
    <span class="modal-close" onclick="closeBookingModal()">
        <!-- Close Icon -->
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
    </span>
    <h2 class="modal-title">Confirm Booking</h2>
    <form id="bookingForm" onsubmit="confirmBooking(event)">
      <div class="form-group">
        <label class="form-label" for="modalSlotNumber">Slot</label>
        <input type="text" id="modalSlotNumber" class="form-input" disabled>
      </div>
      <div class="form-group">
        <label class="form-label" for="modalUserEmail">User Email</label>
        <input type="email" id="modalUserEmail" class="form-input" disabled>
      </div>
      <div class="form-group">
        <label class="form-label" for="vehicleNumber">Vehicle Number (e.g., MH12AB5678)</label>
        <input type="text" id="vehicleNumber" class="form-input" placeholder="Enter vehicle number" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="bookingDateTime">Booking Start Time</label>
        <input type="datetime-local" id="bookingDateTime" class="form-input" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="duration">Duration (hours)</label>
        <select id="duration" class="form-select" required>
          <option value="1">1 Hour</option>
          <option value="2">2 Hours</option>
          <option value="4">4 Hours</option>
          <option value="8">8 Hours</option>
        </select>
      </div>
      <button type="submit" class="primary-btn" style="width:100%;">Book Slot</button>
    </form>
  </div>
</div>
<script>
const API_URL = window.location.origin;
let currentSlotToBook = null;
let bookingsData = []; 
let userEmail = localStorage.getItem('userEmail') || null;

// Reusable SVG Function for Car Icon
function getCarIcon(size = 24) {
  return `<svg xmlns="http://www.w3.org/2000/svg" height="${size}px" viewBox="0 -960 960 960" width="${size}px" fill="currentColor">
            <path d="M240-200v40q0 17-11.5 28.5T200-120h-40q-17 0-28.5-11.5T120-160v-320l84-240q6-18 21.5-29t34.5-11h440q19 0 34.5 11t21.5 29l84 240v320q0 17-11.5 28.5T800-120h-40q-17 0-28.5-11.5T720-160v-40H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z"/>
          </svg>`;
}

// --- Auth Functions ---
function initApp() {
  if (userEmail) {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('headerUserEmail').textContent = userEmail;
    fetchStatus();
    // Set a short interval for quick responsiveness to sensor changes
    setInterval(fetchStatus, 2000); 
  } else {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
  }
}

function handleLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById('userEmailInput');
  const passwordInput = document.getElementById('userPasswordInput'); // Get password input
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  // Simple email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('Please enter a valid email address.');
    return;
  }
  
  // Basic password validation (just check if it's not empty for this demo)
  if (password.length < 6) {
    console.error('Password must be at least 6 characters long.');
    return;
  }
  
  // *** In a real application, you would send email/password to a backend API for authentication. ***
  
  userEmail = email;
  localStorage.setItem('userEmail', email); // Use localStorage for persistence (for this demo)
  initApp();
}

function logout() {
  userEmail = null;
  localStorage.removeItem('userEmail');
  document.getElementById('headerUserEmail').textContent = 'Loading...';
  // Clear bookings in this simple example
  bookingsData = []; 
  initApp();
  // Reset the view to the login page
  document.querySelector('.nav-link[data-page="dashboard"]').click();
}

document.getElementById('loginForm').addEventListener('submit', handleLogin);
document.getElementById('btnGoToBooking').addEventListener('click', function() {
  document.querySelector('.nav-link[data-page="booking"]').click();
});

// --- Navigation & Status Fetching ---
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    const targetPage = this.getAttribute('data-page');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    this.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(targetPage).classList.add('active');
  });
});

async function fetchStatus() {
  try {
    const response = await fetch(`${API_URL}/api/status`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    updateDashboard(data);
    updateBookingPage(data);
  } catch(error) {
    console.error('Error fetching status:', error);
  }
}

function updateDashboard(data) {
  const grid = document.getElementById('dashboardGrid');
  grid.innerHTML = '';
  let occupiedCount = 0;
  
  data.slots.forEach((slot, index) => {
    if (slot.occupied) occupiedCount++;
    
    const card = document.createElement('div');
    let statusClass, statusText;
    
    if (slot.booked) {
      statusClass = 'booked';
      statusText = 'BOOKED';
    } else if (slot.occupied) {
      statusClass = 'occupied';
      statusText = 'OCCUPIED';
    } else {
      statusClass = 'empty';
      statusText = 'EMPTY';
    }
    
    card.className = `parking-card ${statusClass}`;
    // Car Icon size passed as 50 to match CSS
    card.innerHTML = `
      <div class="card-icon-wrapper">${getCarIcon(50)}</div>
      <div class="slot-title">Slot ${index + 1}</div>
      <span class="status-badge status-${statusClass}">${statusText}</span>
    `;
    grid.appendChild(card);
  });
  
  document.getElementById('occupancyText').textContent = `${occupiedCount}/4 Occupied`;
}

function updateBookingPage(data) {
  const grid = document.getElementById('bookingSlotsGrid');
  grid.innerHTML = '';
  
  data.slots.forEach((slot, index) => {
    const card = document.createElement('div');
    let statusClass, statusText;
    
    if (slot.booked) {
      statusClass = 'your-booking';
      statusText = 'YOUR BOOKING';
    } else if (slot.occupied) {
      statusClass = 'occupied';
      statusText = 'OCCUPIED';
    } else {
      statusClass = 'available';
      statusText = 'AVAILABLE';
    }
    
    card.className = `booking-slot-card ${statusClass}`;
    
    // Disable click if occupied, or if it's not one of the bookable slots (1 or 2)
    if (slot.occupied || index >= 2) {
      card.classList.add('disabled');
    }
    
    // Only slots 1 & 2 are bookable
    if (index >= 2) {
      statusText = 'SENSOR ONLY';
      card.querySelector('.booking-card-status').textContent = statusText;
    }
    
    // Car Icon size passed as 36 to match CSS
    card.innerHTML = `
      <div class="booking-card-icon">${getCarIcon(36)}</div>
      <div class="booking-card-title">Slot ${index + 1}</div>
      <span class="booking-card-status">${statusText}</span>
    `;
    
    // Only add click handler for available, bookable slots
    if (!slot.occupied && !slot.booked && index < 2) {
      card.onclick = () => openBookingModal(index + 1);
    }
    grid.appendChild(card);
  });
  
  updateBookingsList();
}

function updateBookingsList() {
  const container = document.getElementById('bookingsContainer');
  
  if (bookingsData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" height="64px" viewBox="0 -960 960 960" width="64px"><path d="M680-80v-120H560v-80h120v-120h80v120h120v80H760v120h-80Zm-480-80q-33 0-56.5-23.5T120-240v-480q0-33 23.5-56.5T200-800h40v-80h80v80h240v-80h80v80h40q33 0 56.5 23.5T760-720v244q-20-3-40-3t-40 3v-84H200v320h280q0 20 3 40t11 40H200Zm0-480h480v-80H200v80Zm0 0v-80 80Z"/></svg>
        </div>
        <div class="empty-text">No active bookings</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = bookingsData.map(booking => `
    <div class="booking-item">
      <div class="booking-info">
        <h3>Slot ${booking.slot}</h3>
        <div class="booking-details">${booking.vehicleNumber}</div>
        <div class="booking-details">Date: ${booking.date}</div>
        <div class="booking-details">Duration: ${booking.duration} hours</div>
      </div>
      <button class="cancel-btn" onclick="cancelBooking(${booking.slot})">Cancel</button>
    </div>
  `).join('');
}

function openBookingModal(slotNum) {
  currentSlotToBook = slotNum;
  document.getElementById('modalSlotNumber').value = `Slot ${slotNum}`;
  document.getElementById('modalUserEmail').value = userEmail; // Populate with logged-in email
  document.getElementById('bookingModal').classList.add('active');
  
  // Set default date/time to now
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); 
  document.getElementById('bookingDateTime').value = now.toISOString().slice(0, 16);
  
  // Clear old form data
  document.getElementById('vehicleNumber').value = '';
  document.getElementById('duration').value = '1';
}

function closeBookingModal() {
  document.getElementById('bookingModal').classList.remove('active');
  document.getElementById('bookingForm').reset();
}

async function confirmBooking(e) {
  e.preventDefault();
  
  const vehicle = document.getElementById('vehicleNumber').value.trim();
  const dateTime = new Date(document.getElementById('bookingDateTime').value);
  const duration = document.getElementById('duration').value;

  if (!vehicle || !dateTime) {
    console.error("Please fill in all fields.");
    return;
  }
  
  // Simple check for vehicle number format
  if (vehicle.length < 5) {
    console.error("Please enter a valid vehicle number.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: currentSlotToBook })
    });
    
    // Check for network errors first
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      // Add to our local bookings array
      bookingsData.push({
        slot: currentSlotToBook,
        vehicleNumber: vehicle,
        date: dateTime.toLocaleString(),
        duration: duration
      });
      
      updateBookingsList();
      closeBookingModal();
      fetchStatus(); 
      console.log('Booking confirmed successfully!');
    } else {
      console.error(result.message || 'Booking failed');
    }
  } catch(error) {
    console.error('Error confirming booking or network issue:', error);
    // Give user feedback on console
    console.error('A network or server error occurred. Please check ESP32 serial output.');
  }
}

async function cancelBooking(slotNum) {
  // Replaced confirm() with a console message
  console.warn('Attempting to cancel booking for slot:', slotNum);
  
  try {
    const response = await fetch(`${API_URL}/api/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: slotNum })
    });
    
    // Check for network errors first
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      // Remove from local bookings array
      bookingsData = bookingsData.filter(b => b.slot !== slotNum);
      
      updateBookingsList(); 
      fetchStatus(); 
      console.log('Booking cancelled successfully!');
    } else {
      console.error(result.message || 'Cancellation failed');
    }
  } catch(error) {
    console.error('Error canceling booking:', error);
    console.error('A network or server error occurred. Please check ESP32 serial output.');
  }
}

// Start the application state check
initApp();
</script>
</body>
</html>
)rawliteral";

// Serve main HTML page
void handleRoot() {
  // Combine the two parts into one string to send
  String html = String(htmlPart1) + String(htmlPart2);
  server.send(200, "text/html", html);
}

// API endpoint: Get current status
void handleStatus() {
  StaticJsonDocument<512> doc;
  JsonArray slots = doc.createNestedArray("slots");
  
  for (int i = 0; i < 4; i++) {
    JsonObject slot = slots.createNestedObject();
    slot["id"] = i + 1;
    slot["occupied"] = slotOccupied[i];
    slot["booked"] = (i < 2) ? slotBooked[i] : false; // Only slots 1 & 2 are bookable
  }
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

// API endpoint: Book a slot
void handleBook() {
  if (server.hasArg("plain")) {
    StaticJsonDocument<128> doc;
    DeserializationError error = deserializeJson(doc, server.arg("plain"));
    
    if (error) {
      // Log error to serial for debugging
      Serial.print("JSON Deserialization Error on Book: ");
      Serial.println(error.c_str());
      server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid JSON\"}");
      return;
    }
    
    int slot = doc["slot"];
    
    if (slot >= 1 && slot <= 2) {
      int index = slot - 1;
      
      if (slotBooked[index]) {
        server.send(200, "application/json", "{\"success\":false,\"message\":\"Slot already booked\"}");
      } else if (slotOccupied[index]) {
        server.send(200, "application/json", "{\"success\":false,\"message\":\"Slot currently occupied\"}");
      } else {
        slotBooked[index] = true;
        updateLEDs();
        server.send(200, "application/json", "{\"success\":true,\"message\":\"Slot booked successfully\"}");
      }
    } else {
      server.send(200, "application/json", "{\"success\":false,\"message\":\"Only slots 1 and 2 are bookable\"}");
    }
  } else {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid request\"}");
  }
}

// API endpoint: Cancel booking
void handleCancel() {
  if (server.hasArg("plain")) {
    StaticJsonDocument<128> doc;
    DeserializationError error = deserializeJson(doc, server.arg("plain"));
    
    if (error) {
      // Log error to serial for debugging
      Serial.print("JSON Deserialization Error on Cancel: ");
      Serial.println(error.c_str());
      server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid JSON\"}");
      return;
    }

    int slot = doc["slot"];
    
    if (slot >= 1 && slot <= 2) {
      int index = slot - 1;
      
      if(slotBooked[index]) {
        slotBooked[index] = false;
        updateLEDs();
        server.send(200, "application/json", "{\"success\":true,\"message\":\"Booking cancelled\"}");
      } else {
        server.send(200, "application/json", "{\"success\":false,\"message\":\"Slot was not booked\"}");
      }
    } else {
      server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid slot number\"}");
    }
  } else {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid request\"}");
  }
}