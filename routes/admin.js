const express = require("express");
const User = require("../models/User");
const { verifyToken, isAdmin } = require("../middlewares/auth");

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

module.exports = router;
