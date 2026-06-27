const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
latitude: Number,
longitude: Number
}, { _id: false });

const deliveryLocationSchema = new mongoose.Schema({
lat: Number,
lng: Number,
latitude: Number,
longitude: Number
}, { _id: false });

const buyerDetailsSchema = new mongoose.Schema({
name: String,
email: String,
mobile: String,
address: String,
city: String,
pincode: String,
location: locationSchema
}, { _id: false });

const sellerDetailsSchema = new mongoose.Schema({
owner_name: String,
pharmacy_name: String,
email: String,
mobile: String,
address: String,
city: String,
pincode: String,
location: locationSchema
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
medicine_name: String,
file: String,
seller_email: String,
medicine_id: String
}, { _id: false });

const itemSchema = new mongoose.Schema({
name: String,
price: Number,
quantity: Number,
image: String
}, { _id: false });

const medicineOrderSchema = new mongoose.Schema({
medicine_name: String,
medicine_id: String,
price: Number,
quantity: Number,
image: String,
seller_email: String,
requires_prescription: {
    type: Boolean,
    default: false
},
status: {
    type: String,
    default: "Ordered"
}
}, { _id: false });

const orderSchema = new mongoose.Schema({
buyer_email: {
    type: String,
    required: true
},

buyer_name: String,
buyer_phone: String,
address: String,
items: [itemSchema],
total: Number,
  latitude: Number,
  longitude: Number,
  buyerLat: Number,
  buyerLng: Number,
  storeLat: Number,
  storeLng: Number,
  distanceKm: { type: Number, default: 0 },
  etaMin: { type: Number },
  etaMax: { type: Number },
  eta: { type: String, default: "Location unavailable" },
  deliveryBoyPhone: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
location: {
    lat: Number,
    lng: Number,
    latitude: Number,
    longitude: Number
},
location_updated_at: Date,

seller_email: String,
seller_details: sellerDetailsSchema,
buyer_details: buyerDetailsSchema,

medicines: [medicineOrderSchema],
prescriptions: [prescriptionSchema],

prescription_file: String,
prescription_status: {
type: String,
default: "Pending"
},

delivery_location: deliveryLocationSchema,

total_price: {
type: Number,
required: true
},

payment_method: String,

order_date: {
type: Date,
default: Date.now
},

status: {
type: String,
default: "Waiting for Approval"
},

order_status: {
type: String,
default: "Waiting for Approval"
},

orderTime: {
    type: String
},
orderTimestamp: {
    type: String
}
});

orderSchema.pre("validate", function() {
const nextStatus = String(this.order_status || this.status || "Waiting for Approval");
this.order_status = nextStatus;
this.status = nextStatus;

if(!this.buyer_name && this.buyer_details?.name){
    this.buyer_name = this.buyer_details.name;
}
if(!this.buyer_phone && this.buyer_details?.mobile){
    this.buyer_phone = this.buyer_details.mobile;
}
if(!this.address){
    this.address = [
        this.buyer_details?.address,
        this.buyer_details?.city,
        this.buyer_details?.pincode
    ].filter(Boolean).join(", ");
}
if(!Array.isArray(this.items) || this.items.length === 0){
    this.items = Array.isArray(this.medicines)
        ? this.medicines.map(item => ({
            name: item.medicine_name || "",
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 0,
            image: item.image || ""
        }))
        : [];
}
if(this.total == null){
    this.total = Number(this.total_price || 0);
}

const locationLat = Number(this.location?.latitude ?? this.location?.lat ?? this.delivery_location?.latitude ?? this.delivery_location?.lat);
const locationLng = Number(this.location?.longitude ?? this.location?.lng ?? this.delivery_location?.longitude ?? this.delivery_location?.lng);

if(Number.isFinite(locationLat) && Number.isFinite(locationLng)){
    this.location = {
        lat: locationLat,
        lng: locationLng,
        latitude: locationLat,
        longitude: locationLng
    };
}

const latitude = Number(this.delivery_location?.latitude ?? this.delivery_location?.lat);
const longitude = Number(this.delivery_location?.longitude ?? this.delivery_location?.lng);

if(Number.isFinite(latitude) && Number.isFinite(longitude)){
    this.delivery_location = {
        lat: latitude,
        lng: longitude,
        latitude,
        longitude
    };
}
});

module.exports = mongoose.model("Order", orderSchema);
