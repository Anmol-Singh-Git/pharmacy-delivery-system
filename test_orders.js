const mongoose = require("mongoose");
const Order = require("./models/Order");

mongoose.connect("mongodb://127.0.0.1:27017/medideliver").then(async () => {
  const orders = await Order.find().sort({ createdAt: -1 });
  console.log(JSON.stringify(orders.slice(0, 2), null, 2));
  process.exit(0);
});
