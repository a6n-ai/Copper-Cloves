const BASE_URL = "https://thestudiobycopperandcloves.in";
const LOGO_URL = `${BASE_URL}/logo2.png`;
const CAFE_IMAGE_URL = `${BASE_URL}/cafe-studio.jpg`;
const INSTAGRAM_URL = "https://www.instagram.com/thestudiobycopperandcloves";
const MAPS_URL = "https://maps.app.goo.gl/rX8vaweAtB877gYv8";

const SAGE = "#7C9070";
const CHARCOAL = "#2C2C2C";
const CREAM = "#F5F0E8";
const MUTED = "#888888";
const BORDER = "#E8E4DC";
const TERRACOTTA = "#C17B5C";

function h(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Shared building blocks ──────────────────────────────────────────────────

function logoHeader(subtitle?: string): string {
  return `
    <div style="text-align:center;padding:40px 24px 24px;background:#fff">
      <img src="${LOGO_URL}" alt="The Studio by Copper + Cloves" width="180" style="max-width:180px;height:auto;filter:brightness(0)" />
      ${subtitle ? `<p style="font-family:Georgia,serif;font-size:13px;letter-spacing:0.1em;color:${MUTED};margin:12px 0 0;text-transform:lowercase">${h(subtitle)}</p>` : ""}
    </div>
  `;
}

function locationCard(): string {
  return `
    <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px">
      <p style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:${TERRACOTTA};margin:0 0 16px;text-align:center">location</p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 10px;line-height:1.6">
        Here's the maps location: <a href="${MAPS_URL}" style="color:${SAGE}">${MAPS_URL}</a>
      </p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 10px;line-height:1.6">
        We're based in Domlur on the 4th floor of the Chakra building, right next to Blush &amp; Brush salon. Look for the Chakra sign, enter on the right-hand side, and take the lift or stairs up to the 4th floor.
      </p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${MUTED};margin:0;line-height:1.6">
        Please note this is a different location than Copper + Cloves cafe in Indiranagar. It is a 6 minute drive from there.
      </p>
    </div>
  `;
}

function classNotesCard(): string {
  return `
    <div style="border-left:3px solid ${SAGE};padding-left:16px;margin:16px 0">
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 8px;line-height:1.6">
        Our classes are beginner-friendly unless otherwise indicated, and our team is here to support you. everyone is welcome!
      </p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 8px;line-height:1.6">
        Classes start exactly on time — please arrive <strong>10 minutes early</strong> to settle in.
      </p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0;line-height:1.6">
        If you have injuries or health conditions, please let your instructor know before class begins.
      </p>
    </div>
  `;
}

function browseClassesCta(portalUrl: string): string {
  return `
    <div style="text-align:center;padding:20px 0">
      <a href="${portalUrl}/portal/book" style="font-family:Georgia,serif;font-size:13px;color:${MUTED};letter-spacing:0.05em">browse classes</a>
    </div>
  `;
}

function facilitiesCard(): string {
  return `
    <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px">
      <p style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${TERRACOTTA};margin:0 0 16px">facilities &amp; guidelines</p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 8px;line-height:1.6"><strong>What to bring:</strong> comfortable clothes, water bottle. mats and props are provided.</p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 8px;line-height:1.6"><strong>Shower:</strong> a single shower is available; we provide shower gel but please bring your own towel and haircare.</p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 8px;line-height:1.6"><strong>Storage:</strong> keep your belongings on the bench inside the studio. please don't leave them in the café during class.</p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0;line-height:1.6"><strong>Parking:</strong> we do not have valet, and only very limited parking is available outside. we recommend nearby side lanes or using a cab/ride share.</p>
    </div>
  `;
}

function afterClassCard(): string {
  return `
    <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px">
      <p style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${TERRACOTTA};margin:0 0 16px">after class</p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0;line-height:1.6">
        Stay a while at our Copper + Cloves café, right inside the studio. enjoy nourishing plant-based smoothie bowls, salads, and toasties — all made from scratch — plus free wi-fi and plenty of power points if you'd like to relax or work.
      </p>
    </div>
  `;
}

function needHelpCard(): string {
  return `
    <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px">
      <p style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${TERRACOTTA};margin:0 0 12px">need help?</p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 12px">we're here to support you every step of the way.</p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 6px">📞 &nbsp;phone/whatsapp: <a href="tel:9008426703" style="color:${CHARCOAL};text-decoration:none">90084 26703</a></p>
      <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0">✉️ &nbsp;email: <a href="mailto:thestudio@copperandcloves.com" style="color:${SAGE}">thestudio@copperandcloves.com</a></p>
    </div>
  `;
}

function footer(): string {
  return `
    <div style="text-align:center;padding:32px 24px 0">
      <a href="${INSTAGRAM_URL}" style="font-family:Georgia,serif;font-size:14px;color:${SAGE};text-decoration:none">Follow us on Instagram</a>
    </div>
    <div style="margin-top:24px;overflow:hidden;border-radius:0 0 16px 16px">
      <img src="${CAFE_IMAGE_URL}" alt="The Studio by Copper + Cloves" width="600" style="width:100%;max-width:600px;height:220px;object-fit:cover;display:block" />
    </div>
    <div style="text-align:center;padding:20px 24px 32px;background:#fff">
      <p style="font-family:Georgia,serif;font-size:12px;color:#BBBBBB;margin:0;line-height:1.6">
        This is an automated message. Please do not reply to this email.<br/>
        For support, contact us at <a href="mailto:thestudio@copperandcloves.com" style="color:#BBBBBB">thestudio@copperandcloves.com</a>
      </p>
    </div>
  `;
}

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Studio by Copper + Cloves</title></head>
<body style="margin:0;padding:0;background-color:#F5F0E8;font-family:Georgia,serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    ${content}
  </div>
</body>
</html>`;
}

// ── Template 1: Class Booking Confirmation (pass / credit booking) ──────────

export interface BookingConfirmationEmailOpts {
  memberName: string;
  className: string;
  instructorName: string;
  dateStr: string;   // e.g. "mon 19 May"
  startTime: string; // e.g. "7:00 PM"
  endTime: string;   // e.g. "8:00 PM"
  portalUrl?: string;
}

export function bookingConfirmationEmail(opts: BookingConfirmationEmailOpts): string {
  const portal = opts.portalUrl ?? BASE_URL;
  return emailWrapper(`
    ${logoHeader()}
    <div style="padding:32px 32px 0">
      <p style="font-family:Georgia,serif;font-size:17px;color:${CHARCOAL};margin:0 0 12px">hi ${h(opts.memberName)},</p>
      <p style="font-family:Georgia,serif;font-size:15px;color:${CHARCOAL};margin:0 0 8px;line-height:1.6">
        You're all set for <strong>${h(opts.className)}</strong> with ${h(opts.instructorName)} on <strong>${h(opts.dateStr)}</strong> at <strong>${h(opts.startTime)}</strong>.
      </p>
      <p style="font-family:Georgia,serif;font-size:15px;color:${MUTED};margin:0 0 28px;line-height:1.6">
        Thank you for reserving a class at Copper + Cloves — we can't wait to welcome you.
      </p>

      ${locationCard()}

      <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px">
        <p style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:${SAGE};margin:0 0 20px;text-align:center">your class</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0;border-bottom:1px solid ${BORDER}">class:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right"><strong>${h(opts.className)}</strong></td></tr>
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0;border-bottom:1px solid ${BORDER}">instructor:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right">${h(opts.instructorName)}</td></tr>
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0;border-bottom:1px solid ${BORDER}">date:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right">${h(opts.dateStr)}</td></tr>
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0">time:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;text-align:right">${h(opts.startTime)} – ${h(opts.endTime)}</td></tr>
        </table>
        ${classNotesCard()}
      </div>

      ${browseClassesCta(portal)}
      ${facilitiesCard()}
      ${afterClassCard()}
      ${needHelpCard()}

      <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:24px">
        <p style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${TERRACOTTA};margin:0 0 12px">cancellation policy</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 8px;line-height:1.6">This booking will be deducted from your class balance.</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 8px;line-height:1.6">Cancel at least <strong>6 hours</strong> before class to retain the credit and book into another session.</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${MUTED};margin:0 0 16px;line-height:1.6">Cancellations made within 6 hours of class start cannot be transferred.</p>
        <p style="font-family:Georgia,serif;font-size:14px;font-style:italic;color:${MUTED};margin:0;text-align:center">we look forward to seeing you on the mat!!</p>
      </div>
    </div>
    ${footer()}
  `);
}

// ── Template 2: Individual Class Purchase + Booking Confirmation ────────────

export interface IndividualClassBookingEmailOpts extends BookingConfirmationEmailOpts {
  transactionId: string;
  paymentDate: string; // e.g. "sun 18 May"
  amountPaid: string;  // e.g. "₹800"
}

export function individualClassBookingEmail(opts: IndividualClassBookingEmailOpts): string {
  const portal = opts.portalUrl ?? BASE_URL;
  return emailWrapper(`
    ${logoHeader("class booked & payment confirmed")}
    <div style="padding:32px 32px 0">
      <p style="font-family:Georgia,serif;font-size:17px;color:${CHARCOAL};margin:0 0 12px">hi ${h(opts.memberName)},</p>
      <p style="font-family:Georgia,serif;font-size:15px;color:${CHARCOAL};margin:0 0 8px;line-height:1.6">
        You're all set for <strong>${h(opts.className)}</strong> with ${h(opts.instructorName)} on <strong>${h(opts.dateStr)}</strong> at <strong>${h(opts.startTime)}</strong>.
      </p>
      <p style="font-family:Georgia,serif;font-size:15px;color:${MUTED};margin:0 0 28px;line-height:1.6">
        Thank you for reserving a class at Copper + Cloves — we can't wait to welcome you.
      </p>

      <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px">
        <p style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:${SAGE};margin:0 0 20px;text-align:center">payment receipt</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0;border-bottom:1px solid ${BORDER}">transaction id:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right;font-family:monospace">${h(opts.transactionId)}</td></tr>
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0;border-bottom:1px solid ${BORDER}">payment date:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right">${h(opts.paymentDate)}</td></tr>
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0;border-bottom:1px solid ${BORDER}">service:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right">Individual Class Purchase</td></tr>
          <tr><td style="font-family:Georgia,serif;font-size:15px;font-weight:600;color:${MUTED};padding:14px 0">amount paid:</td><td style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:${SAGE};padding:14px 0;text-align:right">${h(opts.amountPaid)}</td></tr>
        </table>
      </div>

      ${locationCard()}

      <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px">
        <p style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:${SAGE};margin:0 0 20px;text-align:center">your class</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0;border-bottom:1px solid ${BORDER}">class:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right"><strong>${h(opts.className)}</strong></td></tr>
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0;border-bottom:1px solid ${BORDER}">instructor:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right">${h(opts.instructorName)}</td></tr>
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0;border-bottom:1px solid ${BORDER}">date:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right">${h(opts.dateStr)}</td></tr>
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0">time:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;text-align:right">${h(opts.startTime)} – ${h(opts.endTime)}</td></tr>
        </table>
        ${classNotesCard()}
      </div>

      ${browseClassesCta(portal)}
      ${facilitiesCard()}
      ${afterClassCard()}
      ${needHelpCard()}

      <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:24px">
        <p style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${TERRACOTTA};margin:0 0 12px">cancellation policy</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 8px;line-height:1.6">This was a paid individual class booking.</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${MUTED};margin:0 0 16px;line-height:1.6">Cancellation not available for individual class purchases.</p>
        <p style="font-family:Georgia,serif;font-size:14px;font-style:italic;color:${MUTED};margin:0;text-align:center">we look forward to seeing you on the mat!!</p>
      </div>
    </div>
    ${footer()}
  `);
}

// ── Template 3: Account Ready / Welcome ────────────────────────────────────

export interface AccountReadyEmailOpts {
  memberName: string;
  email: string;
  password: string;
  loginUrl: string;
}

export function accountReadyEmail(opts: AccountReadyEmailOpts): string {
  return emailWrapper(`
    ${logoHeader("welcome to the Studio")}
    <div style="padding:32px 32px 0">

      <div style="text-align:center;margin-bottom:28px">
        <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;color:${CHARCOAL};margin:0">your account is ready!</h1>
      </div>

      <div style="border-left:3px solid ${SAGE};padding-left:20px;margin-bottom:28px">
        <p style="font-family:Georgia,serif;font-size:15px;color:${CHARCOAL};margin:0 0 6px">dear <strong>${h(opts.memberName)}</strong>,</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0;line-height:1.7">
          your account has been successfully created! we're excited to have you join our wellness community. use the credentials below to access your account and start your fitness journey with us.
        </p>
      </div>

      <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:28px;margin-bottom:16px">
        <p style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:${CHARCOAL};margin:0 0 20px;text-align:center">your login credentials</p>
        <div style="background:${CREAM};border-radius:8px;padding:16px;margin-bottom:12px;text-align:center">
          <p style="font-family:Georgia,serif;font-size:12px;color:${MUTED};margin:0 0 6px;letter-spacing:0.05em;text-transform:uppercase">Email</p>
          <p style="font-family:monospace;font-size:15px;font-weight:700;color:${CHARCOAL};margin:0">${h(opts.email)}</p>
        </div>
        <div style="background:${CREAM};border-radius:8px;padding:16px;text-align:center">
          <p style="font-family:Georgia,serif;font-size:12px;color:${MUTED};margin:0 0 6px;letter-spacing:0.05em;text-transform:uppercase">Temporary Password</p>
          <p style="font-family:monospace;font-size:15px;font-weight:700;color:${CHARCOAL};margin:0">${h(opts.password)}</p>
        </div>
      </div>

      <div style="background:#FFFBF0;border:1px solid #E8D8A0;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="font-family:Georgia,serif;font-size:14px;font-weight:700;color:#8B6914;margin:0 0 12px">🔒 important security information:</p>
        <ul style="font-family:Georgia,serif;font-size:14px;color:#8B6914;margin:0;padding-left:20px;line-height:1.8">
          <li>you will be required to change your password on your first login</li>
          <li>keep your credentials secure and don't share them with anyone</li>
          <li>choose a strong password with a mix of letters, numbers, and symbols</li>
          <li>if you experience any issues logging in, contact our support team immediately</li>
        </ul>
      </div>

      <div style="text-align:center;margin-bottom:28px">
        <a href="${h(opts.loginUrl)}" style="display:inline-block;background:${SAGE};color:#fff;padding:14px 40px;border-radius:999px;text-decoration:none;font-family:Georgia,serif;font-size:15px;font-weight:600">login to your account</a>
      </div>

      <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px">
        <p style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:${CHARCOAL};margin:0 0 20px;text-align:center">what's next?</p>
        <table style="width:100%;border-collapse:collapse;text-align:center">
          <tr>
            <td style="padding:8px;vertical-align:top;width:33%">
              <div style="font-family:Georgia,serif;font-size:20px;color:${SAGE};font-weight:700;margin-bottom:6px">1</div>
              <p style="font-family:Georgia,serif;font-size:13px;color:${CHARCOAL};margin:0;line-height:1.5">visit our website and log in with your credentials</p>
            </td>
            <td style="padding:8px;vertical-align:top;width:33%">
              <div style="font-family:Georgia,serif;font-size:20px;color:${SAGE};font-weight:700;margin-bottom:6px">2</div>
              <p style="font-family:Georgia,serif;font-size:13px;color:${CHARCOAL};margin:0;line-height:1.5">set a new password when prompted</p>
            </td>
            <td style="padding:8px;vertical-align:top;width:33%">
              <div style="font-family:Georgia,serif;font-size:20px;color:${SAGE};font-weight:700;margin-bottom:6px">3</div>
              <p style="font-family:Georgia,serif;font-size:13px;color:${CHARCOAL};margin:0;line-height:1.5">complete your profile information</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px;vertical-align:top"></td>
            <td style="padding:8px;vertical-align:top">
              <div style="font-family:Georgia,serif;font-size:20px;color:${SAGE};font-weight:700;margin-bottom:6px">4</div>
              <p style="font-family:Georgia,serif;font-size:13px;color:${CHARCOAL};margin:0;line-height:1.5">browse classes and purchase a membership</p>
            </td>
            <td style="padding:8px;vertical-align:top">
              <div style="font-family:Georgia,serif;font-size:20px;color:${SAGE};font-weight:700;margin-bottom:6px">5</div>
              <p style="font-family:Georgia,serif;font-size:13px;color:${CHARCOAL};margin:0;line-height:1.5">book your first class and start your wellness journey!</p>
            </td>
          </tr>
        </table>
      </div>

      <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px">
        <p style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${TERRACOTTA};margin:0 0 12px">need help? we're here for you!</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 6px"><strong>visit us:</strong> The Studio by Copper + Cloves, Domlur, Bangalore</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 6px"><strong>call us:</strong> <a href="tel:9008426703" style="color:${CHARCOAL};text-decoration:none">90084 26703</a></p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 6px"><strong>email us:</strong> <a href="mailto:thestudio@copperandcloves.com" style="color:${SAGE}">thestudio@copperandcloves.com</a></p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0"><strong>support hours:</strong> Monday – Sunday, 9:00 AM – 8:00 PM</p>
      </div>

      <div style="text-align:center;padding:24px 0">
        <p style="font-family:Georgia,serif;font-size:18px;font-weight:400;color:${CHARCOAL};margin:0 0 4px">welcome to your wellness journey!</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${SAGE};margin:0">The Studio Team</p>
      </div>

    </div>
    ${footer()}
  `);
}

// ── Template 4: Booking Cancellation ───────────────────────────────────────

export interface CancellationEmailOpts {
  memberName: string;
  className: string;
  instructorName: string;
  dateStr: string;
  startTime: string;
  creditsReturned: boolean;
  creditsCount?: number;
  portalUrl?: string;
}

export function cancellationEmail(opts: CancellationEmailOpts): string {
  const portal = opts.portalUrl ?? BASE_URL;
  return emailWrapper(`
    ${logoHeader("booking cancelled")}
    <div style="padding:32px 32px 0">

      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:#FEF2F2;border:1px solid #FECACA;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:24px;margin-bottom:12px">✕</div>
        <h2 style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:${CHARCOAL};margin:0">your booking has been cancelled</h2>
      </div>

      <p style="font-family:Georgia,serif;font-size:17px;color:${CHARCOAL};margin:0 0 12px">hi ${h(opts.memberName)},</p>
      <p style="font-family:Georgia,serif;font-size:15px;color:${CHARCOAL};margin:0 0 24px;line-height:1.6">
        Your booking for <strong>${h(opts.className)}</strong> with ${h(opts.instructorName)} on <strong>${h(opts.dateStr)}</strong> at <strong>${h(opts.startTime)}</strong> has been successfully cancelled.
      </p>

      ${opts.creditsReturned
        ? `<div style="background:#F0FAF0;border:1px solid #A3D9A5;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center">
            <p style="font-family:Georgia,serif;font-size:14px;font-weight:700;color:#2D6A2F;margin:0 0 6px">✓ credit returned to your account</p>
            <p style="font-family:Georgia,serif;font-size:14px;color:#2D6A2F;margin:0">
              ${opts.creditsCount ? `${opts.creditsCount} class credit has` : "Your class credit has"} been returned. You can use it to book another session.
            </p>
          </div>`
        : `<div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center">
            <p style="font-family:Georgia,serif;font-size:14px;font-weight:700;color:#9A3412;margin:0 0 6px">⚠ no credit returned</p>
            <p style="font-family:Georgia,serif;font-size:14px;color:#9A3412;margin:0">This cancellation was made within 6 hours of class start and the credit cannot be transferred.</p>
          </div>`
      }

      <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:16px">
        <p style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:${SAGE};margin:0 0 20px;text-align:center">cancelled class</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0;border-bottom:1px solid ${BORDER}">class:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right">${h(opts.className)}</td></tr>
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0;border-bottom:1px solid ${BORDER}">instructor:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right">${h(opts.instructorName)}</td></tr>
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0;border-bottom:1px solid ${BORDER}">date:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right">${h(opts.dateStr)}</td></tr>
          <tr><td style="font-family:Georgia,serif;font-size:14px;color:${MUTED};padding:10px 0">time:</td><td style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};padding:10px 0;text-align:right">${h(opts.startTime)}</td></tr>
        </table>
      </div>

      <div style="text-align:center;margin-bottom:24px">
        <p style="font-family:Georgia,serif;font-size:14px;color:${MUTED};margin:0 0 14px">ready to book another class?</p>
        <a href="${portal}/portal/book" style="display:inline-block;background:${SAGE};color:#fff;padding:13px 36px;border-radius:999px;text-decoration:none;font-family:Georgia,serif;font-size:14px">browse classes</a>
      </div>

      ${needHelpCard()}

      <div style="background:#fff;border:1px solid ${BORDER};border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="font-family:Georgia,serif;font-size:15px;font-weight:700;color:${TERRACOTTA};margin:0 0 12px">cancellation policy reminder</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${CHARCOAL};margin:0 0 8px;line-height:1.6">Cancel at least <strong>6 hours</strong> before class to retain your credit.</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:${MUTED};margin:0;line-height:1.6">Cancellations within 6 hours of class start cannot be transferred.</p>
      </div>

    </div>
    ${footer()}
  `);
}
