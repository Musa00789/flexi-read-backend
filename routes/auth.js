const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
require("dotenv").config();
const axios = require("axios");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const User = require("../models/User");
const { verifyToken, isAdmin } = require("../middlewares/auth");
const uploadProfilePicture = require("../middlewares/multer");
const Sale = require("../models/Sale");
const Activity = require("../models/Activity");
const Book = require("../models/Book");
const Order = require("../models/Order");
const Category = require("../models/Category");
const Purchase = require("../models/Purchase");
const Review = require("../models/Review");
// const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "uploads", req.user.id);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only PDF and image files are allowed."));
  }
};

const upload = multer({ storage, fileFilter });

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

router.post("/forgotPassword", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send({ message: "User not found." });

    const mailOptions = {
      from: process.env.EMAIL,
      to: user.email,
      subject: "Forgot Password",
      text: "Hello, this is a test email from Node.js using Nodemailer.",
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent:", info.response);
      }
    });

    res
      .status(200)
      .send({ message: "Forgot Password Email sent successfully." });
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

router.get("/user/:id", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

router.get("/getUserPoints", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ points: user.points });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch points" });
  }
});

router.put("/rewardPoints", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.points += parseInt(req.body.points);
    await user.save();
    res.status(200).json({ user });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Failed to add points" });
  }
});

router.post(
  "/uploadProfile/:id",
  // verifyToken,
  uploadProfilePicture.single("profilePicture"),
  async (req, res) => {
    try {
      const userId = req.params.id;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
      }

      const imageUrl = `/users/${userId}/${req.file.filename}`;

      // Update user's profile picture in the database
      await User.findByIdAndUpdate(userId, {
        profilePicture: `${req.protocol}://${req.get("host")}${imageUrl}`,
      });

      res
        .status(200)
        .json({ message: "Profile picture updated successfully", imageUrl });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

router.get("/dashboard", verifyToken, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const booksListed = await Book.countDocuments({ userId });
    console.log("boksListed" + booksListed);
    const booksSold = await Sale.countDocuments({ sellerId: userId });
    console.log("boksSold" + booksSold);
    const earnings = await Sale.aggregate([
      { $match: { sellerId: userId } },
      { $group: { _id: null, total: { $sum: "$points" } } },
    ]);
    console.log("earnings" + earnings);
    const recentActivity = await Activity.find({ userId })
      .sort({ date: -1 })
      .limit(5);

    res.status(200).json({
      booksListed,
      booksSold,
      earnings: earnings.length > 0 ? earnings[0].total / 4 : 0,
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

router.post(
  "/uploadBook",
  verifyToken,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "bookCoverImage", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, author, aboutBook, category, price, rating } = req.body;
      const file = req.files.file ? req.files.file[0] : null;
      const coverImage = req.files.bookCoverImage
        ? req.files.bookCoverImage[0]
        : null;
      const userId = req.user.id;

      if (!file || !coverImage) {
        return res
          .status(400)
          .json({ message: "Both file and cover image are required." });
      }

      if (!title || !author || !category || !price || !rating) {
        return res.status(400).json({ message: "All fields are required." });
      }
      const points = price * 4;
      const newBook = new Book({
        title,
        author,
        aboutBook,
        category,
        price,
        rating,
        points,
        filePath: file.path,
        bookCoverImage: coverImage.path,
        userId,
      });
      const savedBook = await newBook.save();
      const activity = new Activity({
        userId,
        message: `Added "${savedBook.title}" to the inventory.`,
      });
      await activity.save();

      console.log("Book uploaded successfully.");
      res.status(201).json(savedBook);
    } catch (error) {
      console.error("Error uploading book:", error);
      res.status(500).json({ message: "Failed to upload book" });
    }
  }
);

router.get("/getMyBooks", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const books = await Book.find({ userId }).exec();
    const booksWithLinks = books.map((book) => ({
      ...book.toObject(),
      bookCoverImage: book.bookCoverImage
        ? `${req.protocol}://${req.get("host")}/uploads/${
            book.userId
          }/${path.basename(book.bookCoverImage)}`
        : fs.readFileSync(book.bookCoverImage).toString("base64"),
      pdfLink: `/api/books/${book._id}/read`,
    }));
    res.status(200).json(booksWithLinks);
  } catch (error) {
    console.error("Error fetching user-specific books:", error);
    res.status(500).json({ message: "Failed to fetch books" });
  }
});

router.get("/getAllBooks", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page
    const limit = parseInt(req.query.limit) || 10; // Number of books per page
    const skip = (page - 1) * limit;

    const books = await Book.find()
      .skip(skip)
      .limit(limit)
      .select("-filePath")
      .exec();
    const totalBooks = await Book.countDocuments();

    const booksWithUrls = books.map((book) => ({
      ...book.toObject(),
      bookCoverImage: book.bookCoverImage
        ? `${req.protocol}://${req.get("host")}/uploads/${
            book.userId
          }/${path.basename(book.bookCoverImage)}`
        : fs.readFileSync(book.bookCoverImage).toString("base64"),
    }));

    res.status(200).json({
      books: booksWithUrls,
      totalBooks,
      totalPages: Math.ceil(totalBooks / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ message: "Failed to fetch books" });
  }
});

router.get("/randomBooks", verifyToken, async (req, res) => {
  try {
    const books = await Book.aggregate([{ $sample: { size: 15 } }]);

    const booksWithUrls = books.map((book) => {
      const bookObj = book.toObject ? book.toObject() : book;
      return {
        ...bookObj,
        bookCoverImage: bookObj.bookCoverImage
          ? `${req.protocol}://${req.get("host")}/uploads/${
              bookObj.userId
            }/${path.basename(bookObj.bookCoverImage)}`
          : fs.readFileSync(bookObj.bookCoverImage).toString("base64"),
      };
    });

    res.status(200).json(booksWithUrls);
  } catch (error) {
    console.error("Error fetching random books:", error);
    res.status(500).json({ message: "Failed to fetch random books" });
  }
});

router.get("/getBook/:bookId", verifyToken, async (req, res) => {
  try {
    const book = await Book.findById(req.params.bookId);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    const bookWithLinks = {
      ...book.toObject(),
      bookCoverImage: book.bookCoverImage
        ? `${req.protocol}://${req.get("host")}/uploads/${
            book.userId
          }/${path.basename(book.bookCoverImage)}`
        : null,
      pdfLink: book.filePath
        ? `${req.protocol}://${req.get("host")}/uploads/${
            book.userId
          }/${path.basename(book.filePath)}`
        : null,
    };

    res.status(200).json(bookWithLinks);
  } catch (error) {
    console.error("Error fetching book:", error);
    res.status(500).json({ message: "Failed to fetch book details" });
  }
});

router.get("/:id/read", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findOne({
      buyerId: req.user.id,
      bookId: id,
    });
    if (!purchase) {
      return res
        .status(403)
        .json({ message: "You have not purchased this book." });
    }
    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ message: "Book not found." });
    }

    res.sendFile(book.filePath, { root: "./uploads/" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred." });
  }
});

router.post("/purchaseBook/:id", verifyToken, async (req, res) => {
  try {
    const bookId = req.params.id;
    const buyerId = req.user.id;

    if (!bookId) {
      return res.status(400).json({ message: "Book ID is required." });
    }

    // Fetch the book details
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: "Book not found." });
    }

    // Check if user has already purchased this book
    const existingPurchase = await Purchase.findOne({ buyerId, bookId });

    if (existingPurchase) {
      return res.status(400).json({
        message: "You have already purchased this book.",
      });
    }

    // Fetch user details using userId
    const user = await User.findById(buyerId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if the user has enough points
    if (user.points < book.points) {
      return res.status(400).json({
        message: `Insufficient points. You need ${book.points} points to purchase this book.`,
      });
    }

    // Deduct points from the user
    user.points -= book.points;
    await user.save();

    const seller = await User.findById(book.userId);
    seller.points += book.points;

    // Create new purchase record
    const purchase = new Purchase({
      buyerId,
      bookId,
      pointsSpent: book.points,
    });

    await purchase.save();
    const sale = new Sale({
      bookId,
      buyerId,
      sellerId: book.userId,
      points: book.points,
    });
    await sale.save();
    await seller.save();

    return res.status(201).json({
      message: "Book purchased successfully.",
      book: {
        id: book._id,
        title: book.title,
        pointsCost: book.points,
      },
      purchase: {
        id: purchase._id,
        pointsSpent: purchase.pointsSpent,
      },
      remainingPoints: user.points,
    });
  } catch (error) {
    console.error("Error purchasing book:", error);
    return res.status(500).json({
      message: "An error occurred. Please try again later.",
    });
  }
});

router.post("/addReview/:bookId", verifyToken, async (req, res) => {
  try {
    const { rating, comment } = req.body.reviewData;
    const review = new Review({
      bookId: req.params.bookId,
      userId: req.user.id,
      rating,
      comment,
    });
    await review.save();
    res.status(201).json({ message: "Review added successfully", review });
  } catch (error) {
    console.error("Error adding review:", error);
    res
      .status(500)
      .json({ message: "Failed to add review", error: error.message });
  }
});

router.get("/getReviews/:bookId", async (req, res) => {
  try {
    const reviews = await Review.find({ bookId: req.params.bookId })
      .populate("userId", "username")
      .sort({ createdAt: -1 });
    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch reviews", error: error.message });
  }
});

router.get("/myPurchases", verifyToken, async (req, res) => {
  try {
    const buyerId = req.user.id;
    const purchases = await Purchase.find({ buyerId })
      .populate("bookId")
      .exec();

    if (!purchases.length) {
      return res.status(404).json({ message: "No purchased books found." });
    }

    const purchasedBooks = purchases.map((purchase) => ({
      id: purchase.bookId._id,
      title: purchase.bookId.title,
      author: purchase.bookId.author,
      status: "Purchased",
      category: purchase.bookId.category,
      bookCoverImage: `${req.protocol}://${req.get("host")}/uploads/${
        purchase.bookId.userId
      }/${path.basename(purchase.bookId.bookCoverImage)}`,
      pointsSpent: purchase.pointsSpent,
      purchaseDate: purchase.purchaseDate,
    }));

    return res.status(200).json({ books: purchasedBooks });
  } catch (error) {
    console.error("Error fetching purchased books:", error);
    return res.status(500).json({ message: "Failed to fetch purchased books" });
  }
});

router.put(
  "/updateBook/:id",
  verifyToken,
  upload.fields([{ name: "bookCoverImage", maxCount: 1 }]),
  async (req, res) => {
    try {
      const { title, author, aboutBook, category, price } = req.body;
      const updateData = {};

      // Only update title if provided and non-empty
      if (title && title.trim() !== "") {
        updateData.title = title;
      }

      // Only update author if provided and non-empty
      if (author && author.trim() !== "") {
        updateData.author = author;
      }
      if (aboutBook && aboutBook.trim() !== "") {
        updateData.aboutBook = aboutBook;
      }
      const parsedCategory = JSON.parse(category);

      // Only update category if provided and valid.

      // Only update price (and recalc points) if provided
      if (price) {
        updateData.price = price;
        updateData.points = price * 4;
      }

      // Update bookCoverImage only if a new file is provided
      if (
        req.files &&
        req.files.bookCoverImage &&
        req.files.bookCoverImage[0]
      ) {
        updateData.bookCoverImage = req.files.bookCoverImage[0].path;
      }

      // Fetch the current book document first to perform authorization check
      const book = await Book.findById(req.params.id);
      if (!book) {
        return res.status(404).json({ message: "Book not found." });
      }

      if (
        Array.isArray(parsedCategory) &&
        parsedCategory.length > 0 &&
        parsedCategory[0] != null
      ) {
        updateData.category = parsedCategory;
      } else {
        updateData.category = [];
        book.category.forEach((cat) => updateData.category.push(cat));
      }

      // Only allow update if current user is the owner or an admin
      if (book.userId.toString() !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // If no updateData is provided, simply return the current book
      if (Object.keys(updateData).length === 0) {
        return res.status(200).json({
          message: "No fields provided to update.",
          updatedBook: book,
        });
      }
      console.log(updateData);
      // Perform the update
      const updatedBook = await Book.findByIdAndUpdate(
        req.params.id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

      res.status(200).json({
        message: "Book updated successfully",
        updatedBook,
      });
    } catch (error) {
      console.error("Error updating book:", error);
      res.status(500).json({ message: "Failed to update book" });
    }
  }
);

router.get("/getCategories", async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.delete("/deleteBook/:id", verifyToken, async (req, res) => {
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

    await book.deleteOne();

    res.status(200).json({ message: "Book deleted successfully" });
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).json({ message: "Failed to delete book" });
  }
});

/////////////////////// suggestions provided by gpt //////////////////////

router.post("/addCategory", verifyToken, async (req, res) => {
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

router.delete("/deleteCategory/:id", verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await Category.findByIdAndDelete(id);
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: "Failed to delete category" });
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

router.get("/getMyOrders", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).exec();
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

router.put("/updateProfile", verifyToken, async (req, res) => {
  try {
    const { username, aboutAuthor, password } = req.body.updateData;
    console.log(req.body);
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (username && username.trim() !== "") {
      user.username = username;
    }
    if (aboutAuthor && aboutAuthor.trim() !== "") {
      user.aboutAuthor = aboutAuthor;
    }
    if (password && password.trim() !== "") {
      // const hashedPassword = await bcrypt.hash(password, 10);
      user.password = password;
    }
    await user.save();
    res.status(200).json({ message: "Profile updated successfully", user });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

router.put("/changeRole", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.role = "Author";
    await user.save();
    res.status(200).json({ message: "Role changed successfully", user });
  } catch (error) {
    console.error("Error changing role:", error);
    res.status(500).json({ message: "Failed to change role" });
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

router.get("/downloadBook/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Only allow book owner or admin to download the file
    if (book.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.sendFile(book.filePath, { root: "./uploads/" });
  } catch (error) {
    console.error("Error downloading book file:", error);
    res.status(500).json({ message: "Failed to download book" });
  }
});

router.post("/summarize", verifyToken, async (req, res) => {
  try {
    const { text } = req.body;

    const response = await axios.post("http://localhost:5001/summarize", {
      text,
    });

    res.json({ summary: response.data.summary });
  } catch (error) {
    console.error("Summarization error:", error);
    res.status(500).json({ error: "Summarization failed" });
  }
});

/////// Stripe Payment Route ////
router.post("/payment", verifyToken, async (req, res) => {
  const { token, amount } = req.body;
  try {
    console.log("Payment amount:", amount);
    const charge = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });

    const user = await User.findById(req.user.id);
    user.points += parseInt(amount * 4);
    await user.save();

    res.json({ success: true, charge, user });
  } catch (error) {
    console.error("Payment failed:", error);
    res.status(500).json({ message: "Payment failed" });
  }
});

module.exports = router;
