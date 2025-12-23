const express = require("express");
const path = require('path');
const multer = require('multer');
const { getFeedback, createFeedback, deleteFeedback } = require("../controller/feedbackController");

const router = express.Router();

// configure multer to save uploads in backend/uploads
const uploadsPath = path.join(__dirname, '..', 'uploads');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsPath);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname) || '';
        const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, name);
    }
});
const upload = multer({ storage });

router.get("/feedback", getFeedback);
// accept optional single file field 'photo'
router.post("/feedback", upload.single('photo'), createFeedback);
router.delete("/feedback/:id", deleteFeedback);

module.exports = router;
