import { useCallback, useState } from "react";
import { Mail, Send } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Spinner } from "@/components/ui/spinner";

const FIELD =
  "border-sage/30 focus-visible:border-sage focus-visible:ring-2 focus-visible:ring-sage/30 focus-visible:ring-offset-0";

type TestResult = { ok: boolean; msg: string };

/**
 * Standalone email diagnostics panel: sends a plain test email through the live
 * transport (Gmail → Resend) and surfaces the SMTP/config status the endpoint
 * reports back. The single diagnostic send path; no demo/seed email sends.
 */
export default function EmailHealthCheck() {
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [config, setConfig] = useState<Record<string, string> | null>(null);

  const handleSend = useCallback(async () => {
    const target = to.trim();
    if (!target) return;
    setSending(true);
    setResult(null);
    try {
      const r = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: target }),
      });
      const data = await r.json().catch(() => ({}));
      if (data?.config) setConfig(data.config as Record<string, string>);
      const sent = r.ok && data?.result?.ok !== false && data?.result?.skipped !== true;
      setResult(
        sent
          ? { ok: true, msg: `Test email sent to ${target}` }
          : { ok: false, msg: data?.result?.reason || data?.error || `Send failed (${r.status})` },
      );
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "Network error" });
    } finally {
      setSending(false);
    }
  }, [to]);

  return (
    <Card className="border-sage/20 bg-white-warm transition-shadow hover:shadow-[0_4px_24px_rgba(51,51,51,0.08)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-2xl text-charcoal">
          <Mail size={20} className="text-terracotta" aria-hidden />
          Email health check
        </CardTitle>
        <CardDescription className="font-body text-charcoal/60">
          Send a diagnostic email through the live transport and confirm the SMTP / API configuration.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid max-w-xl gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && to.trim() && !sending) void handleSend();
              }}
              placeholder="you@studio.in"
              className={`${FIELD} flex-1`}
              aria-label="Test recipient email address"
            />
            <Button
              type="button"
              onClick={handleSend}
              disabled={sending || !to.trim()}
              variant="sage"
              className="shrink-0 active:scale-[0.97]"
            >
              {sending ? (
                <>
                  <Spinner className="mr-2 size-4" />
                  Sending…
                </>
              ) : (
                <>
                  <Send size={14} className="mr-2" aria-hidden />
                  Send test email
                </>
              )}
            </Button>
          </div>

          {result && (
            <div
              role="status"
              className={`rounded-lg p-2.5 font-body text-xs ${
                result.ok
                  ? "border border-sage/20 bg-sage/10 text-sage"
                  : "border border-pill-danger-fg/25 bg-pill-danger-bg text-pill-danger-fg"
              }`}
            >
              {result.msg}
            </div>
          )}

          {config && (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-sage/10 pt-3 sm:grid-cols-2">
              {Object.entries(config).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <dt className="truncate font-mono text-[10px] tabular-nums text-charcoal/45">{k}</dt>
                  <dd>
                    <Pill tone={v === "MISSING" ? "danger" : "success"} size="sm" noIcon>
                      {v === "MISSING" ? "missing" : v === "set" ? "set" : v}
                    </Pill>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
