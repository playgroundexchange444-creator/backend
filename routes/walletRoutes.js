import express from "express";
import {
  getWallet,
  addBalance,
  withdrawRequest,
  getTransactions,
} from "../controllers/walletController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, getWallet);
router.post("/add", verifyToken, addBalance);
router.post("/withdraw", verifyToken, withdrawRequest);
router.get("/transactions", verifyToken, getTransactions);

export default router;
