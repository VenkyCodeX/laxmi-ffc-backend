const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId:      { type: String, unique: true },
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
  orderStatus:  { type: String, enum: ['Order Received', 'Preparing', 'Ready', 'Completed'], default: 'Order Received' },
  prepTime:     { type: Number, default: 10 },
  orderTime:    { type: Date, default: Date.now },
  rating:       { type: Number, min: 1, max: 5, default: null },
  review:       { type: String, default: '' },
  couponCode:     { type: String, default: '' },
  discount:       { type: Number, default: 0 },
  paymentMethod:  { type: String, enum: ['cod', 'upi'], default: 'cod' },
  transactionId:  { type: String, default: '' }
});

// Auto-generate orderId before saving
orderSchema.pre('save', function(next) {
  if (!this.orderId) {
    this.orderId = 'FFC-' + Date.now();
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
