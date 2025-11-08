// controllers/adminController.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Bet from "../models/Bet.js";
import Commission from "../models/Commission.js";
import logger from "../config/logger.js";
import { emitToUser, emitToAdmins } from "../sockets/socketEmitter.js";

const ensureAdmin = (req) => {
  if (!req.user || req.user.role !== "admin") {
    const e = new Error("Forbidden");
    e.status = 403;
    throw e;
  }
};

const toPage = (v, d = 1) => Math.max(1, parseInt(v ?? d, 10) || d);
const toLimit = (v, d = 20, max = 100) =>
  Math.min(max, Math.max(1, parseInt(v ?? d, 10) || d));

export const adminLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
    if (username !== ADMIN_USERNAME) {
      return res
        .status(403)
        .json({ success: false, message: "Only admin allowed" });
    }
    const admin = await User.findOne({ username: ADMIN_USERNAME });
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect password" });
    }

    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      accessToken: token,
      user: { id: admin._id, username: admin.username, role: "admin" },
    });
  } catch (err) {
    next(err);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    ensureAdmin(req);
    const page = toPage(req.query.page);
    const limit = toLimit(req.query.limit);
    const q = (req.query.q || "").trim();

    const filter = { role: "user" };
    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("name username balance upiId createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      page,
      pages: Math.ceil(total / limit),
      total,
      users: items,
    });
  } catch (err) {
    next(err);
  }
};

export const getPendingTransactions = async (req, res, next) => {
  try {
    ensureAdmin(req);
    const page = toPage(req.query.page);
    const limit = toLimit(req.query.limit);

    const [items, total] = await Promise.all([
      Transaction.find({ status: "pending" })
        .populate({ path: "userId", select: "username balance upiId" })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Transaction.countDocuments({ status: "pending" }),
    ]);

    res.json({
      success: true,
      page,
      pages: Math.ceil(total / limit),
      total,
      pending: items,
    });
  } catch (err) {
    logger.error("Error in getPendingTransactions:", err);
    next(err);
  }
};

export const approveTransaction = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    ensureAdmin(req);
    const { txnId } = req.params;
    const txn = await Transaction.findById(txnId).session(session);

    if (!txn || txn.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, message: "Invalid or already processed" });
    }

    const user = await User.findById(txn.userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (txn.method === "upi_manual") {
      user.balance = Number((user.balance + txn.amount).toFixed(2));
      txn.status = "success";
      txn.meta = { ...txn.meta, approvedBy: "admin", approvedAt: new Date() };
      await user.save({ session });
      await txn.save({ session });
    } else if (txn.method === "withdraw") {
      txn.status = "success";
      txn.meta = {
        ...txn.meta,
        approvedBy: "admin",
        paidTo: user.upiId,
        payoutAt: new Date(),
      };
      await txn.save({ session });
    } else {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, message: "Unsupported transaction method" });
    }

    await session.commitTransaction();
    session.endSession();

    emitToUser(user._id, "txn:approved", {
      txnId: txn._id,
      type: txn.type,
      amount: txn.amount,
      method: txn.method,
      balance: user.balance,
    });

    emitToAdmins("transactions:approved", {
      txnId: txn._id,
      user: user.username,
      method: txn.method,
      amount: txn.amount,
    });

    res.json({
      success: true,
      message:
        txn.method === "withdraw"
          ? `Withdraw ₹${txn.amount} paid to ${user.upiId}`
          : `Top-up ₹${txn.amount} added`,
      txn,
      userBalance: user.balance,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

export const rejectTransaction = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    ensureAdmin(req);
    const { txnId } = req.params;
    const txn = await Transaction.findById(txnId).session(session);

    if (!txn || txn.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, message: "Invalid transaction" });
    }

    const user = await User.findById(txn.userId).session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (txn.method === "withdraw") {
      user.balance = Number((user.balance + txn.amount).toFixed(2));
      await user.save({ session });
    }

    txn.status = "failed";
    txn.meta = { ...txn.meta, rejectedBy: "admin", rejectedAt: new Date() };
    await txn.save({ session });

    await session.commitTransaction();
    session.endSession();

    emitToUser(user._id, "txn:rejected", {
      txnId: txn._id,
      refund: txn.method === "withdraw" ? txn.amount : 0,
      balance: user.balance,
    });

    res.json({ success: true, message: "Transaction rejected" });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

export const getAllBets = async (req, res, next) => {
  try {
    ensureAdmin(req);
    const page = toPage(req.query.page);
    const limit = toLimit(req.query.limit);
    const status = req.query.status;
    const filter = status ? { status } : {};

    const [items, total] = await Promise.all([
      Bet.find(filter)
        .select(
          "matchId sport status makerId takerId makerTeam takerTeam makerStake takerStake makerOdds takerOdds createdAt"
        )
        .populate({
          path: "makerId",
          select: "username",
          options: { lean: true },
        })
        .populate({
          path: "takerId",
          select: "username",
          options: { lean: true },
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Bet.countDocuments(filter),
    ]);

    res.json({
      success: true,
      page,
      pages: Math.ceil(total / limit),
      total,
      bets: items,
    });
  } catch (err) {
    next(err);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    ensureAdmin(req);
    const [facet] = await User.aggregate([
      {
        $facet: {
          users: [{ $match: { role: "user" } }, { $count: "cnt" }],
          wallet: [
            { $match: { role: "user" } },
            { $group: { _id: null, sum: { $sum: "$balance" } } },
          ],
        },
      },
    ]);

    const totalUsers = facet?.users?.[0]?.cnt || 0;
    const totalWalletBalance = facet?.wallet?.[0]?.sum || 0;

    const [pendingTxns, totalBets, commissionAgg] = await Promise.all([
      Transaction.countDocuments({ status: "pending" }),
      Bet.countDocuments({}),
      Commission.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const totalCommission = commissionAgg?.[0]?.total?.toFixed(2) || 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        pendingTxns,
        totalBets,
        totalWalletBalance,
        totalCommission,
      },
    });
  } catch (err) {
    logger.error("Dashboard stats error:", err);
    next(err);
  }
};

export const getCommissionReport = async (req, res, next) => {
  try {
    ensureAdmin(req);
    const page = toPage(req.query.page);
    const limit = toLimit(req.query.limit, 50, 200);

    const pipeline = [
      {
        $group: {
          _id: "$matchId",
          totalCommission: { $sum: "$amount" },
          betsCount: { $sum: 1 },
          lastAt: { $max: "$createdAt" },
        },
      },
      { $sort: { lastAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: "matches",
          localField: "_id",
          foreignField: "matchId",
          as: "match",
        },
      },
      {
        $project: {
          _id: 0,
          matchId: "$_id",
          totalCommission: 1,
          betsCount: 1,
          lastAt: 1,
          match: { $first: "$match" },
        },
      },
      {
        $project: {
          matchId: 1,
          totalCommission: 1,
          betsCount: 1,
          lastAt: 1,
          title: {
            $cond: [
              { $ifNull: ["$match.teamA", false] },
              { $concat: ["$match.teamA", " vs ", "$match.teamB"] },
              "Unknown Match",
            ],
          },
          status: "$match.status",
        },
      },
    ];

    const [rows, totalAgg] = await Promise.all([
      Commission.aggregate(pipeline),
      Commission.aggregate([
        { $group: { _id: "$matchId" } },
        { $count: "cnt" },
      ]),
    ]);

    res.json({
      success: true,
      page,
      pages: Math.ceil((totalAgg?.[0]?.cnt || 0) / limit),
      total: totalAgg?.[0]?.cnt || 0,
      report: rows,
    });
  } catch (err) {
    next(err);
  }
};
