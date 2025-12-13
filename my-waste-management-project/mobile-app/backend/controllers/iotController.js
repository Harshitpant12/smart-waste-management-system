const mqtt = require("mqtt");
const fs = require("fs");


// ---------------------------------------------start
// HiveMQ public broker (no authentication)
const hiveMqBroker = "mqtt://broker.hivemq.com:1883";

const clientId = "mqtt-waste-client-" + Math.random().toString(16).substr(2, 8);

// Your topic
const awsIotTopic = "3yp/Area001/Bin_001";

// Connect to HiveMQ
const mqttClient = mqtt.connect(hiveMqBroker, {
  clientId: clientId,
  clean: true,
});

mqttClient.on("connect", () => {
  console.log("Connected to HiveMQ MQTT broker");

  mqttClient.subscribe(awsIotTopic, (err) => {
    if (!err) {
      console.log("Subscribed to topic:", awsIotTopic);
    } else {
      console.error("Subscription failed:", err);
    }
  });
});

// Listen for incoming messages
mqttClient.on("message", (topic, message) => {
  console.log(`Message received on ${topic}:`, message.toString());
});

// Handle errors
mqttClient.on("error", (err) => {
  console.error("MQTT Error:", err);
});
// ---------------------------------------------end

// // AWS IoT configuration
// const awsIotEndpoint = process.env.AWS_MQTT_END_POINT;
// const awsIotTopic = "3yp/Area001/Bin_001";
// const clientId = "mqqt-client";

// const mqttClient = mqtt.connect(awsIotEndpoint, {
//   clientId: clientId,
//   clean: true,
//   // Add your AWS IoT certificate options here
//   key: fs.readFileSync("./controllers/cert/private.pem.key"),
//   cert: fs.readFileSync("./controllers/cert/client-certificate.pem.crt"),
//   ca: fs.readFileSync("./controllers/cert/AmazonRootCA1.pem"),
// });

let latestMqttData = null;

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
  mqttClient.subscribe(awsIotTopic, (err) => {
    if (!err) {
      console.log(`Subscribed to topic: ${awsIotTopic}`);
    }
  });
});

mqttClient.on("message", (topic, message) => {
  const payload = message.toString();
  console.log(`Received message on topic '${topic}': ${payload}`);
  // Update latestMqttData
  try {
    latestMqttData = JSON.parse(payload);
    // console.log("mqqt data", latestMqttData);
  } catch (error) {
    console.error("Error parsing MQTT payload as JSON:", error);
    return;
  }
});

// Function to get the latest MQTT data
const getLatestMqttData = () => {
  return latestMqttData;
};

// Helper to set latest data (useful for testing)
const setLatestMqttData = (payload) => {
  latestMqttData = payload;
  console.log('setLatestMqttData ->', payload);
  return latestMqttData;
};

module.exports = {
  getLatestMqttData,
  setLatestMqttData,
};
