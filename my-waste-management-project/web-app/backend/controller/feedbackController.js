const feedback = require("../models/feedback");

const getFeedback = async (req, res) => {
  try {
    const feedbacks = await feedback.find().sort({ _id: -1 });
    res.json(feedbacks);
  } catch (error) {
    console.error("Error fetching feedback details:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Create new feedback and emit a realtime event
const createFeedback = async (req, res) => {
  try {
    // multer places uploaded file on req.file
    const { name, title, feedback: text, source } = req.body;
    if (!name || !title || !text) return res.status(400).json({ status: false, message: 'Missing required fields' });

    const payload = { name, title, feedback: text };
    if (source) payload.source = source;

    if (req.file && req.file.filename) {
      // store relative path for serving via /uploads
      payload.photoUrl = `/uploads/${req.file.filename}`;
    }

    const doc = new feedback(payload);
    const saved = await doc.save();

    // emit to connected clients via socket.io (if available)
    try {
      if (global && global.io && typeof global.io.emit === 'function') {
        global.io.emit('feedback:created', saved);
      }
    } catch (e) {
      console.warn('Failed to emit feedback:created', e && e.message ? e.message : e);
    }
    return res.status(201).json(saved);
  } catch (err) {
    console.error('Error creating feedback:', err && err.message ? err.message : err);
    return res.status(500).json({ status: false, message: 'Failed to create feedback' });
  }
};

const deleteFeedback = async (req, res) => {
  try {
    const id = req.params.id;
    const removed = await feedback.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ status: false, message: 'Feedback not found' });

    // attempt to remove uploaded photo file if it's stored locally
    try {
      if (removed.photoUrl && typeof removed.photoUrl === 'string' && removed.photoUrl.startsWith('/uploads/')) {
        const fs = require('fs');
        const path = require('path');
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        const filename = removed.photoUrl.replace('/uploads/', '');
        const fullPath = path.join(uploadsDir, filename);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    } catch (e) {
      console.warn('Failed to remove uploaded file for feedback:', e && e.message ? e.message : e);
    }

    // emit deletion event
    try {
      if (global && global.io && typeof global.io.emit === 'function') {
        global.io.emit('feedback:deleted', { id });
      }
    } catch (e) {
      console.warn('Failed to emit feedback:deleted', e && e.message ? e.message : e);
    }
    return res.json({ status: true, id });
  } catch (err) {
    console.error('Error deleting feedback:', err && err.message ? err.message : err);
    return res.status(500).json({ status: false, message: 'Failed to delete feedback' });
  }
};

module.exports = {
  getFeedback,
  createFeedback,
  deleteFeedback,
};
