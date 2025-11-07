import { Server } from "socket.io";
import logger from "../config/logger.js";

let ioInstance;

export const initSocket = (server) => {
  if (ioInstance) return ioInstance;

  ioInstance = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN?.split(",") || [
        "http://localhost:5173",
        "http://localhost:5174",
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  ioInstance.on("connection", (socket) => {
    if (socket.user?.id) {
      socket.join(`user_${socket.user.id}`);
      if (socket.user.role === "admin") socket.join("admins");
      logger.info(`Socket connected: ${socket.id} -> user_${socket.user.id}`);
    } else {
      logger.info(`Socket connected (unauth): ${socket.id}`);
    }

    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return ioInstance;
};

export const getIO = () => {
  if (!ioInstance) throw new Error("Socket.io not initialized");
  return ioInstance;
};
