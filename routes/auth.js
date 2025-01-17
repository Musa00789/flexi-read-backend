const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const { verifyToken } = require("../middlewares/auth");
const multer = require("multer");

// Configure multer to store files in an 'uploads' directory
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Directory where files will be stored
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname); // Create a unique filename
  },
});

const upload = multer({ storage: storage });

const router = express.Router();

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
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const secretKey = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secretKey);
    res.status(200).json({ message: "Token is valid", user: decoded });
  } catch (err) {
    res.status(403).json({ message: "Invalid or expired token" });
  }
});

router.get("/books", (req, res) => {
  res.json(books);
});

router.post("/uploadBook", upload.single("file"), (req, res) => {
  const { title, author, category, price } = req.body;
  const file = req.file;

  const newBook = {
    id: books.length + 1,
    title,
    author,
    category,
    price,
    filePath: file.path,
  };

  books.push(newBook);
  res.status(201).send(newBook);
});

module.exports = router;
