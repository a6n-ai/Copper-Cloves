import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PricingTab, type Coupon, type CouponDraft } from "@/components/admin/dashboard-tabs/PricingTab";

const EMPTY_COUPON_DRAFT: CouponDraft = {
  code: "",
  applies_to: "food",
  discount_type: "percent",
  discount_value: "10",
  is_active: true,
  stackable: false,
  max_discount_inr: "",
  min_order_inr: "",
  max_redemptions: "",
  max_uses_per_user: "1",
  starts_at: "",
  ends_at: "",
};

export default function CouponsTab() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CouponDraft>(EMPTY_COUPON_DRAFT);

  const refreshCoupons = useCallback(async () => {
    const r = await fetch("/api/admin/coupons");
    if (!r.ok) {
      setCoupons([]);
      return;
    }
    const d = await r.json();
    setCoupons(Array.isArray(d) ? d : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const r = await fetch("/api/admin/coupons");
        if (cancelled) return;
        if (!r.ok) {
          setCoupons([]);
          return;
        }
        const d = await r.json();
        if (!cancelled) setCoupons(Array.isArray(d) ? d : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveCouponFromDraft = useCallback(async () => {
    setSaving(true);
    try {
      const body = {
        code: draft.code,
        applies_to: draft.applies_to,
        discount_type: draft.discount_type,
        discount_value: Number(draft.discount_value),
        is_active: draft.is_active,
        stackable: draft.stackable,
        max_discount_inr: draft.max_discount_inr.trim() === "" ? null : draft.max_discount_inr,
        min_order_inr: draft.min_order_inr.trim() === "" ? null : draft.min_order_inr,
        max_redemptions: draft.max_redemptions.trim() === "" ? null : draft.max_redemptions,
        max_uses_per_user: draft.max_uses_per_user.trim() === "" ? null : draft.max_uses_per_user,
        starts_at: draft.starts_at.trim() === "" ? null : draft.starts_at,
        ends_at: draft.ends_at.trim() === "" ? null : draft.ends_at,
      };
      const res = editingId
        ? await fetch("/api/admin/coupons", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingId, ...body }),
          })
        : await fetch("/api/admin/coupons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(typeof err?.error === "string" ? err.error : "Could not save coupon");
        return;
      }
      setEditingId(null);
      setDraft(EMPTY_COUPON_DRAFT);
      await refreshCoupons();
    } finally {
      setSaving(false);
    }
  }, [draft, editingId, refreshCoupons]);

  const deleteCouponById = useCallback(
    async (id: string) => {
      if (!confirm("Delete this coupon?")) return;
      const res = await fetch(`/api/admin/coupons?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not delete coupon");
        return;
      }
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      setEditingId((prev) => (prev === id ? null : prev));
      setDraft((prev) => (editingId === id ? EMPTY_COUPON_DRAFT : prev));
    },
    [editingId]
  );

  const startEditCoupon = useCallback((c: Coupon) => {
    setEditingId(c.id);
    setDraft({
      code: c.code,
      applies_to: c.applies_to,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      is_active: c.is_active,
      stackable: !!c.stackable,
      max_discount_inr: c.max_discount_inr == null ? "" : String(c.max_discount_inr),
      min_order_inr: c.min_order_inr == null ? "" : String(c.min_order_inr),
      max_redemptions: c.max_redemptions == null ? "" : String(c.max_redemptions),
      max_uses_per_user: c.max_uses_per_user == null ? "" : String(c.max_uses_per_user),
      starts_at: c.starts_at ? new Date(c.starts_at).toISOString().slice(0, 16) : "",
      ends_at: c.ends_at ? new Date(c.ends_at).toISOString().slice(0, 16) : "",
    });
  }, []);

  const cancelCouponEdit = useCallback(() => {
    setEditingId(null);
    setDraft(EMPTY_COUPON_DRAFT);
  }, []);

  return (
    <PricingTab
      coupons={coupons}
      loading={loading}
      saving={saving}
      editingId={editingId}
      draft={draft}
      onDraftChange={setDraft}
      onSave={saveCouponFromDraft}
      onCancelEdit={cancelCouponEdit}
      onEdit={startEditCoupon}
      onDelete={deleteCouponById}
    />
  );
}
