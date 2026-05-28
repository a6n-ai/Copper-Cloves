import logger from "@/lib/logger";
import type { NextApiResponse } from "next";

const STATUS_MESSAGES: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  503: "Service unavailable",
};

/**
 * Log an error with pino and send a JSON error response.
 * Keeps every catch block to a single line.
 *
 * @example
 * catch (e) {
 *   return apiError(res, e, "[route/label]");            // 500
 *   return apiError(res, e, "[route/label]", 503, msg);  // custom status + message
 * }
 */
export function apiError(
  res: NextApiResponse,
  err: unknown,
  label: string,
  status = 500,
  message?: string
): void {
  logger.error({ err }, label);
  res.status(status).json({ error: message ?? STATUS_MESSAGES[status] ?? "Something went wrong" });
}
