import Match from "../models/Match.js";
import Bet from "../models/Bet.js";
import logger from "../config/logger.js";
import { getIO } from "../sockets/socket.js";
import { settleBet } from "../services/betService.js";

export const createMatch = async (req, res, next) => {
  try {
    const { matchId, sport, teamA, teamB, oddsA, oddsB } = req.body;

    if (!matchId || !teamA || !teamB) {
      return res.status(400).json({
        success: false,
        message: "matchId, teamA & teamB are required",
      });
    }

    const exists = await Match.findOne({ matchId });
    if (exists) {
      return res
        .status(400)
        .json({ success: false, message: "Match ID already exists" });
    }

    const imagePath = req.file ? `/uploads/matches/${req.file.filename}` : "";

    const match = await Match.create({
      matchId,
      sport,
      teamA,
      teamB,
      oddsA,
      oddsB,
      image: imagePath,
      source: "manual",
    });

    getIO().to("admins").emit("match:new", match);

    res.status(201).json({ success: true, message: "Match created", match });
  } catch (error) {
    logger.error("createMatch error:", error);
    next(error);
  }
};

export const getAllMatches = async (req, res, next) => {
  try {
    const now = new Date();
    const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const localMatches = await Match.find({
      source: "manual",
      status: { $in: ["upcoming", "live"] },
      startTime: { $lte: next48h },
    }).sort({ createdAt: -1 });

    const sportMonksMatches = await Match.find({
      source: "SportMonks",
      status: { $in: ["upcoming", "live"] },
      startTime: { $lte: next48h },
    }).sort({ startTime: 1 });

    res.json({
      success: true,
      count: localMatches.length + sportMonksMatches.length,
      matches: [...sportMonksMatches, ...localMatches],
    });
  } catch (err) {
    logger.error("getAllMatches error:", err);
    next(err);
  }
};

export const getLiveSportMonksMatches = async (req, res) => {
  try {
    const matches = await Match.find({
      source: "SportMonks",
      status: { $in: ["upcoming", "live"] },
    })
      .sort({ startTime: 1 })
      .select(
        "matchId teamA teamB sport startTime status imageA imageB oddsA oddsB leagueId seriesName"
      );

    if (!matches.length) {
      return res
        .status(404)
        .json({ success: false, message: "No matches available" });
    }

    res.json({ success: true, count: matches.length, matches });
  } catch (err) {
    logger.error("getLiveSportMonksMatches error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch matches" });
  }
};

export const getMatchesByLeague = async (req, res) => {
  try {
    const { leagueId } = req.params;

    const matches = await Match.find({ source: "SportMonks", leagueId }).sort({
      startTime: 1,
    });
    if (!matches.length) {
      return res
        .status(404)
        .json({ success: false, message: "No matches found" });
    }

    res.json({ success: true, count: matches.length, matches });
  } catch (err) {
    logger.error("getMatchesByLeague error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch matches" });
  }
};

export const getLeagues = async (req, res) => {
  try {
    const leagues = await Match.aggregate([
      { $match: { source: "SportMonks" } },
      {
        $group: {
          _id: { leagueId: "$leagueId", seriesName: "$seriesName" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          leagueId: "$_id.leagueId",
          seriesName: "$_id.seriesName",
          count: 1,
        },
      },
      { $sort: { seriesName: 1 } },
    ]);

    res.json({ success: true, count: leagues.length, leagues });
  } catch (err) {
    logger.error("getLeagues error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch leagues" });
  }
};

export const getMatchDetails = async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = await Match.findOne({ matchId }).lean();

    if (!match) {
      return res
        .status(404)
        .json({ success: false, message: "Match not found" });
    }

    res.json({ success: true, match });
  } catch (err) {
    logger.error("getMatchDetails error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch match" });
  }
};

export const settleMatch = async (req, res, next) => {
  try {
    const { matchId, winnerTeam } = req.body;

    if (!matchId || !winnerTeam) {
      return res
        .status(400)
        .json({ success: false, message: "matchId & winnerTeam required" });
    }

    const bets = await Bet.find({ matchId, settled: false });
    if (!bets.length) {
      return res
        .status(404)
        .json({ success: false, message: "No unsettled bets found" });
    }

    let settledCount = 0;
    let totalCommission = 0;

    for (const bet of bets) {
      try {
        const settledBet = await settleBet({
          betId: bet._id,
          winnerTeam,
          settledBy: req.user.username || req.user.id,
        });
        settledCount++;
        totalCommission += settledBet?.meta?.commission || 0;
      } catch (err) {
        logger.error("Error settling bet:", err);
      }
    }

    getIO().to("admins").emit("match:settled", {
      matchId,
      winnerTeam,
      totalCommission,
      settledCount,
    });

    res.json({
      success: true,
      message: "Match settled",
      winnerTeam,
      settledCount,
      totalCommission,
    });
  } catch (err) {
    logger.error("settleMatch error:", err);
    next(err);
  }
};

export const updateMatchStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res
        .status(400)
        .json({ success: false, message: "Status required" });
    }

    const match = await Match.findByIdAndUpdate(id, { status }, { new: true });
    if (!match) {
      return res
        .status(404)
        .json({ success: false, message: "Match not found" });
    }

    getIO().emit("match:update", match);
    res.json({ success: true, message: "Status updated", match });
  } catch (err) {
    logger.error("updateMatchStatus error:", err);
    next(err);
  }
};

export const getMatchesBySport = async (req, res) => {
  try {
    const sport = req.params.sport?.toLowerCase();
    const { status } = req.query;

    const query = { sport };

    if (status && status !== "all") {
      const s = status.toLowerCase();
      if (s === "completed") {
        query.status = { $in: ["completed", "finished", "result", "ended"] };
      } else if (s === "live") {
        query.status = { $in: ["live", "inplay"] };
      } else if (s === "upcoming") {
        query.status = { $in: ["upcoming", "ns", "scheduled"] };
      }
    }

    const matches = await Match.find(query).sort({ startTime: 1 }).lean();

    res.json({
      success: true,
      sport,
      filter: status || "all",
      count: matches.length,
      matches,
    });
  } catch (err) {
    logger.error("getMatchesBySport error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch matches",
    });
  }
};
