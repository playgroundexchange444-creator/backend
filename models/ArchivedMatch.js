import mongoose from "mongoose";

const archivedMatchSchema = new mongoose.Schema(
  {
    matchId: { type: String, required: true, index: true },
    payload: { type: Object, required: true }, // full match doc snapshot
    archivedAt: { type: Date, default: Date.now },
    reason: { type: String, default: "auto-archive" }, // e.g., "completed_older_than_7d"
  },
  { timestamps: true }
);

export default mongoose.model("ArchivedMatch", archivedMatchSchema);
