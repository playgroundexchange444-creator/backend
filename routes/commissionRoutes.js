import express from "express";
import { verifyToken, verifyAdmin } from "../middlewares/authMiddleware.js";
import {
  getAllCommissions,
  getCommissionStats,
} from "../controllers/commissionController.js";

const router = express.Router();

router.get("/", verifyToken, verifyAdmin, getAllCommissions);
router.get("/stats", verifyToken, verifyAdmin, getCommissionStats);

export default router;
