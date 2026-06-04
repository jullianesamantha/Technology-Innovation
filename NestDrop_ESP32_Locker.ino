#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>

const char* ssid = "Julliane";
const char* password = "109876542";

const char* BACKEND_BASE_URL = "http://172.20.10.3:3000";
const String LOCKER_ID = "APT1204";

Servo lockServo;

const int servoPin = 13;
const int lockedPosition = 90;
const int unlockedPosition =0;

void lockLocker() {
  lockServo.write(lockedPosition);
  Serial.println("Locker locked");
}

void unlockLocker() {
  lockServo.write(unlockedPosition);
  Serial.println("Locker unlocked");

  notifyBackendUnlocked();

  delay(5000);

  lockLocker();
}

void notifyBackendUnlocked() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(BACKEND_BASE_URL) + "/api/locker/" + LOCKER_ID + "/unlocked";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  int responseCode = http.POST("{}");

  Serial.print("Unlock confirmation response: ");
  Serial.println(responseCode);

  http.end();
}

String getCommandFromBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    return "none";
  }

  HTTPClient http;
  String url = String(BACKEND_BASE_URL) + "/api/locker/" + LOCKER_ID + "/command";

  http.begin(url);

  int responseCode = http.GET();
  String payload = "";

  if (responseCode > 0) {
    payload = http.getString();
  }

  http.end();

  Serial.print("Backend response: ");
  Serial.println(payload);

  if (payload.indexOf("\"command\":\"unlock\"") >= 0) {
    return "unlock";
  }

  return "none";
}

void setup() {
  Serial.begin(115200);

  lockServo.attach(servoPin, 500, 2400);
  lockLocker();

  Serial.println("Connecting to hotspot...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("Connected to hotspot!");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  String command = getCommandFromBackend();

  if (command == "unlock") {
    unlockLocker();
  }

  delay(1000);
}