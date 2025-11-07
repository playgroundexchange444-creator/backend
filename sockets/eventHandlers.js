import logger from "../config/logger.js";

export const registerSocketEvents = (io, socket) => {
  if (socket.user?.id) {
    socket.join(`user_${socket.user.id}`);
    logger.info(`Socket ${socket.id} joined room user_${socket.user.id}`);
  }

  socket.on("ping", () => {
    socket.emit("pong", { msg: "pong from server" });
  });

  socket.on("disconnect", (reason) => {
    logger.info(`Socket disconnected: ${socket.id} (${reason})`);
  });
};
