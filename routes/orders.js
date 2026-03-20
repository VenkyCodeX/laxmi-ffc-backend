const express  = require('express');
const router   = express.Router();
const Order    = require('../models/Order');
const Razorpay = require('razorpay');
const crypto   = require('crypto');

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// POST /api/orders/create-payment — create Razorpay order
router.post('/create-payment', async (req, res) => {
  try {
    const { amount } = req.body; // amount in rupees
    if (!amount || amount < 1) return res.status(400).json({ error: 'Invalid amount.' });
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: 'rcpt_' + Date.now()
    });
    res.json({ success: true, orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    res.status(500).json({ error: 'Payment initiation failed.' });
  }
});

// POST /api/orders/verify-payment — verify Razorpay signature
router.post('/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');
  if (expected !== razorpay_signature) return res.status(400).json({ success: false, error: 'Payment verification failed.' });
  res.json({ success: true });
});

// POST /api/orders — place a new order
router.post('/', async (req, res) => {
  try {
    const { customerName, phoneNumber, address, itemsOrdered, totalAmount } = req.body;
    if (!customerName || !phoneNumber || !address || !itemsOrdered?.length || !totalAmount) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Smart prep time:
    // - Count total items and unique dishes
    const totalQty    = itemsOrdered.reduce((s, i) => s + i.quantity, 0);
    const uniqueDishes = itemsOrdered.length;
    let prepTime;
    if (totalQty === 1)                          prepTime = 10;
    else if (totalQty === 2 && uniqueDishes === 1) prepTime = 15;
    else if (totalQty === 2 && uniqueDishes === 2) prepTime = 20;
    else                                           prepTime = 20 + (totalQty - 2) * 3;

    const { paymentMethod = 'cod', transactionId = '' } = req.body;
    const order = await Order.create({ customerName, phoneNumber, address, itemsOrdered, totalAmount, prepTime, paymentMethod, transactionId });

    // Auto-advance status every 5 minutes
    const STATUS_STEPS = ['Order Received', 'Preparing', 'Ready', 'Completed'];
    let step = 0;
    const interval = setInterval(async () => {
      step++;
      if (step >= STATUS_STEPS.length) { clearInterval(interval); return; }
      try {
        await Order.findByIdAndUpdate(order._id, { orderStatus: STATUS_STEPS[step] });
      } catch {}
      if (STATUS_STEPS[step] === 'Completed') clearInterval(interval);
    }, 5 * 60 * 1000); // every 5 minutes

    res.status(201).json({ success: true, orderId: order.orderId, prepTime: order.prepTime });
  } catch (err) {
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// GET /api/orders — fetch all orders (admin)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderTime: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/orders/by-phone/:phone — fetch all past orders by phone
router.get('/by-phone/:phone', async (req, res) => {
  try {
    const orders = await Order.find({ phoneNumber: req.params.phone })
      .sort({ orderTime: -1 })
      .limit(20);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/orders/:id/rating — submit rating & review
router.patch('/:id/rating', async (req, res) => {
  try {
    const { rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1–5.' });
    const order = await Order.findByIdAndUpdate(req.params.id, { rating, review: review || '' }, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/orders/:id/status — update order status (admin)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Order Received', 'Preparing', 'Ready', 'Completed'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus: status }, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/orders/coupon/validate — validate coupon code
const COUPONS = {
  'LAXMI10':   { discount: 10, type: 'percent', desc: '10% off' },
  'WELCOME20': { discount: 20, type: 'percent', desc: '20% off' },
  'FLAT50':    { discount: 50, type: 'flat',    desc: '₹50 off' },
  'SPICY30':   { discount: 30, type: 'percent', desc: '30% off' },
};
router.post('/coupon/validate', (req, res) => {
  const code = (req.body.code || '').toUpperCase().trim();
  const coupon = COUPONS[code];
  if (!coupon) return res.status(404).json({ valid: false, error: 'Invalid coupon code.' });
  res.json({ valid: true, ...coupon, code });
});

// PATCH /api/orders/:id/delivery-confirm — customer confirms delivery
router.patch('/:id/delivery-confirm', async (req, res) => {
  try {
    const { confirmed } = req.body; // 'yes' or 'no'
    if (!['yes', 'no'].includes(confirmed)) return res.status(400).json({ error: 'Invalid value.' });
    const order = await Order.findByIdAndUpdate(req.params.id, { deliveryConfirmed: confirmed }, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/orders/:id — delete order (admin)
router.delete('/:id', async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/orders/:id — get single order by MongoDB _id or orderId (keep LAST)
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const order = await Order.findById(id).catch(() => null)
      || await Order.findOne({ orderId: id });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
