import Commission from "../models/Commission.js";
import logger from "../config/logger.js";

export const recordCommission = async ({
  matchId,
  userId,
  betId,
  winAmount,
  commissionPercent = 0.05,
}) => {
  try {
    const commissionAmount = Number((winAmount * commissionPercent).toFixed(2));
    return await Commission.create({
      matchId,
      userId,
      betId,
      amount: commissionAmount,
      percent: commissionPercent * 100,
      status: "pending",
    });
  } catch (err) {
    logger.error(`[recordCommission] Failed: ${err.message}`);
    throw new Error("Commission record failed");
  }
};

export const getCommissionSummary = async () => {
  try {
    const data = await Commission.aggregate([
      {
        $group: {
          _id: null,
          totalCommission: { $sum: "$amount" },
          totalBets: { $sum: 1 },
        },
      },
    ]);
    return data[0] || { totalCommission: 0, totalBets: 0 };
  } catch (err) {
    logger.error(`[getCommissionSummary] Failed: ${err.message}`);
    return { totalCommission: 0, totalBets: 0 };
  }
};

export const cleanOldCommissions = async (days = 90) => {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await Commission.deleteMany({
      createdAt: { $lt: cutoff },
    });
    logger.info(`[cleanup] Old commissions removed: ${result.deletedCount}`);
    return result.deletedCount;
  } catch (err) {
    logger.error(`[cleanOldCommissions] Failed: ${err.message}`);
    throw err;
  }
};

export const getCommissionByMatch = async (matchId) => {
  try {
    return await Commission.find({ matchId })
      .populate("userId", "username")
      .populate("betId", "_id matchId")
      .sort({ createdAt: -1 });
  } catch (err) {
    logger.error(`[getCommissionByMatch] Failed: ${err.message}`);
    throw new Error("Failed to fetch commission details for this match");
  }
};
