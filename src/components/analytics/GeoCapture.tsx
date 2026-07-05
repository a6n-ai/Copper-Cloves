import { useEffect } from "react";
import { useSession } from "next-auth/react";

// Fire-and-forget: once per authenticated browser session, ask for GPS and POST
// it to attach coordinates to this login's UserSession row. Renders nothing.
// Denied/blocked/unsupported => silent no-op; the row simply keeps null GPS.
export function GeoCapture() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    if (sessionStorage.getItem("geo-captured") === "1") return;
    sessionStorage.setItem("geo-captured", "1"); // mark upfront so we don't re-prompt on re-render

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void fetch("/api/analytics/record-geo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        }).catch(() => {});
      },
      () => {}, // denied / timeout / unavailable — do nothing
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, [status]);

  return null;
}
