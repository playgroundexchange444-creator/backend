import express from "express";
import {
  signup,
  login,
  refreshToken,
  logout,
  checkUsername,
} from "../controllers/authController.js";

import {
  signupValidator,
  loginValidator,
} from "../validators/authValidators.js";
import { validateRequest } from "../middlewares/validateRequest.js";

const router = express.Router();

router.get("/check-username", checkUsername);
router.post("/signup", signupValidator, validateRequest, signup);
router.post("/login", loginValidator, validateRequest, login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

export default router;
