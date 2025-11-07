// services/userService.js
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { getIO } from "../sockets/socket.js";

/**
 * Credit funds to user wallet
 */
export const creditUser = async ({
  userId,
  amount,
  note = "Wallet credit",
  method = "system",
  session = null,
}) => {
  if (!userId || !amount || amount <= 0)
    throw new Error("Invalid credit parameters");

  const user = await User.findById(userId).session(session);
  if (!user) throw new Error("User not found");

  user.balance = Number((user.balance + amount).toFixed(2));
  await user.save({ session });

  await Transaction.create(
    [
      {
        userId,
        amount,
        type: "credit",
        method,
        status: "success",
        note,
      },
    ],
    { session }
  );

  const io = getIO();
  io.to(`user_${userId}`).emit("wallet:update", {
    userId,
    newBalance: user.balance,
    amount,
    type: "credit",
    note,
  });

  return user.balance;
};

export const debitUser = async ({
  userId,
  amount,
  note = "Wallet debit",
  method = "system",
  session = null,
}) => {
  if (!userId || !amount || amount <= 0)
    throw new Error("Invalid debit parameters");

  const user = await User.findById(userId).session(session);
  if (!user) throw new Error("User not found");

  if (user.balance < amount) throw new Error("Insufficient wallet balance");

  user.balance = Number((user.balance - amount).toFixed(2));
  await user.save({ session });

  await Transaction.create(
    [
      {
        userId,
        amount,
        type: "debit",
        method,
        status: "success",
        note,
      },
    ],
    { session }
  );

  const io = getIO();
  io.to(`user_${userId}`).emit("wallet:update", {
    userId,
    newBalance: user.balance,
    amount,
    type: "debit",
    note,
  });

  return user.balance;
};

export const updateUserBalance = async (
  userId,
  newBalance,
  note = "Balance adjustment"
) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const oldBalance = user.balance;
  user.balance = Number(newBalance);
  await user.save();

  await Transaction.create({
    userId,
    amount: Number(newBalance - oldBalance),
    type: newBalance > oldBalance ? "credit" : "debit",
    method: "adjustment",
    status: "success",
    note,
  });

  return user;
};
