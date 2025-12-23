const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");

const collectorRoute = require("./routes/collector");
const userRoute = require("./routes/users");
require("dotenv").config();
const feedbackRoute = require("./routes/feedback");
const binRoutes = require("./routes/bins");
const authUserRoute = require("./routes/authUser");
const scheduleRoute = require("./routes/schedule");
const DB_URL = process.env.DB_URL;
const iotRoutes = require('./routes/iotRoutes');

const app = express();
const server = http.createServer(app);
// Setup socket.io on the existing http server and expose globally for controllers
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: '*' },
});
global.io = io;
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
  socket.on('client:binUpdated', (payload) => {
    console.log('client:binUpdated received from client, broadcasting mqttData:', payload);
    try { io.emit('mqttData', payload); } catch (e) { console.error('emit error', e); }
  });
});
const bodyParser = require("body-parser");
app.use(bodyParser.json());
const PORT = 1337;

// Deployment BEGIN
const path = require("path");
const _dirname = path.dirname("");
const buildPath = path.join(_dirname, "../frontend/build");

// Deployment END

app.use(cors());
app.use(express.json());
app.use("/api", collectorRoute);
app.use("/api", userRoute);
app.use("/api", feedbackRoute);
app.use("/api", binRoutes);
app.use("/api/user", authUserRoute);
app.use("/api", scheduleRoute);
app.use('/api/iot', iotRoutes);
// Also mount under /iot for backward compatibility with older frontend calls
app.use('/iot', iotRoutes);

mongoose.connect(DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// // IoT connection BEGIN

// const iotRoutes = require("./routes/iotRoutes");
// app.use("/iot", iotRoutes);

// IoT connection END

mongoose.connection.on("connected", () => {
  console.log("Connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

// Serve uploaded files
const uploadsPath = path.join(__dirname, "uploads");
try {
  const fs = require('fs');
  if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
} catch (e) {
  console.warn('Could not create uploads dir:', e && e.message);
}
app.use('/uploads', express.static(uploadsPath));

app.use(express.static(buildPath));

app.get("/*", function (req, res) {
  res.sendFile(path.join(__dirname, "../frontend/build/index.html"), function (err) {
    if (err) {
      res.status(500).send(err);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
