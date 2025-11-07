import Bet from "../models/Bet.js";
import logger from "../config/logger.js";
import {
  placeBet,
  acceptBet,
  settleBet,
  settleMatch,
  getMyBets,
  getOpenBets,
  deleteBet,
  updateBet,
} from "../services/betService.js";

export const placeBetController = async (req, res, next) => {
  try {
    const { matchId, sport, team, stake, odds, acceptWindowSec } = req.body;
    const makerId = req.user.id;

    if (!matchId || !sport || !team || !stake || !odds) {
      return res.status(400).json({
        success: false,
        message: "matchId, sport, team, stake, odds are required",
      });
    }

    const bet = await placeBet({
      makerId,
      matchId,
      sport,
      team,
      stake,
      odds,
      acceptWindowSec,
    });

    res.status(201).json({
      success: true,
      message: "Bet placed successfully",
      bet,
    });
  } catch (err) {
    logger.error("Error placing bet:", err);
    next({ statusCode: 400, message: err.message });
  }
};

export const acceptBetController = async (req, res, next) => {
  try {
    const { betId } = req.params;
    const takerId = req.user.id;

    if (!betId) {
      return res
        .status(400)
        .json({ success: false, message: "Bet ID is required" });
    }

    const bet = await acceptBet({ betId, takerId });
    res.status(200).json({
      success: true,
      message: "Bet accepted successfully",
      bet,
    });
  } catch (err) {
    logger.error("Error accepting bet:", err);
    next({ statusCode: 400, message: err.message });
  }
};

export const getOpenBetsController = async (req, res, next) => {
  try {
    const bets = await getOpenBets();
    res.status(200).json({ success: true, count: bets.length, bets });
  } catch (err) {
    logger.error("Error fetching open bets:", err);
    next({ statusCode: 500, message: err.message });
  }
};

export const getMyBetsController = async (req, res, next) => {
  try {
    const bets = await getMyBets(req.user.id);
    res.status(200).json({ success: true, count: bets.length, bets });
  } catch (err) {
    logger.error("Error fetching my bets:", err);
    next({ statusCode: 400, message: err.message });
  }
};

export const adminSettleBetController = async (req, res, next) => {
  try {
    const { betId, winnerTeam } = req.body;
    const settledBy = req.user.username || req.user.id;

    if (!betId || !winnerTeam) {
      return res
        .status(400)
        .json({ success: false, message: "betId and winnerTeam are required" });
    }

    const bet = await settleBet({
      betId,
      winnerTeam,
      settledBy,
      commissionRate: parseFloat(process.env.ADMIN_COMMISSION_RATE || "0.05"),
    });

    res.status(200).json({
      success: true,
      message: "Bet settled successfully",
      bet,
    });
  } catch (err) {
    logger.error("Error settling bet:", err);
    next({ statusCode: 400, message: err.message });
  }
};

export const adminSettleMatchController = async (req, res, next) => {
  try {
    const { matchId, winnerTeam } = req.body;
    const settledBy = req.user.username || req.user.id;

    if (!matchId || !winnerTeam) {
      return res.status(400).json({
        success: false,
        message: "matchId and winnerTeam are required",
      });
    }

    const result = await settleMatch({ matchId, winnerTeam, settledBy });

    res.status(200).json({
      success: true,
      message: "Match settled successfully",
      result,
    });
  } catch (err) {
    logger.error("Error settling match:", err);
    next({ statusCode: 400, message: err.message });
  }
};

export const getBetByMatchController = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    if (!matchId) {
      return res
        .status(400)
        .json({ success: false, message: "Match ID is required" });
    }

    const bet = await Bet.findOne({
      matchId,
      $or: [{ makerId: userId }, { takerId: userId }],
    }).lean();

    if (!bet) {
      return res
        .status(404)
        .json({ success: false, message: "No bet found for this match" });
    }

    res.status(200).json({ success: true, bet });
  } catch (err) {
    logger.error("Error fetching bet by match:", err);
    next({ statusCode: 400, message: err.message });
  }
};

export const deleteBetController = async (req, res, next) => {
  try {
    const { betId } = req.params;
    const userId = req.user.id;
    await deleteBet(betId, userId);

    res.json({
      success: true,
      message: "Bet deleted & amount refunded",
    });
  } catch (err) {
    logger.error("Error deleting bet:", err);
    next({ statusCode: 400, message: err.message });
  }
};

export const updateBetController = async (req, res, next) => {
  try {
    const { betId } = req.params;
    const { stake, odds } = req.body;
    const userId = req.user.id;

    const bet = await updateBet({ betId, userId, stake, odds });
    res.json({
      success: true,
      message: "Bet updated successfully",
      bet,
    });
  } catch (err) {
    logger.error("Error updating bet:", err);
    next({ statusCode: 400, message: err.message });
  }
};

export const adminGetBetsByMatchController = async (req, res, next) => {
  try {
    const { matchId } = req.params;

    if (!matchId) {
      return res
        .status(400)
        .json({ success: false, message: "Match ID is required" });
    }

    const bets = await Bet.find({ matchId })
      .populate("makerId", "username")
      .populate("takerId", "username")
      .lean();

    res.json({
      success: true,
      count: bets.length,
      bets,
    });
  } catch (err) {
    logger.error("Error fetching bets by match:", err);
    next({ statusCode: 500, message: err.message });
  }
};
