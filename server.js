require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const https    = require('https');
const Order    = require('./models/Order');

const app = express();

app.use(cors());
app.use(express.json());

// Serve admin dashboard as static files
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Serve assets folder (logo etc)
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// API routes
app.use('/api/orders', require('./routes/orders'));
app.use('/api/otp',    require('./routes/otp'));
app.use('/api/items',  require('./routes/items'));

// Health check
app.get('/', (req, res) => res.json({ status: 'Laxmi Fast Food API running 🔥' }));

// ── DAILY SALES REPORT (runs at 11 PM every night) ──────
function scheduleDailyReport() {
  function msUntil11PM() {
    const now  = new Date();
    const next = new Date();
    next.setHours(23, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next - now;
  }

  setTimeout(async () => {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const orders = await Order.find({ orderTime: { $gte: today, $lt: tomorrow } });
      const revenue   = orders.reduce((s, o) => s + o.totalAmount, 0);
      const completed = orders.filter(o => o.orderStatus === 'Completed').length;
      const dateStr   = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

      const msg = encodeURIComponent(
        `🔥 *Laxmi Fast Food – Daily Report*\n` +
        `📅 ${dateStr}\n\n` +
        `📦 Total Orders: ${orders.length}\n` +
        `✅ Completed: ${completed}\n` +
        `💰 Revenue: ₹${revenue}\n\n` +
        `Have a great night! 🙏`
      );

      const WA_NUMBER = process.env.OWNER_PHONE || '9321611315';
      // Open WhatsApp link (works when server is on local machine)
      // For Render: log the report instead
      console.log(`📊 Daily Report – ${dateStr} | Orders: ${orders.length} | Revenue: ₹${revenue}`);

      // Send via UltraMsg if configured
      if (process.env.ULTRAMSG_TOKEN && process.env.ULTRAMSG_INSTANCE) {
        const body = JSON.stringify({
          token: process.env.ULTRAMSG_TOKEN,
          to: '91' + WA_NUMBER,
          body: decodeURIComponent(msg)
        });
        const options = {
          hostname: 'api.ultramsg.com',
          path: `/${process.env.ULTRAMSG_INSTANCE}/messages/chat`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        const req = https.request(options);
        req.write(body); req.end();
      }
    } catch (err) {
      console.error('Daily report error:', err.message);
    }
    // Schedule next day
    scheduleDailyReport();
  }, msUntil11PM());
}

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    scheduleDailyReport();
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
