import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: User not found" });
    }

    req.user = user;
    next();
  } catch {
    return res
      .status(403)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

export const verifyAdmin = (req, res, next) => {
  if (req.user?.role === "admin") return next();
  return res
    .status(403)
    .json({ success: false, message: "Forbidden: Admin access only" });
};
