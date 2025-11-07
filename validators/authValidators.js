import { body } from "express-validator";

export const signupValidator = [
  body("name").notEmpty().withMessage("Name is required"),
  body("username")
    .isLength({ min: 3 })
    .withMessage("Username must be at least 3 characters long"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/[A-Z]/)
    .withMessage("Password must include an uppercase letter")
    .matches(/\d/)
    .withMessage("Password must include a number")
    .matches(/[^A-Za-z0-9]/)
    .withMessage("Password must include at least one symbol (e.g. @, #, $)"),
];

export const loginValidator = [
  body("username").notEmpty().withMessage("Username required"),
  body("password").notEmpty().withMessage("Password required"),
];
