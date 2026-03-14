const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true },
  phoneNumber:  { type: String, required: true, trim: true },
  address:      { type: String, required: true, trim: true },
  itemsOrdered: [
    {
      name:     { type: String, required: true },
      price:    { type: Number, required: true },
      quantity: { type: Number, required: true, default: 1 }
    }
  ],
  totalAmount:  { type: Number, required: true },
  orderStatus:  { type: String, enum: ['Pending', 'Preparing', 'Completed'], default: 'Pending' },
  orderTime:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
