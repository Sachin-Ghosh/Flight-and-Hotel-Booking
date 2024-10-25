// models/paymentModel.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  tui: {
    type: String,
    required: true
  },
  paymentAmount: {
    type: Number,
    required: true
  },
  netAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED'],
    default: 'INITIATED'
  },
  paymentType: {
    type: String,
    enum: ['DEPOSIT', 'ONLINE'],
    required: true
  },
  paymentGateway: {
    code: String,
    merchantId: String,
    paymentId: String,
    redirectUrl: String,
    metadata: Object
  },
  response: {
    code: String,
    message: String,
    bookStatus: String,
    crsPnr: String,
    redirectMode: String,
    postData: Object
  },
  history: [{
    status: String,
    timestamp: Date,
    remarks: String
  }]
}, {
  timestamps: true
});


const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;