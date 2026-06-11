/**
 * lib/email.ts
 *
 * Centralised email sending via nodemailer.
 * Every transactional email in the auth flow lives here so
 * SMTP config, FROM address, and HTML templates are maintained
 * in one place only.
 *
 * Env vars required:
 *   SMTP_HOST       e.g. smtp.resend.com | smtp.gmail.com
 *   SMTP_PORT       e.g. 465 (SSL) | 587 (STARTTLS)
 *   SMTP_SECURE     "true" for port 465, "false" for 587
 *   SMTP_USER       SMTP username / API key username
 *   SMTP_PASS       SMTP password / API key
 *   EMAIL_FROM      e.g. "Frankstat <noreply@frankstat.co.ke>"
 *   NEXT_PUBLIC_APP_URL  e.g. https://frankstat.co.ke
 */

import nodemailer, { type Transporter } from "nodemailer";

// ─────────────────────────────────────────────────────────────────────────────
// Transporter (created once, reused)
// ─────────────────────────────────────────────────────────────────────────────

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: process.env.SMTP_SECURE === "true", // true = SSL on 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
}

const FROM = process.env.EMAIL_FROM ?? "fransktat-printing@frankstat.com";

// Priority: Cloudflare Tunnel URL > Standard App URL > Localhost fallback
const APP_URL = 
  process.env.NEXT_PUBLIC_CLOUDFLARED_URL || 
  process.env.NEXT_PUBLIC_APP_URL || 
  "http://localhost:3000";

// ─────────────────────────────────────────────────────────────────────────────
// Shared HTML shell
// ─────────────────────────────────────────────────────────────────────────────

function emailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F9F6F2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F6F2;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#FFFFFF;border-radius:12px;overflow:hidden;
                      border:1px solid #E2D5C3;max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1C1410;padding:28px 40px;text-align:left;">
              <span style="font-size:22px;font-weight:900;color:#FFFFFF;
                           letter-spacing:-0.02em;font-family:Georgia,serif;">
                FRANK<span style="color:#C19A4A;">STAT</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9F6F2;padding:20px 40px;
                       border-top:1px solid #E2D5C3;text-align:center;">
              <p style="margin:0;font-size:12px;color:#8B7355;">
                © ${new Date().getFullYear()} Frankstat Printing Solutions · Nairobi, Kenya
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#B0A090;">
                This email was sent to you because you have an account at Frankstat.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" target="_blank"
     style="display:inline-block;margin-top:24px;padding:14px 28px;
            background:#1C1410;color:#FFFFFF;border-radius:8px;
            font-size:15px;font-weight:700;text-decoration:none;
            letter-spacing:0.01em;">
    ${label}
  </a>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL SENDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send the email-verification link on signup.
 */
export async function sendVerificationEmail(opts: {
  to: string;
  fullName: string;
  token: string;
}): Promise<void> {
  const { to, fullName, token } = opts;
  const link = `${APP_URL}/api/auth/verify-email?token=${token}`;
  const firstName = fullName.split(" ")[0];

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;
               color:#1C1410;font-family:Georgia,serif;">
      Welcome to Frankstat, ${firstName}!
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#5C4A38;line-height:1.7;">
      Thanks for signing up. Before you can place orders and pay via M-Pesa,
      we need to confirm your email address.
    </p>
    <p style="margin:0;font-size:15px;color:#5C4A38;line-height:1.7;">
      Click the button below — this link expires in
      <strong style="color:#1C1410;">24 hours</strong>.
    </p>
    ${ctaButton(link, "Verify My Email →")}
    <p style="margin:24px 0 0;font-size:12px;color:#8B7355;">
      Or copy and paste this URL into your browser:<br/>
      <a href="${link}" style="color:#C19A4A;word-break:break-all;">${link}</a>
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#B0A090;">
      If you didn't create a Frankstat account, you can safely ignore this email.
    </p>
  `;

  await getTransporter().sendMail({
    from: FROM,
    to,
    subject: "Verify your Frankstat account",
    text: `Hi ${firstName}, verify your email: ${link}  (expires in 24 hours)`,
    html: emailShell("Verify your Frankstat account", body),
  });
}

/**
 * Send "order ready for pickup" notification.
 */
export async function sendOrderReadyEmail(opts: {
  to: string;
  fullName: string;
  orderId: string;
  serviceName: string;
}): Promise<void> {
  const { to, fullName, orderId, serviceName } = opts;
  const firstName = fullName.split(" ")[0];
  const shortId = orderId.slice(-8).toUpperCase();
  const dashboardLink = `${APP_URL}/dashboard`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;
               color:#1C1410;font-family:Georgia,serif;">
      Your order is ready, ${firstName}!
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#5C4A38;line-height:1.7;">
      Great news — your <strong style="color:#1C1410;">${serviceName}</strong> order
      <strong style="color:#1C1410;">#${shortId}</strong> has passed quality check
      and is ready for collection at our Nairobi office.
    </p>
    <p style="margin:0;font-size:15px;color:#5C4A38;line-height:1.7;">
      Please bring your order reference number when you come to pick it up.
      If you opted for delivery, your order will be dispatched shortly.
    </p>
    ${ctaButton(dashboardLink, "View My Orders →")}
    <p style="margin:24px 0 0;font-size:13px;color:#5C4A38;
              background:#FFFBF0;border-radius:6px;padding:12px 14px;
              border-left:3px solid #C19A4A;">
      <strong>Order reference:</strong> #${shortId}<br/>
      <strong>Service:</strong> ${serviceName}
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#B0A090;">
      Questions? Reply to this email or visit your dashboard to contact support.
    </p>
  `;

  await getTransporter().sendMail({
    from: FROM,
    to,
    subject: `Your Frankstat order #${shortId} is ready for pickup`,
    text: `Hi ${firstName}, your ${serviceName} order #${shortId} is ready for collection. Visit your dashboard: ${dashboardLink}`,
    html: emailShell(`Order #${shortId} is ready`, body),
  });
}

/**
 * Send the password-reset link.
 */
export async function sendPasswordResetEmail(opts: {
  to: string;
  fullName: string;
  token: string;
}): Promise<void> {
  const { to, fullName, token } = opts;
  const link = `${APP_URL}/api/auth/reset-password?token=${token}`;
  const firstName = fullName.split(" ")[0];

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;
               color:#1C1410;font-family:Georgia,serif;">
      Reset your password
    </h2>
    <p style="margin:0 0 16px;font-size:15px;color:#5C4A38;line-height:1.7;">
      Hi ${firstName}, we received a request to reset the password for your
      Frankstat account.
    </p>
    <p style="margin:0;font-size:15px;color:#5C4A38;line-height:1.7;">
      Click the button below to choose a new password. This link expires in
      <strong style="color:#1C1410;">1 hour</strong>.
    </p>
    ${ctaButton(link, "Reset My Password →")}
    <p style="margin:24px 0 0;font-size:12px;color:#8B7355;">
      Or copy and paste this URL into your browser:<br/>
      <a href="${link}" style="color:#C19A4A;word-break:break-all;">${link}</a>
    </p>
    <p style="margin:20px 0 0;font-size:13px;color:#C0392B;
              background:#FFF0EE;border-radius:6px;padding:10px 14px;">
      ⚠️ If you did not request a password reset, please ignore this email.
      Your password will not change.
    </p>
  `;

  await getTransporter().sendMail({
    from: FROM,
    to,
    subject: "Reset your Frankstat password",
    text: `Hi ${firstName}, reset your password: ${link}  (expires in 1 hour)`,
    html: emailShell("Reset your Frankstat password", body),
  });
}
