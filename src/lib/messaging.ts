import nodemailer from "nodemailer";
import { getBrandingByOrgId } from "./branding";

/** Escape text interpolated into the HTML email body. Voter names and the
 * configured labels are user-supplied, so they must not carry markup through. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Normalise a Nigerian phone number to international format (234XXXXXXXXXX). */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) return digits;
  if (digits.startsWith("0") && digits.length === 11) return "234" + digits.slice(1);
  if (digits.length === 10) return "234" + digits;
  return null;
}

/**
 * Send voter credentials via Gmail SMTP.
 *
 * Sender name, subject, accent colour and the voter-ID wording all come from
 * the configured branding, so a deployment identifies itself to its own voters
 * without a code change.
 *
 * Required env vars:
 *   SMTP_USER – Gmail address used as the SMTP account
 *   SMTP_PASS – Gmail App Password (16 chars, no spaces)
 */
export async function sendVoterCredentialsEmail({
  organizationId,
  email,
  name,
  voterId,
  password,
}: {
  organizationId: string;
  email: string;
  name: string;
  voterId: string;
  password: string;
}): Promise<boolean> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.error("[Email] SMTP_USER or SMTP_PASS env var not set — skipping send");
    return false;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { emailFromName, orgName, brandColor, voterIdLabel } =
    await getBrandingByOrgId(organizationId);

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `"${emailFromName}" <${user}>`,
      to: email,
      subject: `Your ${emailFromName} voting credentials`,
      text: [
        `Hello ${name},`,
        ``,
        `Your ${orgName} voting credentials:`,
        `${voterIdLabel}: ${voterId}`,
        `Password: ${password}`,
        ...(appUrl ? [``, `Vote at: ${appUrl}`] : []),
        ``,
        `Do not share these credentials with anyone.`,
      ].join("\n"),
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:${brandColor}">${escapeHtml(orgName)}</h2>
          <p>Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p>Your login credentials for the ${escapeHtml(orgName)} online election:</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr>
              <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;width:40%">${escapeHtml(voterIdLabel)}</td>
              <td style="padding:8px 12px;font-family:monospace;font-size:16px">${escapeHtml(voterId)}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;background:#f3f4f6;font-weight:600">Password</td>
              <td style="padding:8px 12px;font-family:monospace;font-size:16px">${escapeHtml(password)}</td>
            </tr>
          </table>
          ${appUrl ? `<a href="${appUrl}" style="display:inline-block;background:${brandColor};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Vote now</a>` : ""}
          <p style="margin-top:24px;color:#6b7280;font-size:12px">Do not share these credentials with anyone.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("[Email] Send failed:", err);
    return false;
  }
}

/**
 * Send voter credentials via Infobip WhatsApp template message.
 *
 * Required env vars:
 *   INFOBIP_API_KEY       – from Infobip portal
 *   INFOBIP_BASE_URL      – e.g. 8vmrkr.api.infobip.com
 *   INFOBIP_SENDER        – WhatsApp sender number
 *   INFOBIP_TEMPLATE_NAME – approved template name
 */
export async function sendVoterCredentials({
  organizationId,
  phone,
  name,
  voterId,
  password,
}: {
  organizationId: string;
  phone: string;
  name: string;
  voterId: string;
  password: string;
}): Promise<boolean> {
  const apiKey = process.env.INFOBIP_API_KEY;
  const baseUrl = process.env.INFOBIP_BASE_URL ?? "8vmrkr.api.infobip.com";
  const from = process.env.INFOBIP_SENDER || "447860088970";
  const templateName = process.env.INFOBIP_TEMPLATE_NAME ?? "test_whatsapp_template_en";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { voterIdLabel } = await getBrandingByOrgId(organizationId);

  if (!apiKey) {
    console.error("[Infobip] INFOBIP_API_KEY env var is not set — skipping send");
    return false;
  }

  const to = normalizePhone(phone);
  if (!to) {
    console.error("[Infobip] Could not normalise phone number:", phone);
    return false;
  }

  const placeholder = [
    name,
    `${voterIdLabel}: ${voterId}`,
    `Password: ${password}`,
    ...(appUrl ? [`Vote at: ${appUrl}`] : []),
  ].join(" | ");

  try {
    const res = await fetch(`https://${baseUrl}/whatsapp/1/message/template`, {
      method: "POST",
      headers: {
        Authorization: `App ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            from,
            to,
            content: {
              templateName,
              templateData: { body: { placeholders: [placeholder] } },
              language: "en",
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      console.error(`[Infobip] WhatsApp send failed — status ${res.status}:`, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Infobip] WhatsApp send error:", err);
    return false;
  }
}
