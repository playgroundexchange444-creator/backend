import { fetchLiveMatches } from "../services/sportmonksService.js";
import logger from "../config/logger.js";

export const manualSportMonksSync = async (req, res, next) => {
  try {
    const result = await fetchLiveMatches();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch matches from SportMonks API.",
      });
    }

    res.json({
      success: true,
      message: `Synced ${result.data.length} matches from SportMonks.`,
      count: result.data.length,
    });
  } catch (err) {
    logger.error("Error during manual SportMonks sync:", err);
    next(err);
  }
};
