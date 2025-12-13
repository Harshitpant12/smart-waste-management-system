// const express = require("express");
// const router = express.Router();
// const mqttController = require("../controller/iotController");

// // Route to get latest MQTT data
// router.get("/subscribe", (req, res) => {
//   // Get the latest MQTT data
//   const latestMqttData = mqttController.getLatestMqttData();

//   if (latestMqttData) {
//     // Respond with the latest MQTT data
//     res.json(latestMqttData);
//   } else {
//     // If no data is available, respond with an error message
//     res.status(404).json({ error: "No MQTT data available" });
//   }
// });

// module.exports = router;

const express = require('express');
const router = express.Router();
const mqttController = require('../controller/iotController');

// Route to get latest MQTT data (or last simulated update)
router.get('/subscribe', (req, res) => {
  const latest = mqttController.getLatestMqttData();
  if (latest) return res.json(latest);
  return res.status(404).json({ error: 'No MQTT data available' });
});

// Return list of all bins (for admin frontend)
router.get('/bins', (req, res) => {
  const bins = mqttController.getBins();
  res.json(bins);
});

// Update a bin's editable fields
router.put('/bins/:id', (req, res) => {
  const id = req.params.id;
  const updates = req.body || {};
  const updated = mqttController.updateBin(id, updates);
  if (!updated) return res.status(404).json({ error: 'Bin not found' });
  return res.json(updated);
});

// Simulate an update for a given bin (optional payload) - useful to trigger UI update flows
router.post('/bins/:id/simulate', (req, res) => {
  const id = req.params.id;
  const payload = req.body || {};
  const simulated = mqttController.simulateUpdate(id, payload);
  if (!simulated) return res.status(404).json({ error: 'Bin not found' });
  return res.json(simulated);
});

module.exports = router;