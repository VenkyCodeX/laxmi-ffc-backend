const express = require('express');
const router  = express.Router();
const Item    = require('../models/Item');

// GET /api/items — get all items with soldOut status
router.get('/', async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch { res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/items/toggle — toggle soldOut for an item
router.post('/toggle', async (req, res) => {
  try {
    const { name, soldOut } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required.' });
    const item = await Item.findOneAndUpdate(
      { name },
      { soldOut, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true, item });
  } catch { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
