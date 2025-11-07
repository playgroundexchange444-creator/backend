import express from "express";
import { verifyToken, verifyAdmin } from "../middlewares/authMiddleware.js";
import {
  placeBetController,
  acceptBetController,
  getOpenBetsController,
  getMyBetsController,
  adminSettleBetController,
  adminSettleMatchController,
  getBetByMatchController,
  deleteBetController,
  updateBetController,
  adminGetBetsByMatchController,
} from "../controllers/betController.js";

const router = express.Router();

router.post("/place", verifyToken, placeBetController);
router.post("/accept/:betId", verifyToken, acceptBetController);
router.get("/open", getOpenBetsController);
router.get("/my", verifyToken, getMyBetsController);
router.get("/:matchId", verifyToken, getBetByMatchController);

router.patch("/:betId", verifyToken, updateBetController);
router.delete("/:betId", verifyToken, deleteBetController);

router.post(
  "/admin/settle-bet",
  verifyToken,
  verifyAdmin,
  adminSettleBetController
);
router.post(
  "/admin/settle-match",
  verifyToken,
  verifyAdmin,
  adminSettleMatchController
);
router.get(
  "/admin/match/:matchId",
  verifyToken,
  verifyAdmin,
  adminGetBetsByMatchController
);

export default router;
