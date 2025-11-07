import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import logger from "../config/logger.js";

const ACCESS_EXPIRES = "1h";
const REFRESH_EXPIRES = "30d";
const REFRESH_COOKIE = "refreshToken";

const signAccess = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  });

const signRefresh = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES,
  });

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
};

export const signup = async (req, res, next) => {
  try {
    const { name, username, password } = req.body;
    const exists = await User.findOne({ username });
    if (exists) {
      return res
        .status(400)
        .json({ success: false, message: "Username exists" });
    }
    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, username, password: hashed });

    res.status(201).json({ success: true, message: "Signup successful" });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);
    user.refreshToken = refreshToken;
    await user.save();

    setRefreshCookie(res, refreshToken);
    res.json({
      success: true,
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (req, res) => {
  try {
    const oldToken = req.cookies[REFRESH_COOKIE];
    if (!oldToken) {
      return res
        .status(401)
        .json({ success: false, message: "No refresh token" });
    }

    const user = await User.findOne({ refreshToken: oldToken });
    if (!user) {
      return res
        .status(403)
        .json({ success: false, message: "Session invalid" });
    }

    jwt.verify(oldToken, process.env.JWT_REFRESH_SECRET);

    const newAccess = signAccess(user);
    const newRefresh = signRefresh(user);

    user.refreshToken = newRefresh;
    await user.save();
    setRefreshCookie(res, newRefresh);

    res.json({ success: true, accessToken: newAccess });
  } catch (err) {
    logger.error("Error refreshing token:", err);
    res
      .status(403)
      .json({ success: false, message: "Refresh token expired. Login again." });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie(REFRESH_COOKIE);
    if (req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, {
        $unset: { refreshToken: "" },
      });
    }
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    logger.error("Error during logout:", err);
    res.status(500).json({ success: false, message: "Logout failed" });
  }
};

export const checkUsername = async (req, res, next) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res
        .status(400)
        .json({ success: false, message: "Username required" });
    }

    const exists = await User.findOne({ username });
    res.json({
      success: !exists,
      message: exists ? "Username already taken" : "Username is available",
    });
  } catch (err) {
    next(err);
  }
};
