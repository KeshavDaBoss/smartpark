#include <ESP8266WiFi.h>
#include <WiFiClient.h>

// WiFi credentials (for connecting to your router - currently disabled)
const char* ssid = "Anil 2G";
const char* password = "Anil@1812";

// Create WiFi server on port 80
WiFiServer server(80);

// Sensor pins - 3 sensors configuration
const int TRIG_PINS[] = {5, 14, 12};  // D1, D5, D6
const int ECHO_PINS[] = {4, 16, 13};  // D2, D0, D7
const int NUM_SENSORS = 3;

// Detection threshold in cm
const int DISTANCE_THRESHOLD = 8;

// Store parking status (3 sensors)
bool parkingStatus[3] = {false, false, false};
int distances[3] = {0, 0, 0};

void setup() {
  Serial.begin(115200);
  delay(1000);  // Wait for boot to complete
  
  Serial.println("\n\nStarting Parking Sensor System...");
  
  // Initialize sensor pins - set TRIG low first
  for (int i = 0; i < NUM_SENSORS; i++) {
    pinMode(TRIG_PINS[i], OUTPUT);
    digitalWrite(TRIG_PINS[i], LOW);  // Ensure TRIG is LOW
    pinMode(ECHO_PINS[i], INPUT);
  }
  
  delay(100);  // Let pins stabilize
  
  // Create WiFi Access Point with custom name
  Serial.println("Creating WiFi Access Point...");
  WiFi.mode(WIFI_AP);
  WiFi.softAP("SmartPark", "SmartPark");  // SSID: SmartPark, Password: SmartPark
  
  // Set custom hostname (for mDNS)
  WiFi.hostname("smartpark");
  
  IPAddress IP = WiFi.softAPIP();
  Serial.println("Access Point Created!");
  Serial.println("SSID: SmartPark");
  Serial.println("Password: SmartPark");
  Serial.print("IP address: ");
  Serial.println(IP);
  Serial.println("\nConnect your phone/laptop to 'SmartPark' WiFi");
  Serial.println("Then open browser and go to:");
  Serial.println("  http://192.168.4.1");
  Serial.println("  or http://smartpark.local (may work on some devices)");
  
  // Start server
  server.begin();
  Serial.println("\nHTTP server started");
}

void loop() {
  // Read all sensors and print status
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 1000) {  // Print every 1 second
    Serial.println("\n--- Sensor Readings ---");
    for (int i = 0; i < NUM_SENSORS; i++) {
      distances[i] = readUltrasonicDistance(i);
      parkingStatus[i] = (distances[i] > 0 && distances[i] <= DISTANCE_THRESHOLD);
      
      Serial.print("Slot ");
      Serial.print(i + 1);
      Serial.print(": ");
      Serial.print(distances[i]);
      Serial.print(" cm - ");
      Serial.println(parkingStatus[i] ? "OCCUPIED" : "EMPTY");
    }
    lastPrint = millis();
  }
  
  // Handle client requests
  WiFiClient client = server.available();
  if (client) {
    Serial.println("\n>>> CLIENT CONNECTED!");
    Serial.print(">>> Client IP: ");
    Serial.println(client.remoteIP());
    
    String request = "";
    unsigned long timeout = millis() + 5000;  // 5 second timeout
    
    while (client.connected() && millis() < timeout) {
      if (client.available()) {
        char c = client.read();
        Serial.print(c);  // Print every character received
        request += c;
        
        if (c == '\n' && request.endsWith("\r\n\r\n")) {
          Serial.println("\n>>> REQUEST COMPLETE");
          
          // Send response immediately
          if (request.indexOf("GET /status") >= 0) {
            Serial.println(">>> Sending JSON");
            sendStatusJSON(client);
          } else if (request.indexOf("GET /test") >= 0) {
            Serial.println(">>> Sending TEST page");
            client.println("HTTP/1.1 200 OK");
            client.println("Content-Type: text/html");
            client.println();
            client.println("<h1>ESP8266 Works!</h1>");
          } else {
            Serial.println(">>> Sending HTML");
            sendHTMLPage(client);
          }
          break;
        }
      }
    }
    
    if (millis() >= timeout) {
      Serial.println(">>> TIMEOUT!");
    }
    
    client.flush();
    delay(10);
    client.stop();
    Serial.println(">>> DISCONNECTED\n");
  }
}

// Read distance from ultrasonic sensor
int readUltrasonicDistance(int sensorIndex) {
  // Clear the trigger pin
  digitalWrite(TRIG_PINS[sensorIndex], LOW);
  delayMicroseconds(2);
  
  // Send 10us pulse
  digitalWrite(TRIG_PINS[sensorIndex], HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PINS[sensorIndex], LOW);
  
  // Read echo pin
  long duration = pulseIn(ECHO_PINS[sensorIndex], HIGH, 30000);  // 30ms timeout
  
  // Calculate distance in cm
  int distance = duration * 0.034 / 2;
  
  // Return 0 if no valid reading
  if (distance == 0 || distance > 400) {
    return 0;
  }
  
  return distance;
}

// Send HTML page - optimized and compact
void sendHTMLPage(WiFiClient &client) {
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/html");
  client.println("Connection: close");
  client.println();
  
  client.print("<!DOCTYPE html><html><head><title>Parking</title><meta name='viewport' content='width=device-width,initial-scale=1'><style>");
  client.print("body{font-family:Arial;margin:20px;background:#f0f0f0}h1{color:#333;text-align:center}.container{max-width:800px;margin:0 auto}");
  client.print(".slot{background:#fff;padding:20px;margin:10px 0;border-radius:10px;box-shadow:0 2px 5px rgba(0,0,0,0.1);display:flex;justify-content:space-between;align-items:center}");
  client.print(".slot-name{font-size:24px;font-weight:bold}.status{padding:10px 20px;border-radius:5px;font-weight:bold;font-size:18px}");
  client.print(".occupied{background:#f44;color:#fff}.empty{background:#4f4;color:#000}");
  client.print("</style></head><body><div class='container'><h1>SmartPark</h1>");
  
  for (int i = 0; i < NUM_SENSORS; i++) {
    client.print("<div class='slot'><div><span class='slot-name'>Slot ");
    client.print(i + 1);
    client.print("</span><br><small id='d");
    client.print(i + 1);
    client.print("'>--</small></div><div class='status' id='s");
    client.print(i + 1);
    client.print("'>...</div></div>");
  }
  
  client.print("</div><script>function u(){fetch('/status').then(r=>r.json()).then(d=>{for(let i=0;i<");
  client.print(NUM_SENSORS);
  client.print(";i++){let s=document.getElementById('s'+(i+1));let dist=document.getElementById('d'+(i+1));");
  client.print("if(d.slots[i].occupied){s.textContent='OCCUPIED';s.className='status occupied'}");
  client.print("else{s.textContent='EMPTY';s.className='status empty'}");
  client.print("dist.textContent=d.slots[i].distance+' cm'}})}setInterval(u,1000);u()</script></body></html>");
}

// Send JSON status
void sendStatusJSON(WiFiClient &client) {
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: application/json");
  client.println("Connection: close");
  client.println();
  
  client.print("{\"slots\":[");
  
  for (int i = 0; i < NUM_SENSORS; i++) {
    if (i > 0) client.print(",");
    client.print("{");
    client.print("\"slot\":");
    client.print(i + 1);
    client.print(",\"occupied\":");
    client.print(parkingStatus[i] ? "true" : "false");
    client.print(",\"distance\":");
    client.print(distances[i]);
    client.print("}");
  }
  
  client.println("]}");
}