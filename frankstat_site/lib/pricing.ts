/**
 * lib/pricing.ts
 * Single source of truth for all service pricing.
 * Used by the API (server-side — never trust client amounts).
 */

export const VALID_SERVICE_IDS = [
  "banners","posters","signage","sublimation",
  "plotting","business-cards","heat-press","dtf",
] as const;
export type ServiceId = (typeof VALID_SERVICE_IDS)[number];

export const SERVICE_NAMES: Record<ServiceId, string> = {
  "banners":        "Banners",
  "posters":        "Posters",
  "signage":        "2D | 3D Signage",
  "sublimation":    "Sublimation",
  "plotting":       "Plotting & Vinyl Cutting",
  "business-cards": "Business Cards",
  "heat-press":     "Heat Press",
  "dtf":            "DTF No-Cut",
};

export const BANNER_PRICES: Record<string, number> = {
  "1ft × 1ft": 300, "2ft × 1ft": 500, "3ft × 2ft": 900,
  "4ft × 2ft": 1400, "5ft × 3ft": 2200, "6ft × 3ft": 2800,
  "8ft × 4ft": 4500, "10ft × 5ft": 7000,
};

export const POSTER_PRICES: Record<string, number> = {
  "A4 (21×29.7cm)": 150, "A3 (29.7×42cm)": 250, "A2 (42×59.4cm)": 450,
  "A1 (59.4×84.1cm)": 800, "A0 (84.1×118.9cm)": 1400,
  "18×24 in": 600, "24×36 in": 1100,
};

export const QUANTITY_UNIT_PRICE: Record<string, { price: number; unit: string }> = {
  "signage":        { price: 1500, unit: "piece" },
  "sublimation":    { price:  2, unit: "piece" },
  "plotting":       { price:  200, unit: "sq ft" },
  "business-cards": { price:  800, unit: "100 cards" },
  "heat-press":     { price:  300, unit: "piece" },
  "dtf":            { price:  250, unit: "piece" },
};

export type PriceResult =
  | { ok: true;  totalPrice: number; unitPrice: number }
  | { ok: false; error: string };

export function calculatePrice(
  serviceId: string,
  dimension: string | null | undefined,
  quantity: number
): PriceResult {
  if (!VALID_SERVICE_IDS.includes(serviceId as ServiceId))
    return { ok: false, error: `Unknown service: ${serviceId}` };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000)
    return { ok: false, error: "Quantity must be a whole number between 1 and 10,000." };

  let unitPrice = 0;
  if (serviceId === "banners") {
    if (!dimension) return { ok: false, error: "Please select a banner size." };
    if (dimension === "Custom") return { ok: false, error: "Custom sizes require a manual quote. Contact us directly." };
    unitPrice = BANNER_PRICES[dimension] ?? 0;
    if (!unitPrice) return { ok: false, error: `Unknown banner size: ${dimension}` };
  } else if (serviceId === "posters") {
    if (!dimension) return { ok: false, error: "Please select a poster size." };
    if (dimension === "Custom") return { ok: false, error: "Custom sizes require a manual quote. Contact us directly." };
    unitPrice = POSTER_PRICES[dimension] ?? 0;
    if (!unitPrice) return { ok: false, error: `Unknown poster size: ${dimension}` };
  } else {
    unitPrice = QUANTITY_UNIT_PRICE[serviceId]?.price ?? 0;
    if (!unitPrice) return { ok: false, error: `No pricing for service: ${serviceId}` };
  }
  return { ok: true, totalPrice: unitPrice * quantity, unitPrice };
}

/**
 * Split total into what's charged now vs balance.
 * payFull=true  → charge full amount upfront, balanceDue=0
 * payFull=false → charge 50% deposit, rest due on collection
 */
export function splitPayment(totalPrice: number, payFull: boolean) {
  if (payFull) {
    return { depositAmount: totalPrice, balanceDue: 0, chargeAmount: totalPrice, paymentType: "FULL" as const };
  }
  const depositAmount = Math.ceil(totalPrice / 2);
  return { depositAmount, balanceDue: totalPrice - depositAmount, chargeAmount: depositAmount, paymentType: "DEPOSIT" as const };
}
