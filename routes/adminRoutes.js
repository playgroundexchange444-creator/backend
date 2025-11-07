import express from "express";
import { verifyToken, verifyAdmin } from "../middlewares/authMiddleware.js";
import {
  getDashboardStats,
  getAllUsers,
  getPendingTransactions,
  approveTransaction,
  rejectTransaction,
  getAllBets,
  getCommissionReport,
} from "../controllers/adminController.js";

const router = express.Router();

router.use(verifyToken, verifyAdmin);
router.get("/dashboard", getDashboardStats);
router.get("/users", getAllUsers);
router.get("/transactions/pending", getPendingTransactions);
router.post("/transactions/:txnId/approve", approveTransaction);
router.post("/transactions/:txnId/reject", rejectTransaction);
router.get("/bets", getAllBets);
router.get("/commission-report", getCommissionReport);

export default router;
