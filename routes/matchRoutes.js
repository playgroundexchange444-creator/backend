import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  createMatch,
  getAllMatches,
  getLiveSportMonksMatches,
  getMatchesByLeague,
  getLeagues,
  getMatchDetails,
  settleMatch,
  updateMatchStatus,
  getMatchesBySport,
} from "../controllers/matchController.js";
import { verifyAdmin, verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "uploads/matches";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/", verifyToken, verifyAdmin, upload.single("image"), createMatch);
router.put("/:id/status", verifyToken, verifyAdmin, updateMatchStatus);
router.post("/settle", verifyToken, verifyAdmin, settleMatch);

router.get("/sport/:sport", getMatchesBySport);
router.get("/live", getLiveSportMonksMatches);
router.get("/leagues", getLeagues);
router.get("/league/:leagueId", getMatchesByLeague);
router.get("/detail/:matchId", getMatchDetails);
router.get("/", getAllMatches);

export default router;
