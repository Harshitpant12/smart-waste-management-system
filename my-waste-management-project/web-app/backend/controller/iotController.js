// const mqtt = require("mqtt");
// const fs = require("fs");

// // AWS IoT configuration
// const awsIotEndpoint = process.env.AWS_MQTT_END_POINT;
// const awsIotTopic = "3yp/Area001/Bin_001";
// const clientId = "mqqt-client-001";

// const mqttClient = mqtt.connect(awsIotEndpoint, {
//   clientId: clientId,
//   clean: true,
//   // Add your AWS IoT certificate options here
//   key: fs.readFileSync("./controller/cert/private.pem.key"),
//   cert: fs.readFileSync("./controller/cert/client-certificate.pem.crt"),
//   ca: fs.readFileSync("./controller/cert/AmazonRootCA1.pem"),
// });

// let latestMqttData = null;

// mqttClient.on("connect", () => {
//   console.log("Connected to MQTT broker");
//   mqttClient.subscribe(awsIotTopic, (err) => {
//     if (!err) {
//       console.log(`Subscribed to topic: ${awsIotTopic}`);
//     }
//   });
// });

// mqttClient.on("message", (topic, message) => {
//   const payload = message.toString();
//   console.log(`Received message on topic '${topic}': ${payload}`);
//   // Update latestMqttData
//   try {
//     latestMqttData = JSON.parse(payload);
//     // console.log("mqqt data", latestMqttData);
//   } catch (error) {
//     console.error("Error parsing MQTT payload as JSON:", error);
//     return;
//   }
// });

// // Function to get the latest MQTT data
// const getLatestMqttData = () => {
//   return latestMqttData;
// };

// module.exports = {
//   getLatestMqttData,
// };

// backend/controller/iotController.js
const mqtt = require('mqtt');
const fs = require('fs');
const url = require('url');

const awsIotEndpoint = process.env.AWS_MQTT_END_POINT || '';
const awsIotTopic = process.env.AWS_MQTT_TOPIC || '3yp/Area001/Bin_001';
const clientId = process.env.AWS_MQTT_CLIENT_ID || 'mqqt-client-001';

let mqttClient = null;
let latestMqttData = null;

// In-memory bins store (used for simulation and frontend editing)
// default bin height (cm) used for converting raw distance to percent
const DEFAULT_BIN_HEIGHT = 38;
let bins = [
  { id: 'Bin_001', filled_level: 10, temperature: 25, latitude: 29.0, longitude: 80.0, height: DEFAULT_BIN_HEIGHT },
  { id: 'Bin_002', filled_level: 40, temperature: 27, latitude: 29.01, longitude: 80.01, height: DEFAULT_BIN_HEIGHT },
  { id: 'Bin_003', filled_level: 75, temperature: 29, latitude: 28.99, longitude: 79.99, height: DEFAULT_BIN_HEIGHT },
];

// helper to validate endpoint string
const isLikelyHostname = (s) => {
  if (!s) return false;
  try {
    const parsed = new url.URL(s.includes('://') ? s : `mqtts://${s}`);
    return !!parsed.hostname;
  } catch (err) {
    return false;
  }
};

// helper to compute percentage when we are given a raw distance
const computeFilledPercent = (value, height) => {
  if (value === null || value === undefined) return null;
  const v = Number(value);
  if (Number.isNaN(v)) return null;
  // if value seems like a percent (0-100) assume it's already percent
  if (v >= 0 && v <= 100) return Math.round(v);
  // otherwise treat value as distance in cm: percent = ((height - distance) / height) * 100
  const h = Number(height) || DEFAULT_BIN_HEIGHT;
  const percent = Math.round(((h - v) / h) * 100);
  return Math.max(0, Math.min(100, percent));
};

// helper to emit standardized mqttData to frontend via socket.io (if available)
const emitMqttData = (binObj) => {
  if (!binObj) return;
  const rawDistance = binObj.filledLevel ?? null; // hardware might populate camelCase
  const percentFromSnake = binObj.filled_level ?? null; // admin/backends use snake case percent
  const heightForBin = binObj.height ?? DEFAULT_BIN_HEIGHT;
  const percent = percentFromSnake !== null && percentFromSnake !== undefined
    ? Number(percentFromSnake)
    : computeFilledPercent(rawDistance ?? binObj.filled_level ?? null, heightForBin);

  const payload = {
    binId: binObj.id ?? binObj.binId ?? null,
    // populate both camelCase & snake_case with PERCENT (0-100)
    filledLevel: percent,
    filled_level: percent,
    // expose raw distance as `distance` if provided
    distance: rawDistance ?? null,
    temperature: binObj.temperature ?? null,
    latitude: binObj.latitude ?? null,
    longitude: binObj.longitude ?? null,
  };
  latestMqttData = { ...binObj, filled_level: payload.filled_level, filledLevel: payload.filledLevel };
  // Debug log for emits
  console.log('emitMqttData ->', payload);
  try {
    if (global && global.io && typeof global.io.emit === 'function') {
      global.io.emit('mqttData', payload);
    }
  } catch (e) {
    // ignore emit errors
  }
};

const startMqttClient = () => {
  if (!isLikelyHostname(awsIotEndpoint)) {
    console.log('AWS_MQTT_END_POINT not set or invalid -> running in simulation mode');
    return;
  }

  const options = {
    clientId,
    clean: true,
    reconnectPeriod: 30000,
    connectTimeout: 30 * 1000,
  };

  try {
    const keyPath = './controller/cert/private.pem.key';
    const certPath = './controller/cert/client-certificate.pem.crt';
    const caPath = './controller/cert/AmazonRootCA1.pem';
    if (fs.existsSync(keyPath) && fs.existsSync(certPath) && fs.existsSync(caPath)) {
      options.key = fs.readFileSync(keyPath);
      options.cert = fs.readFileSync(certPath);
      options.ca = fs.readFileSync(caPath);
    } else {
      console.warn('One or more cert files not found; attempting connection without certs (may fail).');
    }
  } catch (e) {
    console.warn('Error reading certs:', e.message);
  }

  mqttClient = mqtt.connect(awsIotEndpoint.includes('://') ? awsIotEndpoint : `mqtts://${awsIotEndpoint}`, options);

  let fatalDnsErrorLogged = false;

  mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    mqttClient.subscribe(awsIotTopic, (err) => {
      if (!err) console.log(`Subscribed to topic: ${awsIotTopic}`);
    });
  });

  mqttClient.on('message', (topic, message) => {
    const payload = message.toString();
    try {
      const parsed = JSON.parse(payload);
      if (parsed && (parsed.id || parsed.binId)) {
        const id = parsed.id ?? parsed.binId;
        const idx = bins.findIndex((b) => b.id === id);
        if (idx !== -1) {
          // ensure we don't accidentally overwrite percent with raw distance
          const raw = parsed.filledLevel ?? null;
          const snakeVal = parsed.filled_level ?? null;
          const heightForBin = bins[idx].height ?? DEFAULT_BIN_HEIGHT;
          bins[idx] = { ...bins[idx], ...parsed };
          if (raw !== null && raw !== undefined) {
            // convert raw distance to a percent for bins[idx].filled_level
            bins[idx].filled_level = computeFilledPercent(raw, heightForBin);
            bins[idx].filledLevel = bins[idx].filled_level; // keep both for convenience
            bins[idx].distance = raw;
          } else if (snakeVal !== null && snakeVal !== undefined) {
            bins[idx].filled_level = Number(snakeVal);
            bins[idx].filledLevel = bins[idx].filled_level;
          }
          emitMqttData(bins[idx]);
        } else {
          const newBin = {
            id: parsed.id ?? parsed.binId,
            // if parsed has camelCase raw filledLevel treat as distance and convert
            filled_level: parsed.filled_level ?? (parsed.filledLevel ? computeFilledPercent(parsed.filledLevel, DEFAULT_BIN_HEIGHT) : null),
            filledLevel: null,
            temperature: parsed.temperature ?? null,
            latitude: parsed.latitude ?? null,
            longitude: parsed.longitude ?? null,
          };
          // keep raw distance too when available
          if (parsed.filledLevel !== undefined) newBin.distance = parsed.filledLevel;
          if (parsed.filled_level !== undefined) newBin.filled_level = Number(parsed.filled_level);
          newBin.filledLevel = newBin.filled_level;
          bins.push(newBin);
          emitMqttData(newBin);
        }
      } else {
        // no id present, still set latest and emit raw if useful
        latestMqttData = parsed;
        emitMqttData(parsed);
      }
    } catch (error) {
      console.error('Error parsing MQTT payload as JSON:', error.message);
    }
  });

  mqttClient.on('error', (err) => {
    if (err && err.code === 'ENOTFOUND') {
      if (!fatalDnsErrorLogged) {
        console.error('MQTT fatal DNS error (ENOTFOUND). Hostname cannot be resolved:', err.hostname || awsIotEndpoint);
        fatalDnsErrorLogged = true;
      }
      try {
        mqttClient.end(true);
      } catch (e) { }
      mqttClient = null;
      console.log('Switching to simulation mode due to DNS error. Unset or correct AWS_MQTT_END_POINT to re-enable MQTT.');
      return;
    }
    console.error('MQTT error:', err && err.message ? err.message : err);
  });

  mqttClient.on('close', () => {
    console.log('MQTT connection closed');
  });

  mqttClient.on('offline', () => {
    console.log('MQTT client offline');
  });

  mqttClient.on('reconnect', () => {
    console.log('MQTT client attempting to reconnect...');
  });
};

startMqttClient();

// Controller functions
const getLatestMqttData = () => latestMqttData;
const getBins = () => bins;

const updateBin = (id, updates) => {
  const idx = bins.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  const allowed = ['filled_level', 'temperature', 'latitude', 'longitude'];
  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      bins[idx][field] = updates[field];
    }
  });
  latestMqttData = { ...bins[idx], filledLevel: bins[idx].filled_level };
  console.log('updateBin -> id:', id, 'updated:', bins[idx]);
  emitMqttData(bins[idx]);
  return bins[idx];
};

const simulateUpdate = (id, payload) => {
  const idx = bins.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  if (payload && Object.keys(payload).length) {
    bins[idx] = { ...bins[idx], ...payload };
  } else {
    bins[idx].filled_level = Math.round(Math.min(100, Math.max(0, bins[idx].filled_level + (Math.random() * 20 - 10))));
    bins[idx].temperature = Math.round(Math.min(80, Math.max(-20, bins[idx].temperature + (Math.random() * 4 - 2))));
    bins[idx].latitude = Number((bins[idx].latitude + (Math.random() * 0.0005 - 0.00025)).toFixed(6));
    bins[idx].longitude = Number((bins[idx].longitude + (Math.random() * 0.0005 - 0.00025)).toFixed(6));
  }
  latestMqttData = { ...bins[idx], filledLevel: bins[idx].filled_level };
  emitMqttData(bins[idx]);
  return bins[idx];
};

// register a new bin into the in-memory bins store (if not present)
const registerBin = (bin) => {
  if (!bin) return null;
  const id = bin.binId ?? bin.id ?? null;
  if (!id) return null;
  const exists = bins.find((b) => b.id === id);
  if (exists) return exists;
  const newBin = {
    id,
    filled_level: bin.filled_level ?? null,
    temperature: bin.temperature ?? null,
    latitude: bin.latitude ?? null,
    longitude: bin.longitude ?? null,
    height: bin.height ?? DEFAULT_BIN_HEIGHT,
  };
  bins.push(newBin);
  console.log('registerBin -> added in-memory iot bin:', newBin);
  // emit so frontends know about a new bin
  emitMqttData(newBin);
  return newBin;
};

module.exports = {
  getLatestMqttData,
  getBins,
  updateBin,
  simulateUpdate,
  registerBin,
};
