const express  = require('express');
const router   = express.Router();
const Order    = require('../models/Order');

// POST /api/orders — place a new order
router.post('/', async (req, res) => {
  try {
    const { customerName, phoneNumber, address, itemsOrdered, totalAmount } = req.body;
    if (!customerName || !phoneNumber || !address || !itemsOrdered?.length || !totalAmount) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    const order = await Order.create({ customerName, phoneNumber, address, itemsOrdered, totalAmount });
    res.status(201).json({ success: true, orderId: order._id });
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

// PATCH /api/orders/:id/status — update order status (admin)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Pending', 'Preparing', 'Completed'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus: status }, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json({ success: true, order });
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

module.exports = router;
