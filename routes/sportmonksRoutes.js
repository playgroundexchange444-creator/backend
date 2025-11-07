import express from "express";
import { fetchLiveMatches } from "../services/sportmonksSyncService.js";

const router = express.Router();

router.get("/fetch", async (req, res) => {
  try {
    const result = await fetchLiveMatches();

    if (result.success) {
      return res.json({
        success: true,
        message: "SportMonks data fetched successfully",
        count: result.data?.length || 0,
        matches: result.data || [],
      });
    }

    return res.json({
      success: false,
      message: "No matches found from SportMonks",
      matches: [],
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch matches from SportMonks",
      error: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
});

export default router;
