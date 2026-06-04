# NestDrop Full Prototype Code

This pack contains all code needed for the simple NestDrop prototype:

1. Tenant app
2. Delivery worker website
3. Backend server
4. ESP32 servo-lock code

## System Flow
Tenant app creates PIN → Driver website verifies PIN → Driver presses Open Locker → Backend sends unlock command → ESP32 reads command → Servo unlocks locker → Driver completes delivery.

## Run Backend
Open terminal inside `backend`:

```bash
npm install
npm start
```

Open tenant app:

```text
http://localhost:3000/tenant.html
```

For phone/ESP32 testing, use your laptop IP:

```bash
set PUBLIC_BASE_URL=http://192.168.0.25:3000
npm start
```

Mac/Linux:

```bash
PUBLIC_BASE_URL=http://192.168.0.25:3000 npm start
```

## ESP32 Setup
Use Arduino IDE. Install:
- ESP32 board support
- ESP32Servo library

Open:

```text
esp32/NestDrop_ESP32_Locker.ino
```

Change:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BACKEND_BASE_URL = "http://192.168.0.25:3000";
```

## Wiring
Servo brown/black -> external GND
Servo red -> external 5V
Servo yellow/orange -> ESP32 GPIO 18
ESP32 GND -> external GND

Do not power the servo from ESP32 3.3V.

## Demo Order
1. Run backend.
2. Open `http://localhost:3000/tenant.html`.
3. Generate PIN.
4. Open driver website.
5. Enter PIN.
6. Press Open Locker.
7. ESP32 servo unlocks.
8. Press Complete Delivery.
9. Tenant app shows delivery history.

## Easier Version
Use `esp32/NestDrop_ESP32_Standalone_WebUnlock.ino` if you want only ESP32 webpage unlock without backend.
