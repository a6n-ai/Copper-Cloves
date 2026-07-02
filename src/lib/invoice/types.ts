export interface InvoiceLine {
  label: string;
  amountPaise: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: string; // ISO
  business: {
    name: string;
    address: string | null;
    gstin: string | null;
    email: string | null;
    phone: string | null;
    logoUrl: string | null;
    footerNote: string | null;
  };
  billTo: { name: string; email: string | null; phone: string | null };
  booking: { className: string; classTime: string | null };
  lines: InvoiceLine[]; // excludes tax
  subtotalPaise: number; // sum of lines
  taxPaise: number;
  totalPaise: number; // authoritative — subtotal + tax
  payment: { method: string | null; reference: string | null; paidAt: string | null };
}
