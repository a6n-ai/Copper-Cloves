import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

// Fire-and-forget geolocation collector. Runs once per authenticated tab session
// and attaches coordinates to THIS login's UserSession row. Because the row is
// per-login, a fresh login (new tab/session) re-attempts capture — so as long as
// the user hasn't granted location, they are re-prompted every login.
//
// Hard browser limit: if the user has BLOCKED location for this site, the browser
// shows NO prompt — getCurrentPosition() errors immediately with PERMISSION_DENIED
// and a site CANNOT reopen the native prompt. Only the user can re-enable it via
// the address-bar site settings. We detect that state and show instructions.
export function GeoCapture() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    // Only avoid re-firing on every route change within the SAME tab. sessionStorage
    // is per-tab, so a new login/tab clears this and re-attempts. ponytail: per-tab
    // throttle only — good enough; a logout+login in the same tab won't re-prompt.
    if (sessionStorage.getItem("geo-attempted") === "1") return;
    sessionStorage.setItem("geo-attempted", "1");

    const capture = () => {
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
        (err) => {
          // Blocked at the browser level: no prompt was shown, and we can't force
          // one. Tell the user how to re-enable it themselves.
          if (err.code === err.PERMISSION_DENIED) {
            toast.error(
              "Location is blocked. Tap the lock / location icon in your browser's address bar, set Location to Allow, then reload — check-in needs it.",
              { duration: 8000 },
            );
          }
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    };

    // Use the Permissions API (where supported) to tailor messaging: if already
    // granted, capture silently (no toast); if blocked, skip the "why" toast and
    // go straight to the re-enable instructions via the error path.
    const perms = navigator.permissions;
    if (perms?.query) {
      perms
        .query({ name: "geolocation" as PermissionName })
        .then((res) => {
          if (res.state === "granted") {
            capture(); // silent — already allowed
          } else if (res.state === "denied") {
            toast.error(
              "Location is blocked. Tap the lock / location icon in your browser's address bar, set Location to Allow, then reload — check-in needs it.",
              { duration: 8000 },
            );
          } else {
            // "prompt" — the native ask will appear; give it context first.
            toast.info("Location is needed to make sure check-in is done at the studio");
            capture();
          }
        })
        .catch(() => {
          toast.info("Location is needed to make sure check-in is done at the studio");
          capture();
        });
    } else {
      toast.info("Location is needed to make sure check-in is done at the studio");
      capture();
    }
  }, [status]);

  return null;
}
