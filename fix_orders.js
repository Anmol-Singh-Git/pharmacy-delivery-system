const mongoose = require("mongoose");
const Order = require("./models/Order");

mongoose.connect("mongodb://127.0.0.1:27017/medideliver").then(async () => {
  const result = await Order.updateMany(
    { seller_email: "admin@admpharmacy.com" },
    { $set: { seller_email: "mohit@gmail.com" } }
  );
  console.log("Updated existing orders:", result.modifiedCount);
  process.exit(0);
});
