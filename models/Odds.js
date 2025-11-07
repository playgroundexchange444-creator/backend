import mongoose from "mongoose";

const oddsSchema = new mongoose.Schema(
  {
    matchId: { type: String, required: true, unique: true },
    sport: { type: String, default: "cricket" },
    teams: { type: [String], required: true },
    odds: {
      type: Map,
      of: Number,
    },
    status: {
      type: String,
      enum: ["upcoming", "live", "completed"],
      default: "upcoming",
    },
    result: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Odds", oddsSchema);
