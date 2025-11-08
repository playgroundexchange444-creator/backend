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

// ✅ Allowed frontend origins
const allowedOrigins = [
  "https://superadmin.playgroundexchange.live",
  "https://playgroundexchange.live",
  "https://www.playgroundexchange.live",
  "http://localhost:5173",
  "http://localhost:5174",
];

// ✅ CORS setup
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow mobile apps / curl

      const normalizedOrigin = origin.replace(/\/$/, ""); // remove trailing slash

      if (allowedOrigins.includes(normalizedOrigin)) {
        console.log("✅ Allowed origin:", normalizedOrigin);
        callback(null, true);
      } else {
        console.warn("❌ CORS blocked request from origin:", normalizedOrigin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Properly handle preflight requests (Express v5 compatible)
app.options(/.*/, cors());

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

// ✅ Fallback 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ✅ Graceful CORS error response
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "CORS policy: This origin is not allowed to access the resource.",
    });
  }
  next(err);
});

// ✅ Global error handler
app.use(errorHandler);

export default app;
