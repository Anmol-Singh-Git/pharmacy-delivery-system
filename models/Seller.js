const mongoose = require("mongoose");

const sellerLocationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["Point"],
    default: "Point"
  },
  lat: Number,
  lng: Number,
  coordinates: {
    type: [Number],
    default: undefined,
    validate: {
      validator(value) {
        return value === undefined || value.length === 2;
      },
      message: "Location coordinates must contain longitude and latitude"
    }
  },
  latitude: Number,
  longitude: Number
}, { _id: false });

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

const sellerSchema = new mongoose.Schema({
  owner_name: String,
  shopName: String,
  pharmacy_name: String,
  mobile: String,
  email: String,
  password: String,
  address: String,
  city: String,
  pincode: String,
  gstin: String,
  shop_image: String,
  latitude: Number,
  longitude: Number,
  location: sellerLocationSchema
});

sellerSchema.index({ location: "2dsphere" });

sellerSchema.pre("validate", function() {
  if (!this.shopName && this.pharmacy_name) {
    this.shopName = this.pharmacy_name;
  }

  if (!this.pharmacy_name && this.shopName) {
    this.pharmacy_name = this.shopName;
  }

  const latitude = toFiniteNumber(
    this.latitude ??
    this.location?.lat ??
    this.location?.latitude ??
    (Array.isArray(this.location?.coordinates) ? this.location.coordinates[1] : undefined)
  );

  const longitude = toFiniteNumber(
    this.longitude ??
    this.location?.lng ??
    this.location?.longitude ??
    (Array.isArray(this.location?.coordinates) ? this.location.coordinates[0] : undefined)
  );

  if (latitude !== undefined && longitude !== undefined) {
    this.latitude = latitude;
    this.longitude = longitude;
    this.location = {
      type: "Point",
      lat: latitude,
      lng: longitude,
      coordinates: [longitude, latitude],
      latitude,
      longitude
    };
  }
});

module.exports = mongoose.model("Seller", sellerSchema);
