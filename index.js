// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const path = require("path");

// const connectDB = require("./config/db");
// const authRoutes = require("./routes/auth");
// const adminRoutes = require("./routes/admin");

// const app = express();
// app.use(cors());
// app.use(express.json());

// connectDB();

// app.use("/api/auth", authRoutes);
// app.use("/api/admin", adminRoutes);
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// const PORT = process.env.PORT || 3005;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");

const app = express();
app.use(
  cors({
    origin: "http://localhost:4200",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Connect Database
connectDB();

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/users", express.static(path.join(process.cwd(), "users")));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
