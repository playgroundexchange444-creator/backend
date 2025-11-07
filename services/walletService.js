import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";

export const getUserWalletBalance = async (userId) => {
  const user = await User.findById(userId).select("balance");
  if (!user) throw new Error("User not found");
  return { balance: user.balance };
};

export const requestAddFunds = async (userId, amount, note) => {
  if (!amount || amount <= 0) throw new Error("Invalid amount");

  return await Transaction.create({
    userId,
    amount,
    type: "credit",
    method: "upi_manual",
    status: "pending",
    note: note || "Add funds via UPI",
    meta: {
      adminUpiId: process.env.ADMIN_UPI_ID || "playground@upi",
    },
  });
};

export const requestWithdrawFunds = async (userId, amount, note) => {
  if (!amount || amount <= 0) throw new Error("Invalid amount");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found");
    if (!user.upiId) throw new Error("Please set your UPI ID in profile");
    if (user.balance < amount) throw new Error("Insufficient balance");

    user.balance = Number((user.balance - amount).toFixed(2));
    await user.save({ session });

    const [txn] = await Transaction.create(
      [
        {
          userId,
          amount,
          type: "debit",
          method: "withdraw",
          status: "pending",
          note: note || `Withdraw ₹${amount} to ${user.upiId}`,
          meta: {
            upiId: user.upiId,
            requestedAt: new Date(),
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    return txn;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export const getUserTransactions = async (userId) => {
  return await Transaction.find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
};
