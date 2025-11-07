import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
  {
    matchId: { type: String, required: true, unique: true },

    sport: { type: String, default: "cricket" },

    leagueId: { type: Number },
    leagueName: { type: String },
    leagueLogo: { type: String },
    seriesName: { type: String },

    teamA: { type: String, required: true },
    teamB: { type: String, required: true },
    imageA: { type: String },
    imageB: { type: String },

    teamA_score: { type: String, default: null },
    teamB_score: { type: String, default: null },

    oddsA: { type: Number, default: 1.5 },
    oddsB: { type: Number, default: 1.5 },

    status: {
      type: String,
      enum: ["upcoming", "live", "completed", "finished", "cancelled"],
      default: "upcoming",
    },

    winner: { type: String, default: null },
    winnerTeamId: { type: Number, default: null },

    startTime: { type: Date, default: Date.now },

    source: {
      type: String,
      enum: ["SportMonks", "manual"],
      default: "SportMonks",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Match", matchSchema);
