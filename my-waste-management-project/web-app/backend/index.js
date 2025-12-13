// ("use strict");
// require("dotenv").config();
// var AWS = require("aws-sdk");

// const my_AWSAccessKeyId = process.env.AWSAccessKeyId;
// const my_AWSSecretKey = process.env.AWSSecretKey;
// const aws_region = process.env.region;
// const bin01 = process.env.tableName;

// //dynamodb connection
// var dynamoDB = new AWS.DynamoDB.DocumentClient({
//   region: aws_region,
//   accessKeyId: my_AWSAccessKeyId,
//   secretAccessKey: my_AWSSecretKey,
// });

// async function fetchDatafromDatabase1() {
//   // Scan method fetch data from DynamoDB

//   var params = {
//     TableName: bin01,
//   };

//   let queryExecute = new Promise((res, rej) => {
//     dynamoDB.scan(params, function (err, data) {
//       if (err) {
//         console.log("Error", err);
//         rej(err);
//       } else {
//         console.log("Success! Scan method fetch data from DynamoDB");
//         const items = data.Items.map((item) => ({
//           TimeStamp: item.TimeStamp,
//           temperature: item.temperature,
//           averageDistance: item.averageDistance,
//           latitude: item.latitude,
//           longitude: item.longitude,
//         }));
//         res(items);
//       }
//     });
//   });
//   const result = await queryExecute;
//   console.log(result);
// }

// fetchDatafromDatabase1();



// demo
"use strict";

// -----------------------------------------------------------------
// 🔵 DUMMY DEMO MODE — NO AWS, NO HIVEMQ, NOTHING TO CONFIGURE
// -----------------------------------------------------------------

console.log("✔ Demo mode started (no AWS / no HiveMQ needed)");

// ----------------------------
// Fake DynamoDB Data
// ----------------------------
async function fetchData() {
  console.log("✔ Fetching dummy DynamoDB data...");

  const items = [
    {
      TimeStamp: Date.now(),
      temperature: 25.4,
      averageDistance: 120,
      latitude: 37.7749,
      longitude: -122.4194,
    },
    {
      TimeStamp: Date.now() - 5000,
      temperature: 26.1,
      averageDistance: 135,
      latitude: 40.7128,
      longitude: -74.0060,
    },
  ];

  console.log("📦 Dummy Data:", items);
}

// ----------------------------
// Simulated MQTT Client
// ----------------------------
function simulateMQTT() {
  console.log("✔ Simulating MQTT messages...");

  setInterval(() => {
    const message = `Random value: ${Math.floor(Math.random() * 100)}`;
    console.log(`📩 MQTT Message | test/topic: ${message}`);
  }, 3000);
}

// ----------------------------
// Run everything
// ----------------------------
fetchData();
simulateMQTT();
