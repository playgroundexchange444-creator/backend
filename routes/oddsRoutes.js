import express from "express";
import { verifyToken, verifyAdmin } from "../middlewares/authMiddleware.js";
import {
  fetchOdds,
  setManualOdds,
  getActiveOdds,
} from "../controllers/oddsController.js";

const router = express.Router();

router.get("/fetch", fetchOdds);
router.get("/live", getActiveOdds);

router.post("/manual", verifyToken, verifyAdmin, setManualOdds);

export default router;
