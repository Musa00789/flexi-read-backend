const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const User = require("../models/User");
const { verifyToken, isAdmin } = require("../middlewares/auth");
const Sale = require("../models/Sale");
const Activity = require("../models/Activity");
const Book = require("../models/Book");
const Order = require("../models/Order");
const Category = require("../models/Category");
// const uploads = require("../uploads"); // Multer setup

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "books/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post("/signup", async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const user = new User({ username, email, password, role });
    await user.save();
    console.log("user created successfully");
    res.status(201).json({ message: "User created successfully." });
  } catch (error) {
    console.log(error.message);
    res.status(400).send({ message: error.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ message: "User not found." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).send({ message: "Invalid credentials." });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    console.log("user logged in successfully");
    res.status(200).send({ token });
  } catch (error) {
    console.log(error.message);
    res.status(500).send({ message: error.message });
  }
});

router.post("/validate", (req, res) => {
  const authHeader = req.headers["authorization"];
  console.log("Authorization Header:", authHeader); // Debugging

  const token = authHeader && authHeader.split(" ")[1];
  console.log("Extracted Token:", token); // Debugging

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const secretKey = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secretKey);
    res.status(200).json({ message: "Token is valid", user: decoded });
  } catch (err) {
    console.error("Token verification error:", err); // Debugging
    res.status(403).json({ message: "Invalid or expired token" });
  }
});

router.get("/dashboard", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const booksListed = await Book.countDocuments({ userId });
    console.log("boksListed" + booksListed);
    const booksSold = await Sale.countDocuments({ userId });
    console.log("boksSold" + booksSold);
    const earnings = await Sale.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    console.log("earnings" + earnings);
    const recentActivity = await Activity.find({ userId })
      .sort({ date: -1 })
      .limit(5);

    res.status(200).json({
      booksListed,
      booksSold,
      earnings: earnings[0]?.total || 0,
      recentActivity: recentActivity.map((activity) => ({
        message: activity.message,
        date: activity.date,
      })),
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
});

router.get("/sales-report", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.find({ userId }); // Fetch orders for the logged-in user
    if (!orders) {
      return res.status(404).send({ message: "No sales data found" });
    }
    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="sales-report.pdf"');
    doc.pipe(res);
    doc.fontSize(18).text("Sales Report", { align: "center" });
    doc.moveDown();
    orders.forEach((order) => {
      doc.fontSize(12).text(`Order ID: ${order._id}`);
      doc.text(`Book Title: ${order.bookTitle}`);
      doc.text(`Quantity Sold: ${order.quantity}`);
      doc.text(`Price per Item: $${order.price}`);
      doc.text(`Total: $${order.total}`);
      doc.moveDown();
    });
    doc.end();
  } catch (error) {
    console.error("Error generating sales report:", error);
    res.status(500).send({ message: "Failed to generate sales report" });
  }
});

router.post("/uploadBook", upload.single("file"), async (req, res) => {
  try {
    const { title, author, category, price } = req.body;
    const file = req.file;
    const userId = req.user.id;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const newBook = new Book({
      title,
      author,
      category,
      price,
      filePath: file.path,
      userId,
    });
    const savedBook = await newBook.save();
    const activity = new Activity({
      userId,
      message: `Added "${savedBook.title}" to the inventory.`,
    });
    await activity.save();
    res.status(201).json(savedBook);
  } catch (error) {
    console.error("Error uploading book:", error);
    res.status(500).json({ message: "Failed to upload book" });
  }
});

router.get("/books", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const books = await Book.find({ userId });
    res.status(200).json(books);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ message: "Failed to fetch books" });
  }
});

router.delete("/book/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const bookId = req.params.id;
    const deletedBook = await Book.findByIdAndDelete(bookId);

    if (!deletedBook) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.status(200).json({ message: "Book deleted successfully", deletedBook });
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).json({ message: "Failed to delete book" });
  }
});

router.get("/getCategories", async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Add a new category
router.post("/addCategory", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Category name is required" });
  }

  try {
    const category = new Category({ name });
    const savedCategory = await category.save();
    res.status(201).json(savedCategory);
  } catch (err) {
    console.error("Error creating category:", err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// Delete a category
router.delete("/deleteCategory/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await Category.findByIdAndDelete(id);
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

module.exports = router;
