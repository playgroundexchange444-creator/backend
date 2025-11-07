// services/autoSettleService.js
import Match from "../models/Match.js";
import { settleBet } from "./betService.js";
import { getIO } from "../sockets/socket.js";
import logger from "../config/logger.js";

export const fetchAndSettleCompletedMatches = async () => {
  try {
    const matches = await Match.find({
      status: { $in: ["completed", "finished"] },
      settled: false,
    });

    if (!matches.length) return;

    for (const match of matches) {
      if (!match.winnerTeam) continue;

      match.settled = true;
      await match.save();

      await settleBet({
        betId: null,
        matchId: match.matchId,
        winnerTeam: match.winnerTeam,
        settledBy: "system-auto",
      });

      getIO().emit("match:settled", {
        matchId: match.matchId,
        winnerTeam: match.winnerTeam,
        auto: true,
      });
    }

    logger.info(`Auto-settled ${matches.length} completed match(es)`);
  } catch (err) {
    logger.error(`Auto-settle failed: ${err.message}`);
  }
};
