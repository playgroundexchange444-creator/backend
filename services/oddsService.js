import axios from "axios";
import Match from "../models/Match.js";
import logger from "../config/logger.js";

const dummyMatches = [
  {
    matchId: "CRIC_IND_AUS_1",
    sport: "cricket",
    teamA: "India",
    teamB: "Australia",
    imageA: "https://upload.wikimedia.org/wikipedia/en/4/41/Flag_of_India.svg",
    imageB:
      "https://upload.wikimedia.org/wikipedia/en/3/3a/Flag_of_Australia.svg",
    odds: { teamA: 1.85, teamB: 1.95 },
    status: "live",
    startTime: "2025-11-05T14:00:00Z",
  },
];

export const getOddsData = async () => {
  try {
    const apiUrl = process.env.ODDS_API_URL;
    const apiKey = process.env.ODDS_API_KEY;

    if (!apiUrl) throw new Error("External API URL not configured");

    const response = await axios.get(apiUrl, {
      headers: apiKey ? { "x-api-key": apiKey } : {},
      timeout: 5000,
    });

    if (Array.isArray(response.data) && response.data.length > 0) {
      logger.info(
        `[Odds API] Live data fetched: ${response.data.length} matches`
      );
      return { success: true, source: "API", data: response.data };
    }

    throw new Error("Empty response from API");
  } catch (error) {
    logger.warn(
      `[OddsService] Live API failed → using dummy data (${error.message})`
    );

    let inserted = 0;
    for (const match of dummyMatches) {
      const exists = await Match.findOne({ matchId: match.matchId });
      if (!exists) {
        await Match.create({
          matchId: match.matchId,
          sport: match.sport,
          teamA: match.teamA,
          teamB: match.teamB,
          oddsA: match.odds.teamA,
          oddsB: match.odds.teamB,
          status: match.status,
          imageA: match.imageA,
          imageB: match.imageB,
          startTime: match.startTime,
          source: "dummy",
        });
        inserted++;
      }
    }

    if (inserted > 0) {
      logger.info(
        `[OddsService] Dummy sync complete → ${inserted} new matches inserted`
      );
    }

    return { success: true, source: "dummy", data: dummyMatches };
  }
};
