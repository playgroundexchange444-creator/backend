// 📁 config/setupAdmin.js
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import logger from "../config/logger.js"; // ✅ Use Pino logger instead of console

export const ensureSingleAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ role: "admin" });

    if (!existingAdmin) {
      const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

      await User.create({
        name: "Super Admin",
        username: process.env.ADMIN_USERNAME,
        password: hashed,
        role: "admin",
        balance: 0,
      });

      // ✅ No console.log → use logger
      logger.info(
        `✅ Default admin created → username: ${process.env.ADMIN_USERNAME}`
      );
    } else {
      logger.info("Admin already exists");
    }
  } catch (error) {
    // ✅ Log errors properly
    logger.error("Error while ensuring admin user:", error);
  }
};
