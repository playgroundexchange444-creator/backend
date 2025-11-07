import Settings from "../models/Settings.js";
import logger from "../config/logger.js";

// Get Settings
export const getSettings = async (req, res, next) => {
  try {
    const settings = (await Settings.findOne()) || (await Settings.create({}));
    res.json({ success: true, settings });
  } catch (err) {
    logger.error("Error fetching settings:", err);
    next(err);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const { commissionPercent, supportWhatsapp, upiId } = req.body;

    const settings = await Settings.findOneAndUpdate(
      {},
      {
        commissionPercent,
        supportWhatsapp,
        upiId,
        updatedBy: req.user?.id || null,
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: "Settings updated successfully",
      settings,
    });
  } catch (err) {
    logger.error("Error updating settings:", err);
    next(err);
  }
};
