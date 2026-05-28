import { toast } from "sonner";

/**
 * Show an error toast from a parsed API response body.
 * Reads the `{ error: string }` shape that all API routes return.
 *
 * @example
 * const data = await res.json();
 * if (!res.ok) { toastApiError(data); return; }
 */
export function toastApiError(body: unknown, fallback = "Something went wrong"): void {
  const message =
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
      ? (body as { error: string }).error
      : fallback;
  toast.error(message);
}

/**
 * Show an error toast from any thrown value (Error, string, unknown).
 *
 * @example
 * catch (e) { toastError(e, "Could not save"); }
 */
export function toastError(err: unknown, fallback = "Something went wrong"): void {
  if (typeof err === "string") {
    toast.error(err || fallback);
  } else if (err instanceof Error) {
    toast.error(err.message || fallback);
  } else {
    toast.error(fallback);
  }
}
