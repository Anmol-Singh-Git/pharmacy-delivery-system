const mongoose = require("mongoose");
const path = require("path");

mongoose.connect("mongodb://127.0.0.1:27017/medideliver")
  .then(async () => {
    // Seller Schema
    const Seller = mongoose.models.Seller || mongoose.model("Seller", new mongoose.Schema({
      email: { type: String, unique: true },
      name: String,
      shopName: String,
      mobile: String,
      address: String,
      city: String,
      pincode: String,
      gstin: String,
      latitude: Number,
      longitude: Number,
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
      }
    }, { strict: false }));

    const sellerEmail = "mohit@gmail.com";
    const lat = 29.2056975;
    const lng = 78.9527415;

    const seller = await Seller.findOneAndUpdate(
      { email: sellerEmail },
      {
        $set: {
          latitude: lat,
          longitude: lng,
          location: {
            type: "Point",
            coordinates: [lng, lat]
          }
        }
      },
      { new: true }
    );

    console.log("Seller updated successfully!");
    console.log("Updated data:", seller.latitude, seller.longitude, seller.location);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });
