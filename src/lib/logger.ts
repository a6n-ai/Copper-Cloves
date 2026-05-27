import pino, { type Logger } from "pino";
import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "node:crypto";

const isProd = process.env.NODE_ENV === "production";

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  base: {
    env: process.env.NODE_ENV,
    app: "copper-cloves",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.hashedPassword",
      "*.token",
      "*.secret",
      "*.razorpay_signature",
    ],
    censor: "[REDACTED]",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

export function requestLogger(req: NextApiRequest, res: NextApiResponse): Logger {
  const reqId =
    (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
  res.setHeader("x-request-id", reqId);
  return logger.child({
    reqId,
    method: req.method,
    route: req.url,
  });
}

export default logger;
