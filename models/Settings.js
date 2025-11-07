import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    commissionPercent: { type: Number, default: 5 },
    supportWhatsapp: { type: String, default: "919999999999" },
    upiId: { type: String, default: "playgroundexchange@upi" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Settings", settingsSchema);
