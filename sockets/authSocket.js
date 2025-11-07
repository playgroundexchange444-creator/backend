import jwt from "jsonwebtoken";
import logger from "../config/logger.js";

export const authSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error("Unauthorized: No token provided"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    logger.error(`Socket auth failed: ${err.message}`);
    next(new Error("Unauthorized"));
  }
};
