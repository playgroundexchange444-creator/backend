import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, unique: true, required: true, trim: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0, min: 0 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    upiId: { type: String, default: "" },
    refreshToken: { type: String, default: null },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
