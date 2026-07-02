import type { NextApiRequest, NextApiResponse } from "next";
import { renderToBuffer } from "@react-pdf/renderer";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { buildInvoiceData, InvoiceNotPayableError } from "@/lib/invoice/buildInvoiceData";
import InvoiceDocument from "@/lib/invoice/InvoiceDocument";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  const session = await getStudioServerSession(req, res);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return res.status(401).json({ error: "Unauthorized" });

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Booking id required" });

  // Owner gate — admins may pull any booking; members only their own. 404 (not 403)
  // so we never leak the existence of another member's booking.
  if (user.role !== "admin") {
    const owned = await prisma.booking.findUnique({ where: { id }, select: { user_id: true } });
    if (!owned || owned.user_id !== user.id) return res.status(404).json({ error: "Booking not found" });
  }

  try {
    const data = await buildInvoiceData(id);
    const pdf = await renderToBuffer(<InvoiceDocument data={data} />);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${data.invoiceNumber}.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    return res.status(200).send(pdf);
  } catch (e) {
    if (e instanceof InvoiceNotPayableError) {
      return res.status(409).json({ error: "No invoice available for this booking" });
    }
    throw e;
  }
}
