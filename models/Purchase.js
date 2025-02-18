const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },
    pointsSpent: { type: Number, required: true }, // Points used for this purchase
    purchaseDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Purchase = mongoose.model("Purchase", purchaseSchema);
module.exports = Purchase;
