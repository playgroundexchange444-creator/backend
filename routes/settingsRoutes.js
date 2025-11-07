import express from "express";
import { verifyToken, verifyAdmin } from "../middlewares/authMiddleware.js";
import {
  getSettings,
  updateSettings,
} from "../controllers/settingsController.js";

const router = express.Router();

router.get("/", getSettings);

router.post("/", verifyToken, verifyAdmin, updateSettings);

export default router;
