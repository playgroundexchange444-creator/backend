import express from "express";
import Settings from "../models/Settings.js";

const router = express.Router();

router.get("/settings", async (req, res) => {
  try {
    const settings = await Settings.findOne();

    if (!settings) {
      return res.json({
        success: true,
        settings: {
          commissionPercent: 0,
          supportWhatsapp: "",
          upiId: "",
        },
      });
    }

    res.json({ success: true, settings });
  } catch (_err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
