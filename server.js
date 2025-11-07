import dotenvFlow from "dotenv-flow";
dotenvFlow.config();

import http from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import logger from "./config/logger.js";
import { ensureSingleAdmin } from "./config/setupAdmin.js";
import cron from "node-cron";

import { fetchAndSettleCompletedMatches } from "./services/autoSettleService.js";
import {
  startSportMonksAutoSync,
  fetchLiveMatches,
} from "./services/sportmonksSyncService.js";
import { startAutoCleanup } from "./services/cleanupService.js";

import { initSocket } from "./sockets/socket.js";
import { authSocket } from "./sockets/authSocket.js";
import { registerSocketEvents } from "./sockets/eventHandlers.js";

(async () => {
  try {
    await connectDB();
    await ensureSingleAdmin();

    const server = http.createServer(app);
    const io = initSocket(server);
    io.use(authSocket);

    io.on("connection", (socket) => {
      logger.info(`Socket connected: ${socket.id}`);
      registerSocketEvents(io, socket);

      socket.on("disconnect", (reason) => {
        logger.warn(`Socket disconnected: ${socket.id} (${reason})`);
      });
    });

    await fetchLiveMatches();
    startSportMonksAutoSync();
    startAutoCleanup();
    cron.schedule("*/5 * * * *", fetchAndSettleCompletedMatches);

    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error("Server initialization failed:", err);
    process.exit(1);
  }
})();
