import User from "../models/User.js";
import bcrypt from "bcryptjs";

export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      "name username balance upiId role createdAt"
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

export const updateUserProfile = async (req, res, next) => {
  try {
    const { name, upiId, oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (name) user.name = name;
    if (upiId) user.upiId = upiId;

    if (newPassword) {
      if (!oldPassword) {
        return res
          .status(400)
          .json({ success: false, message: "Current password is required" });
      }

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res
          .status(400)
          .json({ success: false, message: "Old password is incorrect" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters",
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    res.json({ success: true, message: "Profile updated", user });
  } catch (err) {
    next(err);
  }
};
