import prisma from "@/lib/prisma";

const PAID_ORDER_IDS = [
  "order_SpwenG3g2JBL83",
  "order_SpvrTgOYToaK61",
  "order_SpvaueVTn75wPt",
  "order_SpvS7kLBgfrIUH",
  "order_SpvR67WEZqwVZu",
  "order_SpvF24gP75o3c1",
  "order_Spv38x6ClS521p",
];

async function main() {
  // Razorpay-confirmed-paid orders → what does our DB say?
  for (const id of PAID_ORDER_IDS) {
    const order = await prisma.razorpayOrder.findUnique({
      where: { razorpay_order_id: id },
      include: {
        booking: { select: { id: true, status: true, class_schedule_id: true } },
      },
    });
    if (!order) {
      console.log(`${id}  NO LOCAL ORDER ROW`);
      continue;
    }
    const pays = await prisma.razorpayPayment.findMany({
      where: { razorpay_order_id: id },
      select: { status: true, signature_verified: true },
    });
    console.log(
      `${id}  dbStatus=${order.status}  bookingId=${order.booking_id ?? "—"}  pkgId=${order.user_package_id ?? "—"}  bookingStatus=${order.booking?.status ?? "—"}  pays=${JSON.stringify(pays)}`,
    );
  }

  console.log("\n── Global: any DB order status=paid but unfulfilled / pending ──");
  const stuck = await prisma.razorpayOrder.findMany({
    where: {
      status: "paid",
      OR: [
        { booking: { is: { status: { in: ["payment_pending", "expired"] } } } },
        { booking_id: null, user_package_id: null },
      ],
    },
    include: { booking: { select: { status: true } } },
    orderBy: { created_at: "desc" },
    take: 50,
  });
  for (const o of stuck) {
    const pays = await prisma.razorpayPayment.findMany({
      where: { razorpay_order_id: o.razorpay_order_id },
      select: { razorpay_payment_id: true, status: true, signature_verified: true, amount_paise: true },
    });
    console.log(
      `\nSTUCK ${o.razorpay_order_id}  user=${o.user_id}  amount=${o.amount_paise}  created=${o.created_at.toISOString()}`,
    );
    console.log(`  notes=${JSON.stringify(o.notes)}`);
    console.log(`  pays=${JSON.stringify(pays)}`);
  }
  console.log(`\nstuck-paid count: ${stuck.length}`);

  console.log("\n── Orphaned pending/expired bookings for the stuck-paid users ──");
  for (const o of stuck) {
    const bookings = await prisma.booking.findMany({
      where: {
        user_id: o.user_id,
        status: { in: ["payment_pending", "expired", "confirmed"] },
        created_at: {
          gte: new Date(o.created_at.getTime() - 10 * 60_000),
          lte: new Date(o.created_at.getTime() + 30 * 60_000),
        },
      },
      select: {
        id: true,
        status: true,
        class_name: true,
        class_schedule_id: true,
        created_at: true,
      },
      orderBy: { created_at: "asc" },
    });
    console.log(
      `${o.razorpay_order_id} (user ${o.user_id.slice(0, 8)}) → ${bookings.length} nearby bookings: ${JSON.stringify(bookings)}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
