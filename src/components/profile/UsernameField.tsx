import { useState } from "react";
import { AtSign } from "lucide-react";
import { authClient, useSession } from "@/lib/auth/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Mirrors the better-auth username plugin defaults; the server re-validates.
const VALID = /^[a-z0-9_.]{3,30}$/;

/** Self-contained: saves through better-auth, independent of the profile form. */
export function UsernameField() {
  const { data } = useSession();
  const current = data?.user?.username ?? "";
  // null = untouched, so the field tracks the session value without an effect.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? current;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const dirty = value !== current;

  async function save() {
    if (!VALID.test(value)) return setError("3–30 characters: letters, numbers, dots or underscores.");
    setSaving(true);
    setError(null);
    const { error: err } = await authClient.updateUser({ username: value });
    setSaving(false);
    if (err) return setError(err.message ?? "Couldn't update username.");
    setDraft(null);
    toast({ title: "Username updated", description: `Friends can now find you as @${value}.` });
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="username" className="font-body text-sm text-charcoal flex items-center gap-2">
        <AtSign size={14} className="text-sage" /> Username
      </Label>
      <div className="flex gap-2">
        <Input
          id="username"
          value={value}
          onChange={(e) => { setDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "")); setError(null); }}
          maxLength={30}
          autoComplete="off"
          className="border-sage/20 focus:border-sage h-11 font-body"
        />
        {dirty && (
          <Button type="button" variant="sage" className="h-11 shrink-0" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
      {error
        ? <p className="text-xs text-destructive font-body">{error}</p>
        : <p className="text-xs text-charcoal/40 font-body">How friends find you. Your email and phone stay private.</p>}
    </div>
  );
}
