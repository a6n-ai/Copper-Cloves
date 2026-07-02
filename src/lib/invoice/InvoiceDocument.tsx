import path from "node:path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { InvoiceData } from "./types";
import { formatPaiseInr } from "./format";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
Font.register({ family: "Playfair", src: path.join(FONT_DIR, "PlayfairDisplay-SemiBold.ttf") });
Font.register({
  family: "Montserrat",
  fonts: [
    { src: path.join(FONT_DIR, "Montserrat-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(FONT_DIR, "Montserrat-SemiBold.ttf"), fontWeight: "semibold" },
  ],
});

const SAGE = "#8f9779";
const TERRACOTTA = "#c17856";
const CREAM = "#f5f2ea";
const CHARCOAL = "#333333";
const MUTED = "#6b6b6b";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Montserrat", fontSize: 10, color: CHARCOAL, backgroundColor: "#fafaf8" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  brand: { fontFamily: "Playfair", fontSize: 20, color: SAGE },
  bizMeta: { fontSize: 9, color: MUTED, marginTop: 4, maxWidth: 220 },
  invoiceTitle: { fontFamily: "Playfair", fontSize: 16, color: CHARCOAL, textAlign: "right" },
  invoiceMeta: { fontSize: 9, color: MUTED, textAlign: "right", marginTop: 2 },
  section: { marginBottom: 16 },
  label: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  strong: { fontWeight: "semibold" },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: SAGE, paddingBottom: 6, marginBottom: 6 },
  row: { flexDirection: "row", paddingVertical: 4 },
  colDesc: { flex: 1 },
  colAmt: { width: 90, textAlign: "right" },
  totalsBox: { marginTop: 12, marginLeft: "auto", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grandRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: SAGE },
  grand: { fontFamily: "Playfair", fontSize: 14, color: TERRACOTTA },
  footer: { position: "absolute", bottom: 32, left: 40, right: 40, fontSize: 8, color: MUTED, textAlign: "center", borderTopWidth: 1, borderTopColor: "#e5e4dc", paddingTop: 8 },
});

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function InvoiceDocument({ data }: { data: InvoiceData }) {
  return (
    <Document title={`Invoice ${data.invoiceNumber}`}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.brand}>{data.business.name}</Text>
            {data.business.address ? <Text style={s.bizMeta}>{data.business.address}</Text> : null}
            {data.business.gstin ? <Text style={s.bizMeta}>GSTIN: {data.business.gstin}</Text> : null}
            {data.business.email ? <Text style={s.bizMeta}>{data.business.email}</Text> : null}
            {data.business.phone ? <Text style={s.bizMeta}>{data.business.phone}</Text> : null}
          </View>
          <View>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.invoiceMeta}>{data.invoiceNumber}</Text>
            <Text style={s.invoiceMeta}>Issued {fmtDate(data.issuedAt)}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Billed to</Text>
          <Text style={s.strong}>{data.billTo.name}</Text>
          {data.billTo.email ? <Text style={s.bizMeta}>{data.billTo.email}</Text> : null}
          {data.billTo.phone ? <Text style={s.bizMeta}>{data.billTo.phone}</Text> : null}
        </View>

        <View style={s.section}>
          <Text style={s.label}>For</Text>
          <Text>{data.booking.className}{data.booking.classTime ? ` · ${fmtDate(data.booking.classTime)}` : ""}</Text>
        </View>

        <View style={s.tableHead}>
          <Text style={[s.colDesc, s.label]}>Description</Text>
          <Text style={[s.colAmt, s.label]}>Amount</Text>
        </View>
        {data.lines.map((ln, i) => (
          <View style={s.row} key={`${ln.label}-${i}`}>
            <Text style={s.colDesc}>{ln.label}</Text>
            <Text style={s.colAmt}>{formatPaiseInr(ln.amountPaise)}</Text>
          </View>
        ))}

        <View style={s.totalsBox}>
          <View style={s.totalRow}>
            <Text>Subtotal</Text>
            <Text>{formatPaiseInr(data.subtotalPaise)}</Text>
          </View>
          {data.taxPaise > 0 ? (
            <View style={s.totalRow}>
              <Text>Tax</Text>
              <Text>{formatPaiseInr(data.taxPaise)}</Text>
            </View>
          ) : null}
          <View style={s.grandRow}>
            <Text style={s.grand}>Total</Text>
            <Text style={s.grand}>{formatPaiseInr(data.totalPaise)}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.label}>Payment</Text>
          <Text>
            {(data.payment.method ?? "—").replace(/_/g, " ")} · Paid {fmtDate(data.payment.paidAt)}
            {data.payment.reference ? ` · Ref ${data.payment.reference}` : ""}
          </Text>
        </View>

        <Text style={s.footer} fixed>
          {data.business.footerNote || "Thank you for practising with us."}
        </Text>
      </Page>
    </Document>
  );
}
