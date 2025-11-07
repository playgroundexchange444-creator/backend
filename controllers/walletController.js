import {
  getUserWalletBalance,
  requestAddFunds,
  requestWithdrawFunds,
  getUserTransactions,
} from "../services/walletService.js";
import { emitToAdmins } from "../sockets/socketEmitter.js";

export const getWallet = async (req, res, next) => {
  try {
    const result = await getUserWalletBalance(req.user.id);
    res.json({ success: true, balance: result.balance });
  } catch (err) {
    next(err);
  }
};

export const addBalance = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const txn = await requestAddFunds(req.user.id, amount);
    emitToAdmins("txn:new", { userId: req.user.id, txn });
    res.status(201).json({
      success: true,
      message: "Top-up request submitted. Waiting for admin approval.",
      txn,
    });
  } catch (err) {
    next(err);
  }
};

export const withdrawRequest = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const txn = await requestWithdrawFunds(req.user.id, amount);
    emitToAdmins("txn:new", { userId: req.user.id, txn });
    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted. Awaiting admin approval.",
      txn,
    });
  } catch (err) {
    next(err);
  }
};

export const getTransactions = async (req, res, next) => {
  try {
    const transactions = await getUserTransactions(req.user.id);
    res.json({ success: true, transactions });
  } catch (err) {
    next(err);
  }
};
