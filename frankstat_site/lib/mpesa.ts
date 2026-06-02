/**
 * lib/mpesa.ts
 *
 * Safaricom Daraja API — Lipa Na M-Pesa Online (STK Push)
 *
 * Required env vars:
 *   MPESA_ENV              "sandbox" | "production"
 *   MPESA_CONSUMER_KEY     from Daraja portal
 *   MPESA_CONSUMER_SECRET  from Daraja portal
 *   MPESA_SHORTCODE        paybill / till number
 *   MPESA_PASSKEY          from Daraja portal
 *   MPESA_CALLBACK_URL     publicly reachable URL (use ngrok for local dev)
 */

const IS_PRODUCTION = process.env.MPESA_ENV === "production";
const BASE_URL = IS_PRODUCTION
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

// ── Access token cache (tokens last 3600 s) ───────────────────────────────────
let _cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (_cachedToken && _cachedToken.expiresAt > now + 60_000) {
    return _cachedToken.token;
  }
  const key    = process.env.MPESA_CONSUMER_KEY!;
  const secret = process.env.MPESA_CONSUMER_SECRET!;
  if (!key || !secret) throw new Error("MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET not set");

  const credentials = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) throw new Error(`M-Pesa OAuth failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  const token = json.access_token as string;
  const expiresIn = parseInt(json.expires_in ?? "3600", 10);
  _cachedToken = { token, expiresAt: now + expiresIn * 1000 };
  return token;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getTimestamp(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  const nairobi = new Date(utc + 3 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    nairobi.getFullYear(),
    pad(nairobi.getMonth() + 1),
    pad(nairobi.getDate()),
    pad(nairobi.getHours()),
    pad(nairobi.getMinutes()),
    pad(nairobi.getSeconds()),
  ].join("");
}

function getPassword(timestamp: string): string {
  const shortcode = process.env.MPESA_SHORTCODE!;
  const passkey   = process.env.MPESA_PASSKEY!;
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

/**
 * Normalise Kenyan phone → 2547xxxxxxxx
 * Accepts: 07xx | 7xx | +2547xx | 2547xx
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits))   return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits))    return `254${digits}`;
  throw new Error(`Invalid Kenyan phone number: "${raw}". Expected format: 07XXXXXXXX`);
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface StkPushResult {
  MerchantRequestID:   string;
  CheckoutRequestID:   string;
  ResponseCode:        string;
  ResponseDescription: string;
  CustomerMessage:     string;
}

export interface StkCallbackItem {
  Name:   string;
  Value?: string | number;
}

export interface StkCallback {
  MerchantRequestID:   string;
  CheckoutRequestID:   string;
  ResultCode:          number;
  ResultDesc:          string;
  CallbackMetadata?:   { Item: StkCallbackItem[] };
}

// ── STK Push ──────────────────────────────────────────────────────────────────
export async function initiateStkPush(opts: {
  phone:       string;  // normalised 2547xxxxxxxx
  amount:      number;  // KES whole number
  accountRef:  string;  // max 12 chars — shown on M-Pesa statement
  description: string;  // max 13 chars
}): Promise<StkPushResult> {
  const shortcode   = process.env.MPESA_SHORTCODE!;
  const callbackUrl = process.env.MPESA_CALLBACK_URL!;
  if (!shortcode || !callbackUrl) throw new Error("MPESA_SHORTCODE / MPESA_CALLBACK_URL not set");

  const token     = await getAccessToken();
  const timestamp = getTimestamp();
  const password  = getPassword(timestamp);

  const body = {
    BusinessShortCode: shortcode,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   "CustomerPayBillOnline",
    Amount:            Math.round(opts.amount),
    PartyA:            opts.phone,
    PartyB:            shortcode,
    PhoneNumber:       opts.phone,
    CallBackURL:       callbackUrl,
    AccountReference:  opts.accountRef.slice(0, 12),
    TransactionDesc:   opts.description.slice(0, 13),
  };

  const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (json.ResponseCode !== "0") {
    throw new Error(json.errorMessage ?? json.ResponseDescription ?? `STK Push error code ${json.ResponseCode}`);
  }
  return json as StkPushResult;
}

/** Pull a named value out of Safaricom callback metadata */
export function getCallbackMeta(items: StkCallbackItem[], name: string): string | number | undefined {
  return items.find((i) => i.Name === name)?.Value;
}
