const dns = require('dns');
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Seller = require('./models/Seller');
const Medicine = require('./models/Medicine');

async function test() {
  const startConn = Date.now();
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB in', Date.now() - startConn, 'ms');

  for (let i = 1; i <= 5; i++) {
    const startQuery = Date.now();
    const medicines = await Medicine.find({});
    const sellerEmails = [...new Set(medicines.map(m => m.seller_email).filter(Boolean))];
    const sellers = await Seller.find({ email: { $in: sellerEmails } });
    console.log(`Query run ${i}: found ${medicines.length} medicines, ${sellers.length} sellers in ${Date.now() - startQuery} ms`);
  }

  await mongoose.disconnect();
}

test();
