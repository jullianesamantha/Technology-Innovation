const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;

// Your laptop/server IP on the phone hotspot
const PUBLIC_BASE_URL = "http://172.20.10.3:3000";

app.use(cors());
app.use(express.json());

// Serves tenant.html and driver.html from the web folder
app.use(express.static(path.join(__dirname, "..", "web")));

// Temporary in-memory database
const lockers = {
  APT1204: {
    lockerId: "APT1204",
    unit: "1204",
    status: "locked",
    currentAccess: null,
    unlockRequested: false,
    deliveryHistory: [],
  },
};

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function generateAccessCode() {
  return "KD-" + Math.floor(100000 + Math.random() * 900000).toString();
}

function isExpired(access) {
  return !access || Date.now() > access.expiresAt;
}

function findLockerByAccessCode(accessCode) {
  return Object.values(lockers).find(
    (locker) =>
      locker.currentAccess &&
      locker.currentAccess.accessCode === accessCode
  );
}

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "NestDrop backend is running",
    tenantApp: `${PUBLIC_BASE_URL}/tenant.html`,
    driverPage: `${PUBLIC_BASE_URL}/driver.html`,
  });
});

// Create temporary courier access
app.post("/api/access/create", (req, res) => {
  const { lockerId = "APT1204", deliveryType = "parcel" } = req.body;

  const locker = lockers[lockerId];

  if (!locker) {
    return res.status(404).json({
      success: false,
      error: "Locker not found",
    });
  }

  const pin = generatePin();
  const accessCode = generateAccessCode();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  const access = {
    accessCode,
    pin,
    lockerId,
    unit: locker.unit,
    deliveryType,
    status: "active",
    createdAt: new Date().toISOString(),
    expiresAt,
  };

  locker.currentAccess = access;
  locker.unlockRequested = false;
  locker.status = "locked";

  const korean = `배송 물품은 NestDrop 스마트 보관함에 넣어주세요. 임시 비밀번호는 ${pin}입니다. 15분 동안만 유효합니다.`;
  const english = `Please place the delivery in the NestDrop locker. Temporary PIN: ${pin}. Valid for 15 minutes.`;

  res.json({
    success: true,
    access,
    courierMessage: {
      korean,
      english,
    },
    driverUrl: `${PUBLIC_BASE_URL}/driver.html?accessCode=${accessCode}`,
  });
});

// Verify driver PIN
app.post("/api/access/verify", (req, res) => {
  const { accessCode, pin } = req.body;

  const locker = findLockerByAccessCode(accessCode);

  if (!locker || !locker.currentAccess) {
    return res.status(404).json({
      success: false,
      error: "Access code not found",
    });
  }

  if (isExpired(locker.currentAccess)) {
    locker.currentAccess.status = "expired";

    return res.status(403).json({
      success: false,
      error: "Access has expired",
    });
  }

  if (locker.currentAccess.pin !== String(pin)) {
    return res.status(401).json({
      success: false,
      error: "Invalid PIN",
    });
  }

  locker.currentAccess.status = "verified";

  res.json({
    success: true,
    message: "PIN verified. Delivery access approved.",
    locker: {
      lockerId: locker.lockerId,
      unit: locker.unit,
      status: locker.status,
      allowedArea: "Building entrance to assigned unit locker only",
      validFor: "15 minutes",
    },
  });
});

// Driver requests locker unlock
app.post("/api/locker/unlock-request", (req, res) => {
  const { accessCode } = req.body;

  const locker = findLockerByAccessCode(accessCode);

  if (!locker || !locker.currentAccess) {
    return res.status(404).json({
      success: false,
      error: "Access code not found",
    });
  }

  if (isExpired(locker.currentAccess)) {
    locker.currentAccess.status = "expired";

    return res.status(403).json({
      success: false,
      error: "Access has expired",
    });
  }

  if (locker.currentAccess.status !== "verified") {
    return res.status(403).json({
      success: false,
      error: "PIN must be verified first",
    });
  }

  locker.unlockRequested = true;
  locker.status = "unlock_requested";

  res.json({
    success: true,
    message: "Unlock request sent to ESP32",
    lockerId: locker.lockerId,
  });
});

// ESP32 checks this endpoint repeatedly
app.get("/api/locker/:lockerId/command", (req, res) => {
  const { lockerId } = req.params;
  const locker = lockers[lockerId];

  if (!locker) {
    return res.status(404).json({
      command: "none",
      error: "Locker not found",
    });
  }

  if (locker.unlockRequested) {
    return res.json({
      command: "unlock",
      lockerId: locker.lockerId,
    });
  }

  res.json({
    command: "none",
    lockerId: locker.lockerId,
  });
});

// ESP32 confirms it unlocked
app.post("/api/locker/:lockerId/unlocked", (req, res) => {
  const { lockerId } = req.params;
  const locker = lockers[lockerId];

  if (!locker) {
    return res.status(404).json({
      success: false,
      error: "Locker not found",
    });
  }

  locker.unlockRequested = false;
  locker.status = "unlocked";

  res.json({
    success: true,
    message: "Locker unlock confirmed",
    lockerId: locker.lockerId,
  });
});

// Driver completes delivery
app.post("/api/delivery/complete", (req, res) => {
  const { accessCode } = req.body;

  const locker = findLockerByAccessCode(accessCode);

  if (!locker || !locker.currentAccess) {
    return res.status(404).json({
      success: false,
      error: "Access code not found",
    });
  }

  const delivery = {
    accessCode,
    lockerId: locker.lockerId,
    unit: locker.unit,
    deliveryType: locker.currentAccess.deliveryType,
    completedAt: new Date().toISOString(),
    status: "delivered",
  };

  locker.deliveryHistory.unshift(delivery);
  locker.status = "locked";
  locker.unlockRequested = false;
  locker.currentAccess.status = "completed";
  locker.currentAccess = null;

  res.json({
    success: true,
    message: "Delivery completed and locker locked",
    delivery,
  });
});

// Tenant app checks locker status/history
app.get("/api/locker/:lockerId/status", (req, res) => {
  const { lockerId } = req.params;
  const locker = lockers[lockerId];

  if (!locker) {
    return res.status(404).json({
      success: false,
      error: "Locker not found",
    });
  }

  res.json({
    success: true,
    lockerId: locker.lockerId,
    unit: locker.unit,
    status: locker.status,
    currentAccess: locker.currentAccess,
    deliveryHistory: locker.deliveryHistory,
  });
});

// Important: 0.0.0.0 lets phone + ESP32 access the server
app.listen(PORT, "0.0.0.0", () => {
  console.log("NestDrop backend running!");
  console.log(`Backend: ${PUBLIC_BASE_URL}`);
  console.log(`Tenant app: ${PUBLIC_BASE_URL}/tenant.html`);
  console.log(`Driver page: ${PUBLIC_BASE_URL}/driver.html`);
});