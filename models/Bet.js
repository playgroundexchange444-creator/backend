import mongoose from "mongoose";

const betSchema = new mongoose.Schema(
  {
    makerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    takerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    matchId: { type: String, required: true, index: true },
    sport: { type: String, default: "cricket" },

    teamA: String,
    teamB: String,

    makerTeam: { type: String, required: true },
    makerStake: { type: Number, required: true },
    makerOdds: { type: Number, required: true },

    takerTeam: { type: String, default: null },
    takerStake: { type: Number, default: 0 },
    takerOdds: { type: Number, default: 0 },

    potentialWin: { type: Number, required: true },
    oppositeOdds: { type: Number },

    status: {
      type: String,
      enum: [
        "pending",
        "active",
        "won",
        "lost",
        "cancelled",
        "refunded",
        "settled",
      ],
      default: "pending",
    },

    expiresAt: Date,
    matchedAt: Date,

    settled: { type: Boolean, default: false },
    winnerTeam: String,
    settledBy: String,
    settledAt: Date,

    commission: { type: Number, default: 0 },
    meta: Object,
  },
  { timestamps: true }
);

export default mongoose.model("Bet", betSchema);
