// 📁 controllers/oddsController.js
import Match from "../models/Match.js";
import logger from "../config/logger.js";
import { fetchLiveMatches } from "../services/sportmonksSyncService.js";

export const fetchOdds = async (req, res) => {
  try {
    const sport = (req.query.sport || "cricket").toLowerCase();

    if (sport !== "cricket") {
      return res.status(501).json({
        success: false,
        message: `Sport '${sport}' is not supported. Only cricket allowed.`,
      });
    }

    const { success, grouped } = await fetchLiveMatches();

    if (!success) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch matches from SportMonks API",
      });
    }

    // ✅ Merge all matches into one array for DB sync
    const allMatches = [
      ...grouped.live,
      ...grouped.upcoming,
      ...grouped.completed,
    ];

    if (!allMatches.length) {
      return res.status(404).json({
        success: false,
        message: "No matches found from SportMonks.",
      });
    }

    // ✅ Bulk update to DB
    const bulkOps = allMatches.map((m) => ({
      updateOne: {
        filter: { matchId: m.matchId },
        update: {
          $set: {
            matchId: m.matchId,
            sport: "cricket",
            teamA: m.teamA,
            teamB: m.teamB,
            league: m.league || "Unknown Series",
            status: m.status,
            startTime: m.startTime,
            imageA: m.imageA || "",
            imageB: m.imageB || "",
            oddsA: m.oddsA ?? null,
            oddsB: m.oddsB ?? null,
            source: "SportMonks",
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    await Match.bulkWrite(bulkOps);
    logger.info(`✅ SportMonks Sync: ${allMatches.length} matches updated.`);

    return res.json({
      success: true,
      sport,
      source: "SportMonks API",
      counts: {
        live: grouped.live.length,
        upcoming: grouped.upcoming.length,
        completed: grouped.completed.length,
        total: allMatches.length,
      },
      grouped,
    });
  } catch (err) {
    logger.error("❌ fetchOdds error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const setManualOdds = async (req, res) => {
  try {
    const { matchId, oddsA, oddsB } = req.body;

    if (!matchId || oddsA == null || oddsB == null) {
      return res.status(400).json({
        success: false,
        message: "matchId, oddsA, and oddsB are required",
      });
    }

    const updated = await Match.findOneAndUpdate(
      { matchId },
      {
        $set: {
          oddsA,
          oddsB,
          source: "manual",
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Match not found",
      });
    }

    logger.info(`🧮 Manual Odds Updated: ${matchId} -> ${oddsA}/${oddsB}`);

    return res.json({
      success: true,
      message: "Manual odds updated successfully",
      match: updated,
    });
  } catch (err) {
    logger.error("❌ setManualOdds error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getActiveOdds = async (req, res) => {
  try {
    const matches = await Match.find({
      status: { $in: ["upcoming", "live"] },
    })
      .sort({ startTime: 1 })
      .lean();

    return res.json({
      success: true,
      count: matches.length,
      matches,
    });
  } catch (err) {
    logger.error("❌ getActiveOdds error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
