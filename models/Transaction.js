import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be greater than zero"],
    },

    currency: { type: String, default: "INR" },

    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },

    method: {
      type: String,
      enum: [
        "upi_manual",
        "gateway",
        "bet",
        "settlement",
        "commission",
        "withdraw",
      ],
      default: "upi_manual",
    },

    status: {
      type: String,
      enum: ["pending", "success", "failed", "cancelled"],
      default: "pending",
    },

    note: { type: String },
    proofUrl: { type: String },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);
