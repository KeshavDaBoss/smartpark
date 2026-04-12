#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const int trig1 = 2;
const int echo1 = 3;
const int trig2 = 4;
const int echo2 = 5;

String slot1State = "FREE";
String slot2State = "FREE";

// store last stable change
unsigned long slot1Timer = 0;
unsigned long slot2Timer = 0;

const int THRESHOLD = 5;      // cm
const int STABLE_TIME = 3000; // 3 seconds stability

// LCD
LiquidCrystal_I2C lcd(0x27, 16, 2);
String lastLCDLine = ""; // store last displayed state

void setup() {
  Serial.begin(9600);
  pinMode(trig1, OUTPUT);
  pinMode(echo1, INPUT);
  pinMode(trig2, OUTPUT);
  pinMode(echo2, INPUT);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("SmartPark Ready");
  delay(1500);
  lcd.clear();
}

void loop() {
  long dist1 = getDistance(trig1, echo1);
  long dist2 = getDistance(trig2, echo2);

  // --- Slot 1 ---
  if (dist1 > 0 && dist1 <= THRESHOLD) {
    if (slot1State == "FREE") {
      if (millis() - slot1Timer > STABLE_TIME) {
        slot1State = "OCCUPIED";
      }
    }
  } else {
    if (slot1State == "OCCUPIED") {
      if (millis() - slot1Timer > STABLE_TIME) {
        slot1State = "FREE";
      }
    }
  }
  if ((dist1 > 0 && dist1 <= THRESHOLD) != (slot1State == "OCCUPIED")) {
    slot1Timer = millis();
  }

  // --- Slot 2 ---
  if (dist2 > 0 && dist2 <= THRESHOLD) {
    if (slot2State == "FREE") {
      if (millis() - slot2Timer > STABLE_TIME) {
        slot2State = "OCCUPIED";
      }
    }
  } else {
    if (slot2State == "OCCUPIED") {
      if (millis() - slot2Timer > STABLE_TIME) {
        slot2State = "FREE";
      }
    }
  }
  if ((dist2 > 0 && dist2 <= THRESHOLD) != (slot2State == "OCCUPIED")) {
    slot2Timer = millis();
  }

  // --- Serial output ---
  String output = "SLOT1:" + slot1State + "  |  SLOT2:" + slot2State;
  Serial.println(output);

  // --- LCD output (only update if changed) ---
  if (output != lastLCDLine) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Slot1: " + slot1State);
    lcd.setCursor(0, 1);
    lcd.print("Slot2: " + slot2State);
    lastLCDLine = output;
  }

  delay(300);
}

long getDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout
  if (duration == 0) return -1; 
  return duration * 0.034 / 2;
}
