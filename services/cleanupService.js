import cron from "node-cron";
import Match from "../models/Match.js";
import Bet from "../models/Bet.js";
import Transaction from "../models/Transaction.js";
import logger from "../config/logger.js";

export const autoCleanup = async () => {
  try {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    const matchResult = await Match.deleteMany({
      status: { $in: ["finished", "completed", "cancelled"] },
      updatedAt: { $lte: new Date(now - 12 * oneHour) },
    });

    const betResult = await Bet.deleteMany({
      settled: true,
      settledAt: { $lte: new Date(now - 7 * 24 * oneHour) },
    });

    const pendingResult = await Bet.deleteMany({
      status: "pending",
      expireAt: { $exists: true, $lte: new Date(now - 24 * oneHour) },
    });

    const txResult = await Transaction.deleteMany({
      status: "failed",
      createdAt: { $lte: new Date(now - 7 * 24 * oneHour) },
    });

    logger.info(
      `[🧹 Cleanup Completed]
       Matches deleted: ${matchResult.deletedCount}
       Settled bets deleted: ${betResult.deletedCount}
       Expired bets deleted: ${pendingResult.deletedCount}
       Failed transactions deleted: ${txResult.deletedCount}`
    );
  } catch (err) {
    logger.error(`[ Cleanup Error]: ${err.message}`);
  }
};

export const startAutoCleanup = () => {
  cron.schedule("0 2 * * *", autoCleanup);
  logger.info(" uto cleanup scheduled Every day at 2:00 AM");
};
