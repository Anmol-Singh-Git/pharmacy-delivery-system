const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  latitude: Number,
  longitude: Number
}, { _id: false });

const buyerSchema = new mongoose.Schema({
  name: String,
  mobile: String,
  email: String,
  password: {
    type: String,
    required: [true, "Password is required"],
    validate: {
      validator: function(v) {
        // REGEX BREAKDOWN:
        // 1. (?=.*[A-Za-z]) -> Ensures at least 1 alphabet letter
        // 2. (?=.*\d) -> Ensures at least 1 numerical digit
        // 3. (?!.*(.)\1\1) -> Rejects any character repeating 3 times consecutively (e.g., "aaa" or "111")
        // 4. ^[A-Za-z0-9]{8,}$ -> Ensures strictly alphanumeric structure and a minimum of 8 characters
        return /^(?=.*[A-Za-z])(?=.*\d)(?!.*(.)\1\1)[A-Za-z0-9]{8,}$/.test(v);
      },
      message: "Password must be at least 8 alphanumeric characters long, contain at least 1 letter, 1 number, and cannot have any character repeat 3 times consecutively."
    }
  },
  address: String,
  city: String,
  pincode: String,
  latitude: Number,
  longitude: Number,
  location: locationSchema
});

module.exports = mongoose.model("Buyer", buyerSchema);