import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

const targets = [];

if (isProd) {
  targets.push(
    {
      target: "pino/file",
      level: "info",
      options: { destination: "logs/app.log", mkdir: true },
    },
    {
      target: "pino/file",
      level: "error",
      options: { destination: "logs/error.log", mkdir: true },
    }
  );
} else {
  targets.push({
    target: "pino-pretty",
    options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
    level: "debug",
  });
}

const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
    base: undefined,
    redact: {
      paths: ["req.headers.authorization", "password", "token"], // sensitive fields hide
      remove: true,
    },
  },
  isProd ? pino.transport({ targets }) : pino.transport({ targets })
);

export default logger;
