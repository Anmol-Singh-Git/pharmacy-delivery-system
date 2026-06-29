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
  bio: String,
  mobile: String,
  email: String,
  password: {
    type: String,
    required: [true, "Password is required"],
    validate: {
      validator: function(v) {
        // Enforces: Min 8 chars, Alphanumeric only, >=1 Letter, >=1 Number, No character repeated 3x consecutively
        return /^(?=.*[A-Za-z])(?=.*\d)(?!.*(.)\1\1)[A-Za-z0-9]{8,}$/.test(v);
      },
      message: "Password must be at least 8 alphanumeric characters long, contain at least 1 letter, 1 number, and cannot have any character repeat 3 times consecutively."
    }
  },
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