const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
latitude: Number,
longitude: Number
}, { _id: false });

const buyerSchema = new mongoose.Schema({

  name: String,
  mobile: String,
  email: String,
  password: String,
  address: String,
  city: String,
  pincode: String,
  latitude: Number,
  longitude: Number,
  location: locationSchema

});

module.exports = mongoose.model("Buyer", buyerSchema);
