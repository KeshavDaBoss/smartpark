#include <WiFi.h>
#include <HTTPClient.h>

#define SPEED_OF_SOUND 0.034
#define DISTANCE_THRESHOLD 5

// WiFi
const char* ssid = "Anil 2G";
const char* password = "Anil@1812";
const char* serverBase = "http://192.168.1.219:3000";

// Networking
WiFiClient client;

// Pins
const int trigPins[] = {13, 12, 14, 27};
const int echoPins[] = {33, 32, 35, 34};
const int ledPins[]  = {25, 26};
const char* slotIds[] = {"A1", "A2", "A3", "A4"};

bool bookedSlots[] = {false, false, false, false};

long readDistanceCM(int trig, int echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);

  long duration = pulseIn(echo, HIGH, 30000);
  if (duration == 0) return -1;
  return (duration * SPEED_OF_SOUND) / 2;
}

void testInternet() {
  Serial.println("Testing internet access...");
  HTTPClient http;
  http.begin(client, "http://example.com");
  int code = http.GET();
  Serial.print("example.com HTTP code: ");
  Serial.println(code);
  http.end();
}

void sendOccupancy(const char* slot, bool occupied) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(serverBase) + "/update";

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  String body =
    "{\"slot\":\"" + String(slot) +
    "\",\"occupied\":" + String(occupied ? 1 : 0) + "}";

  int code = http.POST(body);

  Serial.print("POST ");
  Serial.print(slot);
  Serial.print(" -> ");
  Serial.println(code);

  http.end();
}

void fetchBookings() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(serverBase) + "/bookings";

  http.begin(client, url);
  int code = http.GET();

  Serial.print("GET /bookings -> ");
  Serial.println(code);

  if (code == 200) {
    String payload = http.getString();
    bookedSlots[0] = payload.indexOf("\"A1\":1") > -1;
    bookedSlots[1] = payload.indexOf("\"A2\":1") > -1;
    bookedSlots[2] = payload.indexOf("\"A3\":1") > -1;
    bookedSlots[3] = payload.indexOf("\"A4\":1") > -1;
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  for (int i = 0; i < 4; i++) {
    pinMode(trigPins[i], OUTPUT);
    pinMode(echoPins[i], INPUT);
  }

  for (int i = 0; i < 2; i++) {
    pinMode(ledPins[i], OUTPUT);
    digitalWrite(ledPins[i], LOW);
  }

  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  testInternet();

  Serial.println("ESP32 SmartPark V4 ONLINE");
}

void loop() {
  fetchBookings();

  for (int i = 0; i < 4; i++) {
    long d = readDistanceCM(trigPins[i], echoPins[i]);
    bool occupied = (d > 0 && d <= DISTANCE_THRESHOLD);

    sendOccupancy(slotIds[i], occupied);

    if (i < 2) {
      digitalWrite(ledPins[i], bookedSlots[i] ? HIGH : LOW);
    }

    delay(1000);
  }
}
