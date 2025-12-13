const bins = require("../models/bin");

const getBins = async (req, res) => {
  try {
    const bin = await bins.find();
    // Count the total number of bins
    const totalBins = await bins.countDocuments();
    res.json({ bin, totalBins });
  } catch (error) {
    console.error("Error fetching feedback details:", error);
    res.status(500).send("Internal Server Error");
  }
};

const iotController = require('./iotController');

const createBin = async (req, res) => {
  try {
    const { binId, area, height } = req.body;
    const newBin = new bins({ binId, area, height });
    await newBin.save();
    // Register bin in in-memory iot bins so simulator/frontend know about it
    try {
      iotController.registerBin({ binId: newBin.binId, height: Number(newBin.height) || undefined });
    } catch (e) {
      console.warn('Failed to register bin in IoT controller:', e.message || e);
    }
    res.status(201).json(newBin);
  } catch (error) {
    console.error("Error creating bin:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  getBins,
  createBin,
};
