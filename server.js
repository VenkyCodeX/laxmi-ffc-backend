require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

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

// Health check
app.get('/', (req, res) => res.json({ status: 'Laxmi Fast Food API running 🔥' }));

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
