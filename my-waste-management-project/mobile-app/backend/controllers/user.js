const jwt = require('jsonwebtoken');
const PublicData = require('../models/public');
const CollectorData = require('../models/collector');
const ReportData = require('../models/report');


exports.createUser = async (req, res) => {
    const { name, role, mobile, email, password } = req.body;

    let isNewUser
    let userData;

    // Choose the appropriate collection based on the user's role
    if (role === 'collector') {

        isNewUser = await CollectorData.isThisEmailInUse(email);
        if (!isNewUser) {
            return res.send({ status: false, message: 'Email already in use' });
        }

        const activeAccount = false;

        userData = new CollectorData({
            name,
            mobile,
            email,
            password,
            activeAccount
        });
    } else if (role === 'public') {

        isNewUser = await PublicData.isThisEmailInUse(email);
        if (!isNewUser) {
            return res.send({ status: false, message: 'Email already in use' });
        }

        userData = new PublicData({
            name,
            mobile,
            email,
            password,
        });
    } else {
        // Handle unsupported roles or provide a default collection
        return res.status(400).send('Invalid user role');
    }

    await userData.save();

    // const tokenRegister = jwt.sign(
    //     { userId: user._id },
    //     process.env.JWT_SECRET,
    //     { expiresIn: '2h' }
    // )

    return res.send({ status: true, message: 'Registration Succesfull' });
};

exports.userSignInPublic = async (req, res) => {
    const { email, password } = req.body;

    const user = await PublicData.findOne({ email });

    if (!user) {
        return res.json({
            status: false,
            message: 'User not found'
        });
    };

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        return res.json({
            status: false,
            message: 'Password does not match'
        });
    }

    const tokenPublic = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );

    return res.json({
        status: true,
        message: 'login successful',
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        tokenPublic,
        userId: user._id
    });

};


exports.userSignInCollector = async (req, res) => {
    const { email, password } = req.body;

    const user = await CollectorData.findOne({ email });
    if (!user) {
        return res.json({
            status: false,
            message: 'User not found'
        });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        return res.json({
            status: false,
            message: 'Password does not match'
        });
    }

    const isActive = user.activeAccount;

    if (!isActive) {
        return res.json({
            status: false,
            message: 'Your account is not activated'
        })
    }


    const tokenCollector = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );

    return res.json({
        status: true,
        message: 'login successful',
        name: user.name,
        email: user.email,
        tokenCollector,
        userId: user._id
    });
};

const axios = require('axios');

exports.reportUser = async (req, res) => {
    const { name, number, title, feedback } = req.body;

    const reportData = new ReportData({
        name,
        number,
        title,
        feedback,
    });

    try {
        const saved = await reportData.save();
        // Forward to web-app feedback endpoint (configurable)
        try {
            const webapp = process.env.WEBAPP_URL || 'http://localhost:1337';
            if (req.file && req.file.buffer) {
                // forward multipart/form-data with file
                const FormData = require('form-data');
                const form = new FormData();
                form.append('name', name);
                form.append('title', title);
                form.append('feedback', feedback);
                form.append('source', 'mobile');
                form.append('photo', req.file.buffer, {
                    filename: req.file.originalname || `photo-${Date.now()}`,
                    contentType: req.file.mimetype || 'application/octet-stream'
                });
                await axios.post(`${webapp}/api/feedback`, form, { headers: form.getHeaders(), timeout: 8000 });
            } else {
                await axios.post(`${webapp}/api/feedback`, { name, title, feedback, source: 'mobile' }, { timeout: 5000 });
            }
        } catch (fwdErr) {
            console.warn('Forward to web-app /api/feedback failed:', fwdErr && fwdErr.message ? fwdErr.message : fwdErr);
        }
        return res.send({ status: true, message: 'Complaint succesfull', id: saved._id });
    } catch (error) {
        return res.json({
            status: false,
            message: error.message
        });
    }

};
