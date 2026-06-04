/* Standalone version: no backend. Phone scans QR -> ESP32 webpage -> Unlock button -> servo opens. */
#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>
const char* WIFI_SSID="YOUR_WIFI_NAME";
const char* WIFI_PASSWORD="YOUR_WIFI_PASSWORD";
WebServer server(80); Servo lockServo;
const int SERVO_PIN=18, LED_PIN=2, LOCKED_POSITION=0, UNLOCKED_POSITION=90; bool isUnlocked=false;
void lockDoor(){ lockServo.write(LOCKED_POSITION); digitalWrite(LED_PIN,LOW); isUnlocked=false; }
void unlockDoor(){ lockServo.write(UNLOCKED_POSITION); digitalWrite(LED_PIN,HIGH); isUnlocked=true; delay(5000); lockDoor(); }
String webpage(){ String html="<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'><title>NestDrop Locker</title><style>body{font-family:Arial;background:#eef3f8;text-align:center;padding:30px;color:#10233f}.card{background:white;border-radius:25px;padding:30px;max-width:400px;margin:auto;box-shadow:0 10px 30px #ccc}button{background:#0b5fcc;color:white;border:none;padding:18px 30px;border-radius:15px;font-size:18px;font-weight:bold}</style></head><body><div class='card'><h1>NestDrop</h1><p>Smart Delivery Locker Access</p><p>Status: <strong>"; html += isUnlocked?"Unlocked":"Locked"; html += "</strong></p><form action='/unlock' method='POST'><button type='submit'>Unlock Locker</button></form><p style='font-size:12px;color:gray;margin-top:20px;'>Temporary courier access page</p></div></body></html>"; return html; }
void handleHome(){ server.send(200,"text/html",webpage()); }
void handleUnlock(){ server.send(200,"text/html","<h2>Locker unlocked. It will lock again automatically.</h2><a href='/'>Back</a>"); unlockDoor(); }
void setup(){ Serial.begin(115200); pinMode(LED_PIN,OUTPUT); lockServo.attach(SERVO_PIN); lockDoor(); WiFi.begin(WIFI_SSID,WIFI_PASSWORD); Serial.println("Connecting to WiFi..."); while(WiFi.status()!=WL_CONNECTED){ delay(500); Serial.print("."); } Serial.println(); Serial.print("Open this IP address: "); Serial.println(WiFi.localIP()); server.on("/",handleHome); server.on("/unlock",HTTP_POST,handleUnlock); server.begin(); }
void loop(){ server.handleClient(); }
