import { useState } from "react";
import Link from "next/link";
import { AtSign, Check, Copy } from "lucide-react";
import { useSession } from "@/lib/auth/client";

/** The signed-in member's @handle with one-tap copy, so they can share it with friends. */
export function UsernameBadge({ className = "" }: { className?: string }) {
  const username = useSession().data?.user?.username;
  const [copied, setCopied] = useState(false);
  if (!username) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`@${username}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — the handle is still on screen.
    }
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Username copied" : `Copy your username @${username}`}
        className="inline-flex items-center gap-1.5 rounded-md border border-sage/30 bg-sage/10 px-2 py-0.5 font-body text-sm font-medium text-charcoal transition-colors hover:bg-sage/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
      >
        <AtSign size={13} className="text-sage" aria-hidden />
        {username}
        {copied ? <Check size={13} className="text-sage" aria-hidden /> : <Copy size={13} className="text-charcoal/50" aria-hidden />}
      </button>
      <Link href="/account" className="font-body text-xs text-charcoal/50 underline-offset-2 hover:text-sage hover:underline">
        Edit
      </Link>
    </span>
  );
}
