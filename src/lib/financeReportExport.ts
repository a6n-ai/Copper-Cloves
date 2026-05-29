// xlsx is ~600KB raw / ~150KB gzip. Loaded dynamically inside the export
// function so it never ships in the admin dashboard's initial bundle — only
// the click handler actually pulls it down.

export type FinanceExportBreakdown = {
  packageListInr?: number;
  couponDiscountInr?: number;
  classOrStudioPassInr?: number;
  cafeNetInr?: number;
  taxInr?: number;
  totalInr?: number;
};

export type FinanceExportDetail = {
  source?: "package" | "booking";
  memberName?: string;
  memberEmail?: string;
  memberPhone?: string;
  purchasedAtISO?: string;
  bookedAtISO?: string;
  transactionKinds?: string[];
  razorpayOrderId?: string | null;
  razorpayPaymentIds?: string[];
  breakdown?: FinanceExportBreakdown;
  attendeeLines?: {
    role: string;
    name: string;
    email?: string;
    phone?: string;
    notes?: string;
  }[];
  cafeLines?: { name: string; quantity: number }[];
  paymentMethodSummary?: string;
  classSummary?: string;
  groupHeadcount?: number;
  isDemo?: boolean;
};

export type FinanceExportTransaction = {
  id: string;
  date: string;
  isFinanceDemo?: boolean;
  member?: string;
  memberFull?: string;
  memberPlusLabel?: string;
  foodOrderedLabel?: string;
  category: string;
  type: string;
  amount: number;
  method: string;
  financeDetail?: FinanceExportDetail;
};

export type FinanceReportPeriod = "filtered" | "week" | "month" | "quarter" | "year" | "all";

function parseYYYYMMDDLocal(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(y, mo, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da) return null;
  return d;
}

export function transactionInExportPeriod(
  displayDateYYYYMMDD: string,
  period: Exclude<FinanceReportPeriod, "filtered" | "all">,
): boolean {
  const txnDay = parseYYYYMMDDLocal(displayDateYYYYMMDD);
  if (!txnDay) return true;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);

  if (period === "week") {
    const cutoff = new Date(startToday);
    cutoff.setDate(cutoff.getDate() - 7);
    return txnDay >= cutoff && txnDay < endToday;
  }
  if (period === "month") {
    return txnDay.getFullYear() === now.getFullYear() && txnDay.getMonth() === now.getMonth();
  }
  if (period === "quarter") {
    const cutoff = new Date(startToday);
    cutoff.setMonth(cutoff.getMonth() - 3);
    return txnDay >= cutoff && txnDay < endToday;
  }
  if (period === "year") {
    return txnDay.getFullYear() === now.getFullYear();
  }
  return true;
}

function formatWhen(detail: FinanceExportDetail | undefined): string {
  if (!detail) return "";
  const iso =
    detail.source === "package" ? detail.purchasedAtISO : detail.bookedAtISO;
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function numOrBlank(n: number | undefined | null): number | "" {
  if (n == null || !Number.isFinite(n)) return "";
  return Math.round(n * 100) / 100;
}

function buildSummaryRows(transactions: FinanceExportTransaction[]) {
  return transactions.map((txn) => {
    const d = txn.financeDetail;
    const b = d?.breakdown;
    return {
      "Transaction ID": txn.id,
      Sample: txn.isFinanceDemo ? "Yes" : "No",
      Date: txn.date,
      Category: txn.category,
      "Ledger type": txn.type,
      "Amount (INR)": numOrBlank(txn.amount),
      "Payment method (list)": txn.method,
      Member: txn.memberFull ?? txn.member ?? "",
      "Guests label": txn.memberPlusLabel ?? "",
      "Food label": txn.foodOrderedLabel ?? "",
      Source: d?.source ?? "",
      "Transaction kinds": (d?.transactionKinds ?? []).join("; "),
      When: formatWhen(d),
      "Payment (detail)": d?.paymentMethodSummary ?? "",
      "Class / package summary": d?.classSummary ?? "",
      "Group headcount": d?.groupHeadcount ?? "",
      "Member name": d?.memberName ?? "",
      "Member email": d?.memberEmail ?? "",
      "Member phone": d?.memberPhone ?? "",
      "Razorpay order ID": d?.razorpayOrderId ?? "",
      "Razorpay payment IDs": (d?.razorpayPaymentIds ?? []).join("; "),
      "Package list (INR)": numOrBlank(b?.packageListInr),
      "Coupon discount (INR)": numOrBlank(b?.couponDiscountInr),
      "Class / pass (INR)": numOrBlank(b?.classOrStudioPassInr),
      "Café net (INR)": numOrBlank(b?.cafeNetInr),
      "Tax (INR)": numOrBlank(b?.taxInr),
      "Total charged (INR)": numOrBlank(b?.totalInr),
    };
  });
}

function buildAttendeeRows(transactions: FinanceExportTransaction[]) {
  const rows: Record<string, string | number>[] = [];
  for (const txn of transactions) {
    const lines = txn.financeDetail?.attendeeLines ?? [];
    if (lines.length === 0) {
      rows.push({
        "Transaction ID": txn.id,
        Sample: txn.isFinanceDemo ? "Yes" : "No",
        Role: "",
        Name: txn.memberFull ?? txn.member ?? "",
        Email: "",
        Phone: "",
        Notes: "",
      });
      continue;
    }
    for (const line of lines) {
      rows.push({
        "Transaction ID": txn.id,
        Sample: txn.isFinanceDemo ? "Yes" : "No",
        Role: line.role,
        Name: line.name,
        Email: line.email ?? "",
        Phone: line.phone ?? "",
        Notes: line.notes ?? "",
      });
    }
  }
  return rows;
}

function buildCafeRows(transactions: FinanceExportTransaction[]) {
  const rows: Record<string, string | number>[] = [];
  for (const txn of transactions) {
    const lines = txn.financeDetail?.cafeLines ?? [];
    for (const line of lines) {
      rows.push({
        "Transaction ID": txn.id,
        Sample: txn.isFinanceDemo ? "Yes" : "No",
        "Café item": line.name,
        Quantity: line.quantity,
      });
    }
  }
  return rows;
}

/** Build and download a multi-sheet Finance-1 Excel workbook (browser only). */
export async function downloadFinanceReportExcel(
  transactions: FinanceExportTransaction[],
  filenameStem: string,
): Promise<void> {
  if (typeof window === "undefined") return;

  // Dynamic import keeps xlsx out of the admin dashboard's initial bundle.
  const XLSX = await import("xlsx");

  const summary = buildSummaryRows(transactions);
  const attendees = buildAttendeeRows(transactions);
  const cafe = buildCafeRows(transactions);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Transactions");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(attendees.length ? attendees : [{ Note: "No attendee rows" }]),
    "Attendees",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(cafe.length ? cafe : [{ Note: "No café line items" }]),
    "Cafe items",
  );

  const safeStem = filenameStem.replace(/[^\w.-]+/g, "_").slice(0, 80);
  const datePart = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${safeStem}_${datePart}.xlsx`);
}
