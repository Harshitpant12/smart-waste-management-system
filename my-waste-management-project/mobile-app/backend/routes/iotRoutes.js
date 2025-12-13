const express = require("express");
const router = express.Router();
const mqttController = require("../controllers/iotController");

// Route to get latest MQTT data
router.get("/subscribe", (req, res) => {
  // Get the latest MQTT data
  const latestMqttData = mqttController.getLatestMqttData();

  if (latestMqttData) {
    // Respond with the latest MQTT data
    res.json(latestMqttData);
  } else {
    // If no data is available, respond with an error message
    res.status(404).json({ error: "No MQTT data available" });
  }
});

// POST /iot/test -> set latest data (development-only helper)
router.post('/test', (req, res) => {
  try {
    const payload = req.body;
    if (!payload) return res.status(400).json({ error: 'Missing payload' });
    const updated = mqttController.setLatestMqttData(payload);
    return res.json({ ok: true, latest: updated });
  } catch (e) {
    console.error('Error in /iot/test:', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'Failed to set test data' });
  }
});

module.exports = router;
