/**
 * Sample Finance-1 ledger rows for **local/dev UI preview only** (no DB writes).
 * Not included in production builds or production API responses unless
 * `NEXT_PUBLIC_FINANCE_DEMO=1` is set explicitly for a staging preview.
 */

/** True when Finance tab may show in-memory sample rows (never persisted). */
export function isFinanceDemoEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_FINANCE_DEMO?.trim();
  if (flag === "1") return true;
  if (flag === "0") return false;
  return process.env.NODE_ENV !== "production";
}

export function financeDemoTransactionsForUi(): FinanceDemoTxn[] {
  return isFinanceDemoEnabled() ? getFinanceDemoTransactions() : [];
}

function dtLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type FinanceDemoTxn = {
  id: string;
  rawId: string;
  sortKey: string;
  memberPlusLabel: string;
  foodOrderedLabel: string;
  finance1Tag: boolean;
  isFinanceDemo: true;
  date: string;
  member: string;
  memberFull: string;
  type: "revenue";
  amount: number;
  category: string;
  method: string;
  financeDetail: {
    finance1: true;
    isDemo: true;
    source: "booking" | "package";
    memberName: string;
    memberEmail: string;
    memberPhone: string;
    purchasedAtISO?: string;
    bookedAtISO?: string;
    transactionKinds: string[];
    razorpayOrderId: string | null;
    razorpayPaymentIds: string[];
    breakdown: {
      packageListInr?: number;
      couponDiscountInr?: number;
      classOrStudioPassInr?: number;
      cafeNetInr?: number;
      taxInr?: number;
      totalInr?: number;
    };
    attendeeLines: {
      role: string;
      name: string;
      email?: string;
      phone?: string;
      notes?: string;
    }[];
    cafeLines: { name: string; quantity: number }[];
    paymentMethodSummary: string;
    classSummary?: string;
    groupHeadcount?: number;
  };
};

export function getFinanceDemoTransactions(): FinanceDemoTxn[] {
  const now = new Date();
  const today = dtLocal(now);
  const yesterday = dtLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const bookedAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30).toISOString();
  const purchasedAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 14, 15).toISOString();

  return [
    {
      id: "demo-finance-booking-guests-food",
      rawId: "demo-1",
      sortKey: bookedAt,
      memberPlusLabel: "+2",
      foodOrderedLabel: "Food ordered",
      finance1Tag: true,
      isFinanceDemo: true,
      date: today,
      member: "Priya",
      memberFull: "Priya Sharma",
      type: "revenue",
      amount: 2847,
      category: "Muay Thai Fundamentals (1 Day Class Pass ×3)",
      method: "Razorpay",
      financeDetail: {
        finance1: true,
        isDemo: true,
        source: "booking",
        memberName: "Priya Sharma",
        memberEmail: "priya.sharma@example.com",
        memberPhone: "+91 98765 43210",
        bookedAtISO: bookedAt,
        transactionKinds: ["1 Day Class Pass (checkout)", "Café purchase"],
        razorpayOrderId: "order_demo_H7k2mN9pQx",
        razorpayPaymentIds: ["pay_demo_A1b2C3d4E5"],
        breakdown: {
          classOrStudioPassInr: 2100,
          cafeNetInr: 520,
          taxInr: 227,
          totalInr: 2847,
        },
        attendeeLines: [
          {
            role: "Member (booking holder)",
            name: "Priya Sharma",
            email: "priya.sharma@example.com",
            phone: "+91 98765 43210",
            notes: "Paid online (Razorpay) — class + café on one checkout where applicable.",
          },
          {
            role: "Guest 1",
            name: "Arjun Sharma",
            email: "arjun@example.com",
            phone: "+91 98765 43211",
            notes: "1 Day Class Pass ×3 (same roster row)",
          },
          {
            role: "Guest 2",
            name: "Meera Sharma",
            notes: "1 Day Class Pass ×3 (same roster row)",
          },
        ],
        cafeLines: [
          { name: "Cold-pressed green juice", quantity: 2 },
          { name: "Granola bowl", quantity: 1 },
        ],
        paymentMethodSummary: "online",
        classSummary: "Muay Thai Fundamentals — 1 Day Class Pass ×3",
        groupHeadcount: 3,
      },
    },
    {
      id: "demo-finance-booking-solo",
      rawId: "demo-2",
      sortKey: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 0).toISOString(),
      memberPlusLabel: "",
      foodOrderedLabel: "No food",
      finance1Tag: true,
      isFinanceDemo: true,
      date: yesterday,
      member: "Rohan",
      memberFull: "Rohan Mehta",
      type: "revenue",
      amount: 899,
      category: "Hatha Flow (1 Day Class Pass ×1)",
      method: "Razorpay",
      financeDetail: {
        finance1: true,
        isDemo: true,
        source: "booking",
        memberName: "Rohan Mehta",
        memberEmail: "rohan.mehta@example.com",
        memberPhone: "+91 91234 56780",
        bookedAtISO: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 18, 0).toISOString(),
        transactionKinds: ["1 Day Class Pass (checkout)"],
        razorpayOrderId: "order_demo_L3n8vR2wTy",
        razorpayPaymentIds: ["pay_demo_F6g7H8i9J0"],
        breakdown: {
          classOrStudioPassInr: 799,
          cafeNetInr: 0,
          taxInr: 100,
          totalInr: 899,
        },
        attendeeLines: [
          {
            role: "Member (booking holder)",
            name: "Rohan Mehta",
            email: "rohan.mehta@example.com",
            phone: "+91 91234 56780",
            notes: "Paid online (Razorpay) — class + café on one checkout where applicable.",
          },
        ],
        cafeLines: [],
        paymentMethodSummary: "online",
        classSummary: "Hatha Flow — 1 Day Class Pass ×1",
        groupHeadcount: 1,
      },
    },
    {
      id: "demo-finance-package",
      rawId: "demo-3",
      sortKey: purchasedAt,
      memberPlusLabel: "",
      foodOrderedLabel: "—",
      finance1Tag: true,
      isFinanceDemo: true,
      date: yesterday,
      member: "Ananya",
      memberFull: "Ananya Iyer",
      type: "revenue",
      amount: 8999,
      category: "10-Class Pass (Package)",
      method: "Razorpay",
      financeDetail: {
        finance1: true,
        isDemo: true,
        source: "package",
        memberName: "Ananya Iyer",
        memberEmail: "ananya.iyer@example.com",
        memberPhone: "+91 99887 76655",
        purchasedAtISO: purchasedAt,
        transactionKinds: ["Package purchase"],
        razorpayOrderId: "order_demo_P4q5R6s7Tu",
        razorpayPaymentIds: ["pay_demo_K1l2M3n4O5"],
        breakdown: {
          packageListInr: 9999,
          couponDiscountInr: 1000,
          classOrStudioPassInr: 8999,
          cafeNetInr: 0,
          taxInr: 0,
          totalInr: 8999,
        },
        attendeeLines: [
          {
            role: "Member",
            name: "Ananya Iyer",
            email: "ananya.iyer@example.com",
            phone: "+91 99887 76655",
            notes: "10-Class Pass (class_pass)",
          },
        ],
        cafeLines: [],
        paymentMethodSummary: "online",
        classSummary: "10-Class Pass (Studio pass / package)",
        groupHeadcount: 1,
      },
    },
    {
      id: "demo-finance-studio-pay",
      rawId: "demo-4",
      sortKey: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 9, 0).toISOString(),
      memberPlusLabel: "+1",
      foodOrderedLabel: "Food ordered",
      finance1Tag: true,
      isFinanceDemo: true,
      date: dtLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2)),
      member: "Dev",
      memberFull: "Dev Patel",
      type: "revenue",
      amount: 1650,
      category: "Combat Conditioning (Day-pass equivalent ×2)",
      method: "Pay at studio",
      financeDetail: {
        finance1: true,
        isDemo: true,
        source: "booking",
        memberName: "Dev Patel",
        memberEmail: "dev.patel@example.com",
        memberPhone: "+91 90000 11223",
        bookedAtISO: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 9, 0).toISOString(),
        transactionKinds: ["Class checkout", "Café purchase"],
        razorpayOrderId: null,
        razorpayPaymentIds: [],
        breakdown: {
          classOrStudioPassInr: 1200,
          cafeNetInr: 350,
          taxInr: 100,
          totalInr: 1650,
        },
        attendeeLines: [
          {
            role: "Member (booking holder)",
            name: "Dev Patel",
            email: "dev.patel@example.com",
            phone: "+91 90000 11223",
            notes: "Pay at studio",
          },
          {
            role: "Guest 1",
            name: "Sam Patel",
            phone: "+91 90000 11224",
            notes: "Day-pass equivalent ×2 (same roster row)",
          },
        ],
        cafeLines: [{ name: "Masala chai", quantity: 2 }],
        paymentMethodSummary: "studio",
        classSummary: "Combat Conditioning — Day-pass equivalent ×2",
        groupHeadcount: 2,
      },
    },
  ];
}
