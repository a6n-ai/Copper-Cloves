export type SharablePass = {
  id: string;
  name: string;
  creditsRemaining: number;
  creditsTotal: number;
  expiresAt: string;
  alreadyShared: number;
};

export type ReceivedShare = {
  id: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  creditsRemaining: number;
  creditsTotal: number;
  expiresAt: string;
};

export async function getShareablePasses(): Promise<SharablePass[]> {
  const r = await fetch("/api/user/shareable-passes");
  return r.ok ? r.json() : [];
}

export async function getReceivedShares(): Promise<ReceivedShare[]> {
  const r = await fetch("/api/shared-credits");
  return r.ok ? r.json() : [];
}

export async function sharePass(
  input: { recipientId: string; userPackageId: string; credits: number },
): Promise<{ ok: boolean; error?: string; sharedCreditId?: string }> {
  const r = await fetch("/api/shared-credits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient_id: input.recipientId,
      user_package_id: input.userPackageId,
      credits: input.credits,
    }),
  });
  const data = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, sharedCreditId: data.shared_credit_id } : { ok: false, error: data.error };
}
