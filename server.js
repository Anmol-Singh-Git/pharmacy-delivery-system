require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const Seller = require("./models/Seller");
const Buyer = require("./models/Buyer");
const Medicine = require("./models/Medicine");
const Order = require("./models/Order");

const Razorpay = require("razorpay");

const app = express();

/* ================= MIDDLEWARE ================= */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= MULTER CONFIG ================= */

const storage = multer.diskStorage({

destination: function(req, file, cb){
cb(null, "public/uploads");
},

filename: function(req, file, cb){
cb(null, Date.now() + path.extname(file.originalname));
}

});

const upload = multer({ storage: storage });

/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medideliver")

.then(() => console.log("Database connected"))

.catch(err => console.log("DB Error:", err));

const PORT = process.env.PORT || 5000;

/* ================= RAZORPAY ================= */

const razorpay = new Razorpay({

key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_SS3TBCR3eyB1WK",
key_secret: process.env.RAZORPAY_KEY_SECRET || "54CAKWybA1Ke0CGONI6wXjEL"

});

const CATEGORY_GROUPS = {
MEDICINES: ["TABLET", "SYRUP", "CAPSULE", "INJECTION"],
TABLET: ["TABLET"],
SYRUP: ["SYRUP"],
CAPSULE: ["CAPSULE"],
INJECTION: ["INJECTION"],
HEALTHCARE_DEVICES: ["HEALTHCARE_DEVICES"],
PERSONAL_CARE: ["PERSONAL_CARE"],
BABY_CARE: ["BABY_CARE"],
NUTRITION: ["NUTRITION"],
AYURVEDA: ["AYURVEDIC"],
AYURVEDIC: ["AYURVEDIC"],
HOME_ESSENTIALS: ["HOME_ESSENTIALS"]
};

const CATEGORY_ALIASES = {
"medicines": "MEDICINES",
"medicine": "MEDICINES",
"tablet": "TABLET",
"syrup": "SYRUP",
"capsule": "CAPSULE",
"injection": "INJECTION",
"healthcare devices": "HEALTHCARE_DEVICES",
"healthcare_devices": "HEALTHCARE_DEVICES",
"personal care": "PERSONAL_CARE",
"personal_care": "PERSONAL_CARE",
"baby care": "BABY_CARE",
"baby_care": "BABY_CARE",
"nutrition": "NUTRITION",
"nutrition & supplements": "NUTRITION",
"ayurveda": "AYURVEDA",
"ayurvedic": "AYURVEDIC",
"ayurvedic products": "AYURVEDIC",
"home essentials": "HOME_ESSENTIALS",
"home_essentials": "HOME_ESSENTIALS"
};

function parseCoordinatePair(latitudeValue, longitudeValue){
if(
latitudeValue === undefined ||
longitudeValue === undefined ||
latitudeValue === "" ||
longitudeValue === ""
){
return undefined;
}

const latitude = Number(latitudeValue);
const longitude = Number(longitudeValue);

if(!Number.isFinite(latitude) || !Number.isFinite(longitude)){
return undefined;
}

return {
latitude,
longitude
};
}

function normalizeCategoryInput(value){
return String(value || "").trim().toLowerCase();
}

function resolveCategoryCodes(categoryValue){
if(!categoryValue) return null;

const normalized = normalizeCategoryInput(categoryValue);
if(!normalized || normalized === "all") return null;

const directKey = String(categoryValue).trim().toUpperCase();

if(CATEGORY_GROUPS[directKey]){
return CATEGORY_GROUPS[directKey];
}

const mappedKey = CATEGORY_ALIASES[normalized];
return mappedKey ? CATEGORY_GROUPS[mappedKey] : [];
}

function parseLocation(body){
return parseCoordinatePair(
body?.latitude ?? body?.lat,
body?.longitude ?? body?.lng
);
}

function parseRequestPayload(value, fallbackValue){
if(Array.isArray(value) || (value && typeof value === "object")){
return value;
}

if(typeof value !== "string"){
return fallbackValue;
}

const trimmed = value.trim();
if(!trimmed){
return fallbackValue;
}

try{
return JSON.parse(trimmed);
}
catch(error){
return fallbackValue;
}
}

function normalizeLookupValue(value){
return String(value || "").trim().toLowerCase();
}

function findMatchingPrescriptionEntry(entries, medicineItem, dbMedicine){
const targetMedicineId = String(
medicineItem?.medicine_id ||
dbMedicine?._id ||
""
).trim();
const targetMedicineName = normalizeLookupValue(
medicineItem?.medicine_name ||
dbMedicine?.medicine_name
);
const targetSellerEmail = normalizeLookupValue(
medicineItem?.seller_email ||
dbMedicine?.seller_email
);

return entries.find(entry => {
const entryMedicineId = String(entry?.medicine_id || "").trim();

if(targetMedicineId && entryMedicineId && targetMedicineId === entryMedicineId){
return true;
}

return (
normalizeLookupValue(entry?.medicine_name) === targetMedicineName &&
normalizeLookupValue(entry?.seller_email) === targetSellerEmail
);
});
}

function buildSellerGeoLocation(location){
if(!location) return undefined;

const latitude = Number(location.latitude ?? location.lat);
const longitude = Number(location.longitude ?? location.lng);

if(!Number.isFinite(latitude) || !Number.isFinite(longitude)){
return undefined;
}

return {
type: "Point",
lat: latitude,
lng: longitude,
coordinates: [longitude, latitude],
latitude,
longitude
};
}

function buildDeliveryLocation(location){
if(!location) return null;

const latitude = Number(location.latitude ?? location.lat);
const longitude = Number(location.longitude ?? location.lng);

if(!Number.isFinite(latitude) || !Number.isFinite(longitude)){
return null;
}

return {
lat: latitude,
lng: longitude,
latitude,
longitude
};
}

function escapeRegex(value){
return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeOrderStatus(status){
return String(status || "Waiting for Approval").replace(/Waiting for Acceptance/gi, "Waiting for Approval");
}

function hasPrescriptionEntryForMedicine(entries, medicineItem){
const prescriptionEntries = Array.isArray(entries) ? entries : [];
const targetMedicineId = String(
medicineItem?.medicine_id ||
medicineItem?._id ||
""
).trim();
const targetMedicineName = normalizeLookupValue(medicineItem?.medicine_name);
const targetSellerEmail = normalizeLookupValue(medicineItem?.seller_email);

return prescriptionEntries.some(entry => {
const entryMedicineId = String(entry?.medicine_id || "").trim();

if(targetMedicineId && entryMedicineId && targetMedicineId === entryMedicineId){
return true;
}

return (
normalizeLookupValue(entry?.medicine_name) === targetMedicineName &&
normalizeLookupValue(entry?.seller_email) === targetSellerEmail
);
});
}

function resolveMedicineRequiresPrescription(medicineItem, prescriptions){
if(typeof medicineItem?.requires_prescription === "boolean"){
return medicineItem.requires_prescription;
}

const normalizedFieldValue = String(
medicineItem?.prescription_required ??
medicineItem?.requires_prescription ??
""
).trim().toLowerCase();

if(["yes", "true"].includes(normalizedFieldValue)){
return true;
}

if(["no", "false"].includes(normalizedFieldValue)){
return false;
}

return hasPrescriptionEntryForMedicine(prescriptions, medicineItem);
}

function normalizeMedicineStatus(status){
const normalized = String(status || "")
.replace(/Waiting for Acceptance/gi, "Waiting for Approval")
.trim()
.toLowerCase();

if(normalized === "waiting for approval"){
return "Waiting for Approval";
}

if(["accepted", "approved", "ordered"].includes(normalized)){
return "Ordered";
}

if(normalized === "rejected"){
return "Rejected";
}

return "";
}

function getFallbackMedicineStatus(requiresPrescription, orderStatus, prescriptionStatus){
const normalizedOrderStatus = normalizeOrderStatus(orderStatus).toLowerCase();
const normalizedPrescriptionStatus = String(prescriptionStatus || "").trim().toLowerCase();

if(requiresPrescription){
if(
normalizedPrescriptionStatus.includes("approved") ||
["accepted", "out for delivery", "delivered"].includes(normalizedOrderStatus)
){
return "Ordered";
}

if(
normalizedPrescriptionStatus.includes("rejected") ||
normalizedOrderStatus === "rejected"
){
return "Rejected";
}

return "Waiting for Approval";
}

if(normalizedOrderStatus === "rejected"){
return "Rejected";
}

return "Ordered";
}

function normalizeOrderMedicines(medicines, prescriptions, orderStatus, prescriptionStatus){
const medicineList = Array.isArray(medicines) ? medicines : [];

return medicineList.map(item => {
const plainItem = item?.toObject ? item.toObject() : { ...(item || {}) };
const requiresPrescription = resolveMedicineRequiresPrescription(plainItem, prescriptions);
const normalizedStatus = normalizeMedicineStatus(plainItem.status);

return {
...plainItem,
requires_prescription: requiresPrescription,
status: normalizedStatus || getFallbackMedicineStatus(
requiresPrescription,
orderStatus,
prescriptionStatus
)
};
});
}

function summarizeOrderMedicines(medicines){
const medicineList = Array.isArray(medicines) ? medicines : [];
const orderedCount = medicineList.filter(item => item.status === "Ordered").length;
const waitingCount = medicineList.filter(item => item.status === "Waiting for Approval").length;
const rejectedCount = medicineList.filter(item => item.status === "Rejected").length;
const prescriptionMedicines = medicineList.filter(item => item.requires_prescription);
const prescriptionCount = prescriptionMedicines.length;
const prescriptionOrderedCount = prescriptionMedicines.filter(item => item.status === "Ordered").length;
const prescriptionWaitingCount = prescriptionMedicines.filter(item => item.status === "Waiting for Approval").length;
const prescriptionRejectedCount = prescriptionMedicines.filter(item => item.status === "Rejected").length;

let orderStatus = "Waiting for Approval";

if(waitingCount > 0){
orderStatus = (orderedCount > 0 || rejectedCount > 0) ? "Partially Ordered" : "Waiting for Approval";
}
else if(orderedCount > 0){
orderStatus = rejectedCount > 0 ? "Partially Ordered" : "Accepted";
}
else if(rejectedCount > 0){
orderStatus = "Rejected";
}

let prescriptionStatus = "Not Required";

if(prescriptionCount > 0){
if(prescriptionWaitingCount > 0){
prescriptionStatus = "Pending";
}
else if(prescriptionOrderedCount > 0 && prescriptionRejectedCount > 0){
prescriptionStatus = "Partially Approved";
}
else if(prescriptionOrderedCount > 0){
prescriptionStatus = "Approved";
}
else if(prescriptionRejectedCount > 0){
prescriptionStatus = "Rejected";
}
}

return {
orderedCount,
waitingCount,
rejectedCount,
prescriptionCount,
orderStatus,
prescriptionStatus
};
}

function buildOrderSnapshot(order){
const plainOrder = order?.toObject ? order.toObject() : { ...(order || {}) };
const normalizedMedicines = normalizeOrderMedicines(
plainOrder.medicines,
plainOrder.prescriptions,
plainOrder.order_status || plainOrder.status,
plainOrder.prescription_status
);
const summary = summarizeOrderMedicines(normalizedMedicines);
const currentStatus = normalizeOrderStatus(plainOrder.order_status || plainOrder.status || summary.orderStatus);
let nextOrderStatus = summary.orderStatus;

if(
["Out for Delivery", "Delivered"].includes(currentStatus) &&
summary.waitingCount === 0 &&
summary.orderedCount > 0
){
nextOrderStatus = currentStatus;
}
else if(
currentStatus === "Rejected" &&
summary.orderedCount === 0 &&
summary.waitingCount === 0 &&
summary.rejectedCount > 0
){
nextOrderStatus = "Rejected";
}

const dKmSnap =
plainOrder.distanceKm != null && plainOrder.distanceKm !== ""
? Number(plainOrder.distanceKm)
: NaN;
let outEtaMin =
plainOrder.etaMin != null && plainOrder.etaMin !== "" ? Number(plainOrder.etaMin) : NaN;
let outEtaMax =
plainOrder.etaMax != null && plainOrder.etaMax !== "" ? Number(plainOrder.etaMax) : NaN;
if (!Number.isFinite(outEtaMin)) {
outEtaMin = NaN;
}
if (!Number.isFinite(outEtaMax)) {
outEtaMax = NaN;
}
if (
  (!Number.isFinite(outEtaMin) || !Number.isFinite(outEtaMax)) &&
  Number.isFinite(dKmSnap) &&
  dKmSnap >= 0
) {
  outEtaMin = Math.round(dKmSnap * 10);
  outEtaMax = Math.round(dKmSnap * 15);
  if (outEtaMax < outEtaMin) {
    outEtaMax = outEtaMin;
  }
}

let etaDisplay = "Location unavailable";
if (Number.isFinite(outEtaMin) && Number.isFinite(outEtaMax)) {
  etaDisplay = `${outEtaMin} - ${outEtaMax} mins`;
} else {
  const rawEta = plainOrder.eta && String(plainOrder.eta).trim();
  if (rawEta && !/^calculating/i.test(rawEta)) {
    etaDisplay = rawEta;
  }
}

return {
...plainOrder,
medicines: normalizedMedicines,
status: nextOrderStatus,
order_status: nextOrderStatus,
prescription_status: summary.prescriptionStatus,
buyerLat: plainOrder.buyerLat,
buyerLng: plainOrder.buyerLng,
storeLat: plainOrder.storeLat,
storeLng: plainOrder.storeLng,
distanceKm: plainOrder.distanceKm,
etaMin: Number.isFinite(outEtaMin) ? outEtaMin : (plainOrder.etaMin != null ? plainOrder.etaMin : undefined),
etaMax: Number.isFinite(outEtaMax) ? outEtaMax : (plainOrder.etaMax != null ? plainOrder.etaMax : undefined),
eta: etaDisplay,
deliveryBoyPhone: plainOrder.deliveryBoyPhone || "",
order_summary: {
ordered_items: summary.orderedCount,
waiting_items: summary.waitingCount,
rejected_items: summary.rejectedCount,
prescription_items: summary.prescriptionCount
}
};
}

function syncOrderState(order){
const snapshot = buildOrderSnapshot(order);

order.medicines = snapshot.medicines;
order.status = snapshot.status;
order.order_status = snapshot.order_status;
order.prescription_status = snapshot.prescription_status;

return snapshot;
}

function applyPrescriptionDecision(order, decision){
const snapshot = syncOrderState(order);
const nextItemStatus = decision === "Approved" ? "Ordered" : "Rejected";

order.medicines = snapshot.medicines.map(item => {
if(item.requires_prescription && item.status === "Waiting for Approval"){
return {
...item,
status: nextItemStatus
};
}

return item;
});

return syncOrderState(order);
}

function getSellerCoordinates(seller){
if(!seller) return undefined;

const latitude = Number(
seller.latitude ??
seller.location?.latitude ??
seller.location?.coordinates?.[1]
);

const longitude = Number(
seller.longitude ??
seller.location?.longitude ??
seller.location?.coordinates?.[0]
);

if(!Number.isFinite(latitude) || !Number.isFinite(longitude)){
return undefined;
}

return {
latitude,
longitude
};
}

function haversineDistanceKm(from, to){
if(!from || !to) return null;

const earthRadiusKm = 6371;
const toRadians = value => value * (Math.PI / 180);
const dLat = toRadians(to.latitude - from.latitude);
const dLng = toRadians(to.longitude - from.longitude);

const a =
Math.sin(dLat / 2) * Math.sin(dLat / 2) +
Math.cos(toRadians(from.latitude)) *
Math.cos(toRadians(to.latitude)) *
Math.sin(dLng / 2) * Math.sin(dLng / 2);

const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
return earthRadiusKm * c;
}

function cleanPublicSeller(seller){
if(!seller) return null;

const sellerCoordinates = getSellerCoordinates(seller);
const shopName = seller.shopName || seller.pharmacy_name || seller.owner_name || "";

return {
name: shopName,
owner_name: seller.owner_name || "",
shopName,
pharmacy_name: shopName,
mobile: seller.mobile || "",
email: seller.email || "",
address: seller.address || "",
city: seller.city || "",
pincode: seller.pincode || "",
gstin: seller.gstin || "",
shop_image: seller.shop_image || "",
lat: sellerCoordinates?.latitude ?? null,
lng: sellerCoordinates?.longitude ?? null,
latitude: sellerCoordinates?.latitude ?? null,
longitude: sellerCoordinates?.longitude ?? null,
location: sellerCoordinates ? buildSellerGeoLocation(sellerCoordinates) : null
};
}

function buildOrderSellerDetails(seller){
if(!seller) return null;

const sellerCoordinates = getSellerCoordinates(seller);
const shopName = seller.shopName || seller.pharmacy_name || seller.owner_name || "";

return {
owner_name: seller.owner_name || "",
pharmacy_name: shopName,
email: seller.email || "",
mobile: seller.mobile || "",
address: seller.address || "",
city: seller.city || "",
pincode: seller.pincode || "",
location: sellerCoordinates || null
};
}

function cleanPrivateBuyer(buyer){
if(!buyer) return null;

return {
name: buyer.name || "",
mobile: buyer.mobile || "",
email: buyer.email || "",
address: buyer.address || "",
city: buyer.city || "",
pincode: buyer.pincode || "",
location: buyer.location || null
};
}

async function enrichMedicinesWithSellerDetails(medicines){
const sellerEmails = [...new Set(medicines.map(medicine => medicine.seller_email).filter(Boolean))];

if(sellerEmails.length === 0){
return medicines.map(medicine => {
const plainMedicine = medicine.toObject ? medicine.toObject() : medicine;
return {
...plainMedicine,
seller_details: null
};
});
}

const sellers = await Seller.find({ email: { $in: sellerEmails } });
const sellerMap = new Map(
sellers.map(seller => [seller.email, cleanPublicSeller(seller)])
);

return medicines.map(medicine => {
const plainMedicine = medicine.toObject ? medicine.toObject() : medicine;
return {
...plainMedicine,
seller_details: sellerMap.get(plainMedicine.seller_email) || null
};
});
}

/* ================= REGISTRATION ================= */
/* ================= SELLER REGISTER ================= */

app.post("/api/register", async (req, res) => {

try {

const sellerCoordinates = parseLocation(req.body);
const shopName = req.body.shopName || req.body.pharmacy_name || "";

if(
!String(req.body.owner_name || "").trim() ||
!String(shopName || "").trim() ||
!String(req.body.mobile || "").trim() ||
!String(req.body.email || "").trim() ||
!String(req.body.password || "").trim() ||
!String(req.body.address || "").trim() ||
!String(req.body.city || "").trim() ||
!String(req.body.pincode || "").trim() ||
!String(req.body.gstin || "").trim()
){
return res.status(400).json({
success: false,
message: "Pharmacy name, address, city, pincode, and other seller details are required"
});
}

const seller = new Seller({

owner_name: req.body.owner_name,
shopName,
pharmacy_name: shopName,
mobile: req.body.mobile,
email: req.body.email,
password: req.body.password,
address: req.body.address,
city: req.body.city,
pincode: req.body.pincode,
gstin: req.body.gstin,
shop_image: req.body.shop_image || "",
latitude: sellerCoordinates?.latitude,
longitude: sellerCoordinates?.longitude,
location: buildSellerGeoLocation(sellerCoordinates)

});

await seller.save();

/* ✅ IMPORTANT CHANGE */
res.json({
success: true,
email: seller.email,
role: "seller",
profile: cleanPublicSeller(seller)
});

}

catch (error) {

console.log(error);
res.status(500).json({ success: false, message: "Seller Registration Failed" });

}

});

/* ================= BUYER REGISTER ================= */

app.post("/api/buyer-register", async (req, res) => {

try {

const buyer = new Buyer({

name: req.body.name,
mobile: req.body.mobile,
email: req.body.email,
password: req.body.password,
address: req.body.address,
city: req.body.city,
pincode: req.body.pincode,
location: parseLocation(req.body)

});

await buyer.save();

/* ✅ IMPORTANT CHANGE */
res.json({
success: true,
email: buyer.email,
role: "buyer",
profile: cleanPrivateBuyer(buyer)
});

}

catch (error) {

console.log(error);
res.status(500).json({ success: false, message: "Buyer Registration Failed" });

}

});

/* ================= LOGIN ================= */

app.post("/api/login", async (req, res) => {

const { email, password } = req.body;

try {

/* CHECK BUYER */

const buyer = await Buyer.findOne({ email, password });

if (buyer) {

return res.json({
success: true,
role: "buyer",
email: buyer.email,
profile: cleanPrivateBuyer(buyer)
});

}

/* CHECK SELLER */

const seller = await Seller.findOne({ email, password });

if (seller) {

return res.json({
success: true,
role: "seller",
email: seller.email,
profile: cleanPublicSeller(seller)
});

}

/* INVALID LOGIN */

res.status(401).json({
success: false,
message: "Invalid email or password"
});

}

catch (error) {

console.log(error);

res.status(500).json({
success: false,
message: "Server error"
});

}

});

app.get("/api/buyer-coords/:email", async (req, res) => {
  try {
    const email = String(req.params.email || "").trim();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const buyer = await Buyer.findOne({ email }).select("latitude longitude location");
    if (!buyer) {
      return res.status(404).json({ success: false, message: "Buyer not found" });
    }

    let lat = Number(buyer.latitude);
    let lng = Number(buyer.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const loc = buyer.location;
      lat = Number(loc?.latitude ?? loc?.lat);
      lng = Number(loc?.longitude ?? loc?.lng);
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.json({ success: true, latitude: null, longitude: null });
    }

    res.json({ success: true, latitude: lat, longitude: lng });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/update-location", async (req, res) => {
  const email = String(req.body.email || "").trim();
  const role = String(req.body.role || "").trim();
  const latitude = Number(req.body.latitude ?? req.body.lat);
  const longitude = Number(req.body.longitude ?? req.body.lng);

  try {
    if (!email || (role !== "buyer" && role !== "seller")) {
      return res.status(400).json({ success: false, message: "email and role (buyer|seller) required" });
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ success: false, message: "valid latitude and longitude required" });
    }

    if (role === "buyer") {
      await Buyer.updateOne(
        { email },
        {
          $set: {
            latitude,
            longitude,
            location: { latitude, longitude }
          }
        }
      );
    } else {
      await Seller.updateOne(
        { email },
        { $set: { latitude, longitude } }
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= ADD MEDICINE ================= */

app.post("/api/add-medicine", upload.array("images", 5), async (req,res)=>{

try{

const medicine = new Medicine({

medicine_name: req.body.medicine_name,
brand: req.body.brand,
category: req.body.category,
price: Number(req.body.price),
stock: req.body.stock,
expiry_date: req.body.expiry_date,
manufacturer: req.body.manufacturer,
prescription_required: req.body.prescription_required,
description: req.body.description,
  seller_email: req.body.seller_email,
  images: req.files.map(file => file.filename),
  delivery_phone: req.body.delivery_phone

});

await medicine.save();

res.json({
success: true,
message: "Medicine added successfully"
});

}

catch(error){

console.log(error);
res.status(500).json({
success: false,
message: "Error adding medicine"
});

}

});

/* ================= GET MEDICINES ================= */

app.get("/api/medicines", async (req,res)=>{

try{

const categoryCodes = resolveCategoryCodes(req.query.category);
const searchTerm = String(req.query.search || req.query.q || "").trim();
let medicineFilter = categoryCodes && categoryCodes.length > 0
? {
category: categoryCodes.length === 1
? categoryCodes[0]
: { $in: categoryCodes }
}
: {};

if(searchTerm){
const searchRegex = new RegExp(escapeRegex(searchTerm), "i");
const matchingSellers = await Seller.find({
$or: [
{ shopName: searchRegex },
{ pharmacy_name: searchRegex },
{ owner_name: searchRegex },
{ city: searchRegex },
{ pincode: searchRegex }
]
}).select("email");
const matchingSellerEmails = matchingSellers.map(seller => seller.email).filter(Boolean);
const searchFilter = {
$or: [
{ medicine_name: searchRegex },
{ brand: searchRegex },
{ category: searchRegex },
...(matchingSellerEmails.length ? [{ seller_email: { $in: matchingSellerEmails } }] : [])
]
};

medicineFilter = Object.keys(medicineFilter).length
? { $and: [medicineFilter, searchFilter] }
: searchFilter;
}

const medicines = await Medicine.find(medicineFilter);
const enrichedMedicines = await enrichMedicinesWithSellerDetails(medicines);

res.json(enrichedMedicines);

}

catch(error){

console.log(error);
res.status(500).json({
success: false,
message: "Error fetching medicines"
});

}

});

app.get("/api/nearby-pharmacies", async (req, res) => {
  try{
    const userLocation = parseCoordinatePair(req.query.lat, req.query.lng);
    const searchTerm = String(req.query.search || req.query.q || "").trim();

    if (!userLocation) {
      return res.status(400).json({
        success: false,
        error: "Missing latitude or longitude"
      });
    }

    const searchRegex = searchTerm ? new RegExp(escapeRegex(searchTerm), "i") : null;
    const medicineCounts = await Medicine.aggregate([
      {
        $group: {
          _id: "$seller_email",
          count: { $sum: 1 }
        }
      }
    ]);
    const medicineCountMap = new Map(
      medicineCounts.map(entry => [String(entry._id || ""), Number(entry.count) || 0])
    );
    const sellers = await Seller.find(searchRegex ? {
      $or: [
        { shopName: searchRegex },
        { pharmacy_name: searchRegex },
        { owner_name: searchRegex },
        { city: searchRegex },
        { pincode: searchRegex },
        { address: searchRegex }
      ]
    } : {});

    const pharmacies = sellers
    .map(seller => {
      const sellerDetails = cleanPublicSeller(seller);
      const sellerLocation = getSellerCoordinates(seller);
      const medicineCount = medicineCountMap.get(String(seller.email || "")) || 0;

      if(!sellerDetails || !sellerLocation || medicineCount <= 0){
        return null;
      }

      const distanceKm = haversineDistanceKm(userLocation, sellerLocation);

      return {
        ...sellerDetails,
        medicineCount,
        distanceKm,
        distance: distanceKm === null ? "Distance unavailable" : `${distanceKm.toFixed(2)} km away`
      };
    })
    .filter(Boolean)
    .sort((first, second) => {
      if(first.distanceKm === null && second.distanceKm === null) return 0;
      if(first.distanceKm === null) return 1;
      if(second.distanceKm === null) return -1;
      return first.distanceKm - second.distanceKm;
    });

    res.json({
      success: true,
      userLocation: {
        lat: userLocation.latitude,
        lng: userLocation.longitude
      },
      pharmacies
    });
  }
  catch(error){
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch nearby pharmacies"
    });
  }
});

app.get("/api/get-pharmacies", async (req, res) => {

try{

const searchText = String(req.query.search || "").trim();
const nameRegex = searchText ? { $regex: escapeRegex(searchText), $options: "i" } : null;
const sellerFilter = nameRegex ? {
$or: [
{ shopName: nameRegex },
{ pharmacy_name: nameRegex },
{ address: nameRegex },
{ city: nameRegex },
{ pincode: nameRegex }
]
} : {};

const medicineCounts = await Medicine.aggregate([
{
$group: {
_id: "$seller_email",
count: { $sum: 1 }
}
}
]);
const medicineCountMap = new Map(
medicineCounts.map(entry => [String(entry._id || ""), Number(entry.count) || 0])
);

const sellers = await Seller.find(sellerFilter);
const pharmacies = sellers
.map(seller => {
const publicSeller = cleanPublicSeller(seller);
const medicineCount = medicineCountMap.get(String(seller.email || "")) || 0;

if(!publicSeller || medicineCount <= 0){
return null;
}

return {
name: publicSeller.name || publicSeller.shopName || publicSeller.pharmacy_name || "Pharmacy",
address: publicSeller.address || "",
city: publicSeller.city || "",
pincode: publicSeller.pincode || "",
lat: publicSeller.lat,
lng: publicSeller.lng,
email: publicSeller.email || "",
shop_image: publicSeller.shop_image || "",
medicineCount
};
})
.filter(Boolean);

res.json({
success: true,
pharmacies
});

}
catch(error){

console.log(error);
res.status(500).json({
success: false,
message: "Unable to fetch pharmacies"
});

}

});

/* ================= SELLER MEDICINES ================= */

app.get("/api/seller-medicines/:email", async (req,res)=>{

try{

const sellerEmail = req.params.email;

const medicines = await Medicine.find({ seller_email: sellerEmail });

res.json(medicines);

}

catch(error){

console.log(error);
res.status(500).json({
success: false,
message: "Error fetching seller medicines"
});

}

});

/* ================= PLACE ORDER ================= */

app.post("/api/place-order", upload.any(), async (req,res)=>{

try{

const buyer_email = req.body.buyer_email;
const medicines = parseRequestPayload(req.body.medicines, []);
const prescriptions = parseRequestPayload(req.body.prescriptions, []);
const delivery_details = parseRequestPayload(req.body.delivery_details, {});
const payment_method = req.body.payment_method;
const uploadedFiles = Array.isArray(req.files) ? req.files : [];
const uploadedFilesByField = new Map(
uploadedFiles.map(file => [file.fieldname, file.filename])
);

const buyer = await Buyer.findOne({ email: buyer_email });

if(!buyer){
return res.status(404).json({
success: false,
message: "Buyer not found"
});
}

if(!medicines || medicines.length === 0){
return res.status(400).json({
success: false,
message: "Cart is empty"
});
}

const groupedOrders = new Map();
const validatedMedicines = [];

for(let item of medicines){

let dbMedicine = item.medicine_id
? await Medicine.findById(item.medicine_id)
: await Medicine.findOne({
medicine_name: item.medicine_name,
...(item.seller_email ? { seller_email: item.seller_email } : {})
});

if(!dbMedicine) continue;

const quantity = Math.max(1, Number(item.quantity) || 1);
const requiresPrescription = String(dbMedicine.prescription_required || "No").toLowerCase() === "yes";
const groupSellerEmail = String(dbMedicine.seller_email || "").trim();
const groupKey = groupSellerEmail;

if(!groupedOrders.has(groupKey)){
groupedOrders.set(groupKey, {
seller_email: groupSellerEmail,
medicines: [],
prescriptions: []
});
}

const group = groupedOrders.get(groupKey);

if(requiresPrescription){
const prescriptionEntry = findMatchingPrescriptionEntry(prescriptions, item, dbMedicine);
const fieldName = String(prescriptionEntry?.field_name || "").trim();
const uploadedFile = fieldName ? uploadedFilesByField.get(fieldName) : "";

if(!uploadedFile){
return res.status(400).json({
success: false,
message: `Prescription upload is required for ${dbMedicine.medicine_name}`
});
}

group.prescriptions.push({
medicine_name: dbMedicine.medicine_name,
file: uploadedFile,
seller_email: dbMedicine.seller_email,
medicine_id: String(dbMedicine._id)
});
}

group.medicines.push({
medicine_name: dbMedicine.medicine_name,
medicine_id: String(dbMedicine._id),
price: dbMedicine.price,
quantity,
image: dbMedicine.images?.[0] || "default.png",
seller_email: dbMedicine.seller_email,
requires_prescription: requiresPrescription,
status: requiresPrescription ? "Waiting for Approval" : "Ordered",
deliveryBoyPhone: dbMedicine.delivery_phone || ""
});

validatedMedicines.push({
medicine: dbMedicine,
quantity
});
}

const orderGroups = [...groupedOrders.values()].filter(group => group.medicines.length > 0);

if(orderGroups.length === 0){
return res.status(400).json({
success: false,
message: "No valid medicines found for this order"
});
}

const buyerDetails = {
name: delivery_details?.name || buyer.name || "",
email: buyer.email || "",
mobile: delivery_details?.mobile || buyer.mobile || "",
address: delivery_details?.address || buyer.address || "",
city: delivery_details?.city || buyer.city || "",
pincode: delivery_details?.pincode || buyer.pincode || "",
location: buyer.location || null
};

const createdOrders = [];

for(const group of orderGroups){
const seller = group.seller_email ? await Seller.findOne({ email: group.seller_email }) : null;
const sellerDetails = seller ? buildOrderSellerDetails(seller) : null;
const calculatedTotal = group.medicines.reduce((sum, medicine) => {
return sum + ((Number(medicine.price) || 0) * (Number(medicine.quantity) || 0));
}, 0);
const orderSummary = summarizeOrderMedicines(group.medicines);
const order = new Order({
buyer_email,
buyer_name: buyerDetails.name,
buyer_phone: buyerDetails.mobile,
address: [buyerDetails.address, buyerDetails.city, buyerDetails.pincode].filter(Boolean).join(", "),
items: group.medicines.map(item => ({
    name: item.medicine_name || "",
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 0,
    image: item.image || ""
})),
total: calculatedTotal,
location: buyerDetails.location ? {
    lat: Number(buyerDetails.location.latitude || buyerDetails.location.lat),
    lng: Number(buyerDetails.location.longitude || buyerDetails.location.lng),
    latitude: Number(buyerDetails.location.latitude || buyerDetails.location.lat),
    longitude: Number(buyerDetails.location.longitude || buyerDetails.location.lng)
} : null,
seller_email: group.seller_email,
medicines: group.medicines,
prescriptions: group.prescriptions,
buyer_details: buyerDetails,
seller_details: sellerDetails,
prescription_file: group.prescriptions[0]?.file || "",
prescription_status: orderSummary.prescriptionStatus,
delivery_location: null,
total_price: calculatedTotal,
payment_method: payment_method || "",
status: orderSummary.orderStatus,
order_status: orderSummary.orderStatus
  });

  function getDistanceKm(lat1, lon1, lat2, lon2) {
    if (
      !Number.isFinite(lat1) ||
      !Number.isFinite(lon1) ||
      !Number.isFinite(lat2) ||
      !Number.isFinite(lon2)
    ) {
      return NaN;
    }
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  let buyerLat = Number(req.body.buyerLat);
  let buyerLng = Number(req.body.buyerLng);
  if (!Number.isFinite(buyerLat) || !Number.isFinite(buyerLng)) {
    buyerLat = Number(buyer.latitude);
    buyerLng = Number(buyer.longitude);
  }
  if (!Number.isFinite(buyerLat) || !Number.isFinite(buyerLng)) {
    const bl = buyer.location;
    buyerLat = Number(bl?.latitude ?? bl?.lat);
    buyerLng = Number(bl?.longitude ?? bl?.lng);
  }

  const sellerLat = Number(seller?.latitude);
  const sellerLng = Number(seller?.longitude);

  const distanceKm = getDistanceKm(buyerLat, buyerLng, sellerLat, sellerLng);

  const deliveryBoyPhone =
    group.medicines
      .map((m) => String(m.deliveryBoyPhone || "").trim())
      .find((p) => p) || "Not assigned";

  order.deliveryBoyPhone = deliveryBoyPhone;
  order.buyerLat = Number.isFinite(buyerLat) ? buyerLat : undefined;
  order.buyerLng = Number.isFinite(buyerLng) ? buyerLng : undefined;
  order.storeLat = Number.isFinite(sellerLat) ? sellerLat : undefined;
  order.storeLng = Number.isFinite(sellerLng) ? sellerLng : undefined;

  if (Number.isFinite(distanceKm) && distanceKm >= 0) {
    order.distanceKm = Number(distanceKm.toFixed(2));
    let etaMin = Math.round(distanceKm * 10);
    let etaMax = Math.round(distanceKm * 15);
    if (etaMax < etaMin) {
      etaMax = etaMin;
    }
    order.etaMin = etaMin;
    order.etaMax = etaMax;
    order.eta = `${etaMin} - ${etaMax} mins`;
  } else {
    order.distanceKm = null;
    order.etaMin = null;
    order.etaMax = null;
    order.eta = "Location unavailable";
  }

  const now = new Date();
  const orderTime = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  order.orderTime = orderTime;
  
  syncOrderState(order);
  await order.save();
  createdOrders.push(buildOrderSnapshot(order));
}

for(const entry of validatedMedicines){
entry.medicine.stock = Number(entry.medicine.stock) - entry.quantity;
if(entry.medicine.stock < 0) entry.medicine.stock = 0;
await entry.medicine.save();
}

res.json({
success: true,
message:"Order placed successfully",
order_id: createdOrders[0]?._id || "",
orders: createdOrders.map(order => ({
_id: order._id,
status: order.order_status || order.status,
prescription_status: order.prescription_status,
total_price: order.total_price,
ordered_items: order.order_summary?.ordered_items || 0,
waiting_items: order.order_summary?.waiting_items || 0,
rejected_items: order.order_summary?.rejected_items || 0
}))
});

}

catch(err){

console.log(err);
res.status(500).json({
success: false,
message: "Order failed"
});

}

});


/* ================= SELLER ORDERS ================= */

app.get("/api/seller-orders/:email", async (req,res)=>{

try{

const orders = await Order.find({ "medicines.seller_email": req.params.email })
.sort({ createdAt: -1 });

res.json(orders.map(order => buildOrderSnapshot(order)));

}

catch(err){

console.log(err);
res.status(500).json({
success: false,
message: "Error fetching seller orders"
});

}

});

app.get("/api/delivery-orders", async (req, res) => {

try{

const orders = await Order.find({
$or: [
{ order_status: "Accepted" },
{ status: "Accepted" }
]
}).sort({ order_date: -1 });

res.json({
success: true,
orders: orders
.map(order => buildOrderSnapshot(order))
.filter(order => order.order_status === "Accepted")
});

}
catch(error){

console.log(error);
res.status(500).json({
success: false,
message: "Unable to fetch accepted delivery orders"
});

}

});

app.post("/api/update-order-status", async (req, res) => {

try{

const { order_id, status } = req.body;
const allowedStatuses = ["Accepted", "Rejected", "Out for Delivery", "Delivered"];

if(!order_id || !allowedStatuses.includes(status)){
return res.status(400).json({
success: false,
message: "Valid order_id and order status are required"
});
}

if(!mongoose.Types.ObjectId.isValid(order_id)){
return res.status(400).json({
success: false,
message: "Valid order_id and order status are required"
});
}

const order = await Order.findById(order_id);

if(!order){
return res.status(404).json({
success: false,
message: "Order not found"
});
}

const currentSnapshot = syncOrderState(order);

if(status === "Accepted"){
applyPrescriptionDecision(order, "Approved");

// Calculate Distance and ETA
const sellerCoords = getSellerCoordinates(order.seller_details);
let buyerCoords = order.buyer_details?.location;
if(
(!buyerCoords || !Number.isFinite(Number(buyerCoords.latitude))) &&
Number.isFinite(Number(order.buyerLat)) &&
Number.isFinite(Number(order.buyerLng))
){
buyerCoords = {
latitude: Number(order.buyerLat),
longitude: Number(order.buyerLng)
};
}

if(sellerCoords && buyerCoords) {
  const distance = haversineDistanceKm(sellerCoords, buyerCoords);
  
  if(distance !== null) {
    let minTime = Math.round(distance * 10);
    let maxTime = Math.round(distance * 15);
    if (maxTime < minTime) {
      maxTime = minTime;
    }

    order.buyerLat = Number(buyerCoords.latitude);
    order.buyerLng = Number(buyerCoords.longitude);
    order.storeLat = sellerCoords.latitude;
    order.storeLng = sellerCoords.longitude;
    order.distanceKm = parseFloat(distance.toFixed(2));
    order.etaMin = minTime;
    order.etaMax = maxTime;
    order.eta = `${minTime} - ${maxTime} mins`;
  }
}
}
else if(status === "Rejected"){
const hasPendingPrescriptionItems = currentSnapshot.medicines.some(item =>
item.requires_prescription && item.status === "Waiting for Approval"
);

if(hasPendingPrescriptionItems){
applyPrescriptionDecision(order, "Rejected");
}
else{
order.medicines = currentSnapshot.medicines.map(item => ({
...item,
status: "Rejected"
}));
order.status = "Rejected";
order.order_status = "Rejected";
order.prescription_status = currentSnapshot.order_summary?.prescription_items ? "Rejected" : "Not Required";
}
}
else{
if(currentSnapshot.order_summary?.waiting_items){
return res.status(400).json({
success: false,
message: "All prescription medicines must be approved before delivery can begin"
});
}

order.status = status;
order.order_status = status;
}

await order.save();

res.json({
success: true,
message: `Order ${status.toLowerCase()} successfully`,
order: buildOrderSnapshot(order)
});

}

catch(error){

console.log(error);
res.status(500).json({
success: false,
message: "Unable to update order status"
});

}

});

app.post("/api/update-prescription-status", async (req, res) => {

try{

const { order_id, status } = req.body;
const allowedStatuses = ["Approved", "Rejected"];

if(!order_id || !allowedStatuses.includes(status)){
return res.status(400).json({
success: false,
message: "Valid order_id and prescription status are required"
});
}

if(!mongoose.Types.ObjectId.isValid(order_id)){
return res.status(400).json({
success: false,
message: "Valid order_id and prescription status are required"
});
}

const order = await Order.findById(order_id);

if(!order){
return res.status(404).json({
success: false,
message: "Order not found"
});
}

if(!Array.isArray(order.prescriptions) || order.prescriptions.length === 0){
return res.status(400).json({
success: false,
message: "No prescription files are attached to this order"
});
}

const currentSnapshot = syncOrderState(order);
const hasPendingPrescriptionItems = currentSnapshot.medicines.some(item =>
item.requires_prescription && item.status === "Waiting for Approval"
);

if(!hasPendingPrescriptionItems && status === "Approved"){
return res.status(400).json({
success: false,
message: "No prescription approvals are pending for this order"
});
}

applyPrescriptionDecision(order, status);

await order.save();

res.json({
success: true,
message: `Prescription ${status.toLowerCase()} successfully`,
order: buildOrderSnapshot(order)
});

}

catch(error){

console.log(error);
res.status(500).json({
success: false,
message: "Unable to update prescription status"
});

}

});

app.get("/api/seller-profile/:email", async (req, res) => {

try{

const seller = await Seller.findOne({ email: req.params.email });

if(!seller){
return res.status(404).json({ success: false, message: "Seller not found" });
}

res.json({
success: true,
email: seller.email,
profile: cleanPublicSeller(seller)
});

}

catch(error){

console.log(error);
res.status(500).json({ success: false, message: "Unable to fetch seller profile" });

}

});

async function handleSellerProfileUpdate(req, res){

try{

const currentSeller = await Seller.findOne({ email: req.params.email });

if(!currentSeller){
return res.status(404).json({ success: false, message: "Seller not found" });
}

const nextShopName = String(req.body.shopName || req.body.pharmacy_name || "").trim();
const nextEmail = String(req.body.email || "").trim();
const hasLocationFields =
Object.prototype.hasOwnProperty.call(req.body, "latitude") ||
Object.prototype.hasOwnProperty.call(req.body, "longitude");
const nextLocation = parseLocation(req.body);

if(hasLocationFields && !nextLocation && (req.body.latitude !== "" || req.body.longitude !== "")){
return res.status(400).json({
success: false,
message: "Valid latitude and longitude are required"
});
}

const sellerUpdate = {
owner_name: String(req.body.owner_name || "").trim(),
shopName: nextShopName,
pharmacy_name: nextShopName,
mobile: String(req.body.mobile || "").trim(),
email: nextEmail,
address: String(req.body.address || "").trim(),
city: String(req.body.city || "").trim(),
pincode: String(req.body.pincode || "").trim(),
gstin: String(req.body.gstin || "").trim()
};

if(req.file){
  sellerUpdate.shop_image = req.file.filename;
}

if(
!sellerUpdate.owner_name ||
!sellerUpdate.shopName ||
!sellerUpdate.mobile ||
!sellerUpdate.email ||
!sellerUpdate.address ||
!sellerUpdate.city ||
!sellerUpdate.pincode ||
!sellerUpdate.gstin
){
return res.status(400).json({
success: false,
message: "All seller details are required"
});
}

if(nextLocation){
sellerUpdate.latitude = nextLocation.latitude;
sellerUpdate.longitude = nextLocation.longitude;
sellerUpdate.location = buildSellerGeoLocation(nextLocation);
}

if(sellerUpdate.email !== currentSeller.email){
const duplicateSeller = await Seller.findOne({ email: sellerUpdate.email });
if(duplicateSeller && String(duplicateSeller._id) !== String(currentSeller._id)){
return res.status(409).json({
success: false,
message: "Another seller account already uses this email"
});
}

const duplicateBuyer = await Buyer.findOne({ email: sellerUpdate.email });
if(duplicateBuyer){
return res.status(409).json({
success: false,
message: "This email is already used by a buyer account"
});
}
}

const previousEmail = currentSeller.email;

currentSeller.set(sellerUpdate);
await currentSeller.save();

const profile = cleanPublicSeller(currentSeller);
const orderSellerDetails = buildOrderSellerDetails(currentSeller);

if(previousEmail !== currentSeller.email){
await Promise.all([
Order.updateMany({ seller_email: previousEmail }, { $set: { seller_details: orderSellerDetails } }),
Order.updateMany({ seller_email: currentSeller.email }, { $set: { seller_details: orderSellerDetails } })
]);
} else {
await Order.updateMany({ seller_email: currentSeller.email }, { $set: { seller_details: orderSellerDetails } });
}

res.json({
success: true,
email: currentSeller.email,
profile
});

} catch(error){

console.log(error);
res.status(500).json({ success: false, message: "Unable to update seller profile" });

}

}

app.put("/api/seller-profile/:email", handleSellerProfileUpdate);
app.post("/api/seller-profile/:email", handleSellerProfileUpdate);

app.put("/api/seller-profile/:email", upload.single("shop_image"), handleSellerProfileUpdate);
app.post("/api/seller-profile/:email", upload.single("shop_image"), handleSellerProfileUpdate);

app.put("/api/seller-profile/:email/location", async (req, res) => {

try{

const location = parseLocation(req.body);

if(!location){
return res.status(400).json({ success: false, message: "Valid latitude and longitude are required" });
}

const seller = await Seller.findOneAndUpdate(
{ email: req.params.email },
{
latitude: location.latitude,
longitude: location.longitude,
location: buildSellerGeoLocation(location)
},
{ new: true }
);

if(!seller){
return res.status(404).json({ success: false, message: "Seller not found" });
}

await Order.updateMany(
{ seller_email: seller.email },
{ $set: { seller_details: buildOrderSellerDetails(seller) } }
);

res.json({
success: true,
profile: cleanPublicSeller(seller)
});

}

catch(error){

console.log(error);
res.status(500).json({ success: false, message: "Unable to update seller location: " + error.message });

}

});

async function handleStoreLocationSave(req, res){

try{

const seller_email = String(req.body.seller_email || "").trim();
const location = parseLocation(req.body);

if(!seller_email || !location){
return res.status(400).json({
success: false,
message: "Valid seller_email, lat, and lng are required"
});
}

const seller = await Seller.findOneAndUpdate(
{ email: seller_email },
{
latitude: location.latitude,
longitude: location.longitude,
location: buildSellerGeoLocation(location)
},
{ new: true }
);

if(!seller){
return res.status(404).json({
success: false,
message: "Seller not found"
});
}

await Order.updateMany(
{ seller_email: seller.email },
{ $set: { seller_details: buildOrderSellerDetails(seller) } }
);

res.json({
success: true,
email: seller.email,
profile: cleanPublicSeller(seller)
});

}
catch(error){

console.log(error);
res.status(500).json({
success: false,
message: "Unable to update seller location: " + error.message
});

}

}

app.post("/api/save-store-location", handleStoreLocationSave);


async function handleAssignDeliveryPhone(req, res) {
  try {
    const orderId = req.body.orderId;
    const phone = String(req.body.phone ?? req.body.deliveryBoyPhone ?? "").trim();

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Valid order ID is required"
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone is required"
      });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { deliveryBoyPhone: phone },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    res.json({
      success: true,
      message: "Delivery contact assigned successfully",
      order: buildOrderSnapshot(order)
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
}

app.post("/api/assign-delivery-contact", handleAssignDeliveryPhone);
app.post("/api/assign-delivery", handleAssignDeliveryPhone);

async function handleGetOrderById(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json(buildOrderSnapshot(order));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

app.get("/api/orders/:id", handleGetOrderById);
app.get("/api/order/:id", handleGetOrderById);

app.put("/api/orders/:id", async (req, res) => {
  try {
    const { deliveryContact } = req.body;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { deliveryContact },
      { new: true }
    );

    res.json({ success: true, order });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/update-delivery-location", async (req, res) => {

try{

const { order_id } = req.body;
const location = parseLocation(req.body);

if(!order_id || !mongoose.Types.ObjectId.isValid(order_id) || !location){
return res.status(400).json({
success: false,
message: "Valid order_id, lat, and lng are required"
});
}

const order = await Order.findById(order_id);

if(!order){
return res.status(404).json({
success: false,
message: "Order not found"
});
}

const currentSnapshot = syncOrderState(order);
const currentStatus = normalizeOrderStatus(currentSnapshot.order_status || currentSnapshot.status);

if(currentStatus === "Rejected" || currentStatus === "Delivered"){
return res.status(400).json({
success: false,
message: "This order is no longer available for live delivery updates"
});
}

if(!["Accepted", "Out for Delivery"].includes(currentStatus)){
return res.status(400).json({
success: false,
message: "This order is not ready for delivery tracking yet"
});
}

order.delivery_location = buildDeliveryLocation(location);

if(currentStatus === "Accepted"){
order.status = "Out for Delivery";
order.order_status = "Out for Delivery";
}

await order.save();

res.json({
success: true,
message: "Delivery location updated successfully",
order: buildOrderSnapshot(order)
});

}
catch(error){

console.log(error);
res.status(500).json({
success: false,
message: "Unable to update delivery location: " + error.message
});

}

});

app.get("/api/orders", async(req,res)=>{

try{

const buyerEmail = req.query.buyer_email;

if(!buyerEmail){
return res.status(400).json({
success: false,
message: "Buyer email required"
});
}

const orders = await Order.find({ buyer_email: buyerEmail });

res.json(orders.map(order => buildOrderSnapshot(order)));

}

catch(err){

console.log(err);
res.status(500).json({
success: false,
message: "Error fetching orders"
});

}

});

/* ================= DELETE MEDICINE ================= */

app.delete("/api/delete-medicine/:id", async (req,res)=>{

try{

const id = req.params.id;

await Medicine.findByIdAndDelete(id);

res.json({message:"Medicine deleted successfully"});

}

catch(error){

console.log(error);
res.status(500).json({
success: false,
message: "Error deleting medicine"
});

}

});

/* ================= RAZORPAY ORDER ================= */

app.post("/api/create-order", async (req,res)=>{

try{

	const { amount } = req.body;

	const options = {

		amount: amount * 100,
		currency: "INR",
		receipt: "receipt_order"

	};

	const order = await razorpay.orders.create(options);

	res.json(order);

}

catch(error){

	console.log(error);
	res.status(500).json({
		success: false,
		message: "Error creating payment order"
	});

}

});

/* ================= STATIC FILES & START SERVER ================= */

/* ================= GET SINGLE MEDICINE ================= */

app.get("/api/medicine/:id", async (req, res) => {
  try {
    const med = await Medicine.findById(req.params.id);
    if(!med){
      return res.json(null);
    }

    const [enrichedMedicine] = await enrichMedicinesWithSellerDetails([med]);
    res.json(enrichedMedicine);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ================= UPDATE MEDICINE ================= */

app.put("/api/update-medicine/:id", upload.array("images", 5), async (req, res) => {

  try {

    const updateData = {
      medicine_name: req.body.medicine_name,
      brand: req.body.brand,
      category: req.body.category,
      price: Number(req.body.price),
      stock: Number(req.body.stock),
      expiry_date: req.body.expiry_date,
      manufacturer: req.body.manufacturer,
      prescription_required: req.body.prescription_required,
      description: req.body.description
    };

    if (req.body.delivery_phone !== undefined) {
      updateData.delivery_phone = req.body.delivery_phone;
    }

    // if new image uploaded
    if (req.files && req.files.length > 0) {
    updateData.images = req.files.map(file => file.filename);
    }

    await Medicine.findByIdAndUpdate(req.params.id, updateData);

    res.json({ message: "Medicine updated successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(express.static("public"));

// Root route - serve homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "HOMEPAGE.HTML"));
});

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access via: http://<your-network-ip>:${PORT} or via ngrok`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

module.exports = app;
