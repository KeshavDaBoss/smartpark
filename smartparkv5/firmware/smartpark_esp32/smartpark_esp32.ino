#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // Make sure to install ArduinoJson library

// --- Configuration ---
const char* ssid = "Anil 2G";
const char* password = "Anil@1812";
const char* serverUrl = "http://192.168.1.134:8000/sensor/esp32"; // Host is Raspberry Pi

// --- Pinout (Mall 2) ---
// Slot 1 (Bookable), Slot 2 (Bookable), Slot 3 (Normal), Slot 4 (Normal)
const int trigPins[] = {13, 12, 14, 27};
const int echoPins[] = {33, 32, 35, 34};
// LEDs for Slot 1 and Slot 2
const int ledPins[] = {25, 26}; 

// Constants
const int numSensors = 4;
const int numLeds = 2; // Only first 2 slots have LEDs

void setup() {
  Serial.begin(115200);
  
  // Setup Pins
  for (int i = 0; i < numSensors; i++) {
    pinMode(trigPins[i], OUTPUT);
    pinMode(echoPins[i], INPUT);
  }
  
  for (int i = 0; i < numLeds; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }

  // Connect to WiFi
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Read Sensors
  float distances[numSensors];
  for (int i = 0; i < numSensors; i++) {
    distances[i] = readDistance(trigPins[i], echoPins[i]);
    delay(10); // Small delay between reads to avoid interference
  }

  // Send Data to Server
  sendData(distances);

  // Note: LED control for ESP32 slots happens here?
  // The architecture plan says "Pi Server combines data...". 
  // Code Logic: The Server KNOWS if a slot is booked.
  // The Server needs to tell ESP32 to turn on LEDs or not.
  // Currently `sendData` is a POST. We should check the RESPONSE for LED status.
  // The server implementation currently returns {"status": "ok"}. 
  // I should update it to return LED states for these slots if I want ESP32 to control LEDs based on bookings.
  // BUT: The user requirement: "The booked slot's LED lights up when booked".
  // If the logic is on the server, the server must tell ESP32.
  // I will add a TODO in Verification to update Server response, or just leave as is if user didn't explicitly ask for bidirectional LED control on ESP32 (though it's implied).
  // Actually, "Mall 2 with ESP... Only 4 slots bookable (2 in Mall 2... The booked slot's LED lights up)".
  // Yes, ESP32 LEDs MUST light up.
  // I will update the sketch to parse response.

  delay(1000); // 1 Second Loop
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected.");
}

float readDistance(int trig, int echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  
  long duration = pulseIn(echo, HIGH, 30000); // 30ms timeout (approx 5m)
  if (duration == 0) return 999.0; // Out of range
  
  // Calculate distance in cm
  return duration * 0.034 / 2;
}

void sendData(float distances[]) {
  // Use WiFiClient class to create TCP connection
  WiFiClient client;
  HTTPClient http;

  // Use the new signature: begin(client, url)
  http.begin(client, serverUrl);
  http.addHeader("Content-Type", "application/json");

  // Create JSON Payload
  // Using DynamicJsonDocument to be safe or Static with enough buffer
  StaticJsonDocument<512> doc; // Increased size
  JsonArray distArray = doc.createNestedArray("distances");
  for (int i = 0; i < numSensors; i++) {
    distArray.add(distances[i]);
  }
  doc["source"] = "esp32_mall2";
  
  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("Response: ");
    Serial.println(response); // Debug

    // Parse Response
    StaticJsonDocument<200> respDoc;
    DeserializationError error = deserializeJson(respDoc, response);

    if (!error) {
      JsonArray leds = respDoc["leds"];
      if (!leds.isNull()) {
        for (int i = 0; i < numLeds && i < leds.size(); i++) {
          bool state = leds[i];
          digitalWrite(ledPins[i], state ? HIGH : LOW);
        }
      }
    } else {
      Serial.print("JSON Parse Error: ");
      Serial.println(error.c_str());
    }
  } else {
    Serial.print("Error on sending POST: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}
