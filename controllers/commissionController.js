import Commission from "../models/Commission.js";
import logger from "../config/logger.js";

export const getAllCommissions = async (req, res) => {
  try {
    const commissions = await Commission.find()
      .populate("userId", "username name")
      .sort({ createdAt: -1 });

    res.json({ success: true, commissions });
  } catch (err) {
    logger.error("Error fetching commissions:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getCommissionStats = async (req, res) => {
  try {
    const total = await Commission.aggregate([
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);

    res.json({
      success: true,
      totalCommission: total[0]?.totalAmount || 0,
    });
  } catch (err) {
    logger.error("Error fetching commission stats:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
