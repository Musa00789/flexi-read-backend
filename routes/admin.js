const express = require("express");
const User = require("../models/User");
const { verifyToken, isAdmin } = require("../middlewares/auth");

const Category = require("../models/Category");
const Purchase = require("../models/Purchase");

const router = express.Router();

router.get("/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).send(users);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.delete("/users/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).send("User deleted.");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.post("/createCategory", verifyToken, isAdmin, async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Category name is required" });
  }
  try {
    const category = new Category({ name });
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ message: "Failed to create category" });
  }
});

router.delete("/deleteCategory/:id", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    await category.remove();
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Failed to delete category" });
  }
});

router.get("/getAllPurchases", verifyToken, isAdmin, async (req, res) => {
  try {
    const purchases = await Purchase.find().populate("bookId").exec();
    res.status(200).json(purchases);
  } catch (error) {
    console.error("Error fetching all purchases:", error);
    res.status(500).json({ message: "Failed to fetch purchases" });
  }
});

router.get("/getAllOrders", verifyToken, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find().populate("bookId").exec();
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

router.delete("/deleteBook/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await Book.findById(bookId);
    // const deletedBook = await Book.findByIdAndDelete(bookId);

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (book.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await book.remove();

    res.status(200).json({ message: "Book deleted successfully", deletedBook });
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).json({ message: "Failed to delete book" });
  }
});

module.exports = router;
