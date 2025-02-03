const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Multer Storage Configuration for Profile Pictures
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.params.id;
    const uploadPath = path.join(process.cwd(), "users", userId);

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.userId}${ext}`);
  },
});

const profileFileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPG, JPEG, and PNG are allowed."));
  }
};

const uploadProfilePicture = multer({
  storage: profileStorage,
  fileFilter: profileFileFilter,
});

module.exports = uploadProfilePicture;
