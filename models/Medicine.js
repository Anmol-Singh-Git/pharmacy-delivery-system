const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema({

medicine_name: String,
brand: String,
category: String,
price: Number,
stock: Number,
expiry_date: String,
manufacturer: String,
prescription_required: String,
description: String,
  seller_email: String,
  images: [String],
  delivery_phone: {
    type: String,
    default: ""
  }

});

module.exports = mongoose.model("Medicine", medicineSchema);
