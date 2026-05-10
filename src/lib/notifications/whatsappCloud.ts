export type WhatsAppSendResult =
  | { ok: true; skipped?: false }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; error: string };

/**
 * Sends a pre-approved WhatsApp Cloud API template.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messaging-templates
 */
export async function sendWhatsAppTemplateMessage(options: {
  toDigits: string;
  templateName: string;
  languageCode: string;
  bodyParameters: string[];
}): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token?.trim() || !phoneNumberId?.trim()) {
    return { ok: false, skipped: true, reason: "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID unset" };
  }

  const versionRaw = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
  const v = versionRaw.startsWith("v") ? versionRaw : `v${versionRaw}`;
  const url = `https://graph.facebook.com/${v}/${phoneNumberId}/messages`;

  const templateObj: Record<string, unknown> = {
    name: options.templateName,
    language: { code: options.languageCode },
  };
  if (options.bodyParameters.length > 0) {
    templateObj.components = [
      {
        type: "body",
        parameters: options.bodyParameters.map((text) => ({
          type: "text",
          text: text.slice(0, 900),
        })),
      },
    ];
  }

  const payload = {
    messaging_product: "whatsapp",
    to: options.toDigits,
    type: "template",
    template: templateObj,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; type?: string; code?: number };
  };
  if (!res.ok) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }
  return { ok: true };
}
