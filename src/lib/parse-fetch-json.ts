/** Only parse JSON when the response claims to be JSON (avoids SyntaxError on HTML error pages). */
export async function parseJsonResponse<T>(
  res: Response
): Promise<T | undefined> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return undefined;
  try {
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

export async function errorMessageFromResponse(res: Response): Promise<string> {
  const body = await parseJsonResponse<{ error?: string; message?: string }>(res);
  if (body?.error) return body.error;
  if (typeof body?.message === "string") return body.message;
  if (res.status === 503 || res.status === 502)
    return "Server is unavailable. Try again shortly.";
  if (res.status >= 500) return `Server error (${res.status}). Is the database connected?`;
  return `Request failed (${res.status})`;
}
