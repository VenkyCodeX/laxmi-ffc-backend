const express = require('express');
const router  = express.Router();
const Otp     = require('../models/Otp');

// POST /api/otp/send
router.post('/send', async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\d{10}$/.test(phone))
    return res.status(400).json({ success: false, error: 'Invalid phone number.' });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  // Upsert — replace any existing OTP for this phone
  await Otp.findOneAndUpdate(
    { phone },
    { otp, expiresAt },
    { upsert: true, new: true }
  );

  try {
    const apiKey   = process.env.TWOFACTOR_KEY;
    const response = await fetch(`https://2factor.in/API/V1/${apiKey}/SMS/${phone}/${otp}/AUTOGEN`);
    const data     = await response.json();
    console.log('2Factor response:', data);

    if (data.Status === 'Success') {
      res.json({ success: true });
    } else {
      console.error('2Factor error:', data);
      res.status(500).json({ success: false, error: 'Failed to send OTP via SMS.' });
    }
  } catch (err) {
    console.error('2Factor fetch error:', err.message);
    res.status(500).json({ success: false, error: 'Could not send OTP. Try again.' });
  }
});

// POST /api/otp/verify
router.post('/verify', async (req, res) => {
  const { phone, otp } = req.body;

  const record = await Otp.findOne({ phone });
  if (!record)
    return res.status(400).json({ success: false, error: 'OTP not sent or expired.' });
  if (new Date() > record.expiresAt) {
    await Otp.deleteOne({ phone });
    return res.status(400).json({ success: false, error: 'OTP expired. Request a new one.' });
  }
  if (record.otp !== otp)
    return res.status(400).json({ success: false, error: 'Incorrect OTP.' });

  await Otp.deleteOne({ phone });
  res.json({ success: true });
});

module.exports = router;
