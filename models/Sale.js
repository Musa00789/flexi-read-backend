const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Book",
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  points: { type: Number, required: true },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Sale", saleSchema);
