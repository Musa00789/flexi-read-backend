const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Book",
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  amount: Number, // The price of the book in this sale
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Sale", saleSchema);
