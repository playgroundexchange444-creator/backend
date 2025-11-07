// 📁 services/cleanupService.js
import cron from "node-cron";
import Match from "../models/Match.js";
import Bet from "../models/Bet.js";
import Transaction from "../models/Transaction.js";
import logger from "../config/logger.js";

export const autoCleanup = async () => {
  try {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // 🏏 Delete old matches (completed > 3 days)
    const matchResult = await Match.deleteMany({
      status: { $in: ["finished", "completed", "cancelled"] },
      updatedAt: { $lte: new Date(now - 3 * oneDay) },
    });

    // 💰 Delete old settled bets (settled > 7 days)
    const betResult = await Bet.deleteMany({
      settled: true,
      settledAt: { $lte: new Date(now - 7 * oneDay) },
    });

    // ⏳ Delete expired pending bets (> 1 day old)
    const pendingResult = await Bet.deleteMany({
      status: "pending",
      expireAt: { $exists: true, $lte: new Date(now - oneDay) },
    });

    // 💳 Delete failed transactions (> 7 days)
    const txResult = await Transaction.deleteMany({
      status: "failed",
      createdAt: { $lte: new Date(now - 7 * oneDay) },
    });

    logger.info(
      `[🧹 Cleanup Completed]
       Matches deleted: ${matchResult.deletedCount}
       Settled bets deleted: ${betResult.deletedCount}
       Expired bets deleted: ${pendingResult.deletedCount}
       Failed transactions deleted: ${txResult.deletedCount}`
    );
  } catch (err) {
    logger.error(`[❌ Cleanup Error]: ${err.message}`);
  }
};

export const startAutoCleanup = () => {
  cron.schedule("0 2 * * *", autoCleanup);
  logger.info("🕒 Auto cleanup scheduled: Every day at 2:00 AM");
};
