const express = require('express');
const router  = express.Router();

const otpStore = {};

// POST /api/otp/send
router.post('/send', async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\d{10}$/.test(phone))
    return res.status(400).json({ success: false, error: 'Invalid phone number.' });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore[phone] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

  try {
    const apiKey  = process.env.TWOFACTOR_KEY;

    const response = await fetch(`https://2factor.in/API/V1/${apiKey}/SMS/${phone}/${otp}/AUTOGEN`);
    const data = await response.json();
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
router.post('/verify', (req, res) => {
  const { phone, otp } = req.body;
  const record = otpStore[phone];
  if (!record)
    return res.status(400).json({ success: false, error: 'OTP not sent or expired.' });
  if (Date.now() > record.expiresAt) {
    delete otpStore[phone];
    return res.status(400).json({ success: false, error: 'OTP expired. Request a new one.' });
  }
  if (record.otp !== otp)
    return res.status(400).json({ success: false, error: 'Incorrect OTP.' });

  delete otpStore[phone];
  res.json({ success: true });
});

module.exports = router;
