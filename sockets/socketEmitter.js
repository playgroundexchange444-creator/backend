import { getIO } from "./socket.js";

export const emitToUser = (userId, event, data) => {
  const io = getIO();
  io.to(`user_${userId}`).emit(event, data);
};

export const emitToAdmins = (event, data) => {
  const io = getIO();
  io.to("admins").emit(event, data);
};

export const emitToAll = (event, data) => {
  const io = getIO();
  io.emit(event, data);
};
