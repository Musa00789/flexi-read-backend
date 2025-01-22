const multer = require("multer");
const path = require("path");

// Configure multer for storage in the "books" folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "books/"); // Folder for storing uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

const upload = multer({ storage });
