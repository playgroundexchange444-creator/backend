import mongoose from "mongoose";

const commissionSchema = new mongoose.Schema(
  {
    matchId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    betId: { type: mongoose.Schema.Types.ObjectId, ref: "Bet" },
    amount: { type: Number, required: true },
    percent: { type: Number, required: true },
    status: { type: String, enum: ["pending", "credited"], default: "pending" },
  },
  { timestamps: true }
);

export default mongoose.model("Commission", commissionSchema);
