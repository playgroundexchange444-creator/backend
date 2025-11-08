import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import pinoHttp from "pino-http";
import logger from "./config/logger.js";

import authRoutes from "./routes/authRoutes.js";
import oddsRoutes from "./routes/oddsRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import betRoutes from "./routes/betRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import commissionRoutes from "./routes/commissionRoutes.js";
import sportmonksRoutes from "./routes/sportmonksRoutes.js";

import { errorHandler } from "./middlewares/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ Middleware: JSON parsing
app.use(express.json({ limit: "10mb" }));

// ✅ CORS setup (allow your frontend domains)
const allowedOrigins = [
  "https://superadmin.playgroundexchange.live", // Admin frontend
  "https://playgroundexchange.live",            // User frontend ✅ added
  "http://localhost:5173",                      // Local dev
  "http://localhost:5174",                      // Local dev (Vite alt)
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like curl or mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn("❌ CORS blocked request from origin:", origin);
        return callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true, // allow cookies/auth headers
  })
);

// ✅ Logging middlewares
app.use(morgan("dev"));
app.use(
  pinoHttp({
    logger,
    autoLogging: true,
    redact: ["req.headers.authorization"],
  })
);

// ✅ Static file serving
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ API routes
app.use("/api/auth", authRoutes);
app.use("/api/odds", oddsRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bets", betRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/commission", commissionRoutes);
app.use("/api/sportmonks", sportmonksRoutes);

// ✅ Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", uptime: process.uptime() });
});

// ✅ Error handling middleware
app.use(errorHandler);

export default app;
