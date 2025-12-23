const express = require('express');
const multer = require('multer');
const { createUser, userSignInPublic, userSignInCollector, reportUser } = require('../controllers/user');
const { validateUserSignup, userValidation, validateUserSignIn, validateUserReport } = require('../middleware/validation/user');

const router = express.Router();

// use memory storage so we can forward file without saving to disk
const upload = multer({ storage: multer.memoryStorage() });

router.post('/create-user', validateUserSignup, userValidation, createUser);
router.post('/sign-in-public', validateUserSignIn, userValidation, userSignInPublic);
router.post('/sign-in-collector', validateUserSignIn, userValidation, userSignInCollector);
// accept optional file field 'photo'
router.post('/report-user', upload.single('photo'), validateUserReport, userValidation, reportUser);





module.exports = router;