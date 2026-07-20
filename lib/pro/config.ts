export interface PolarConfig {
  organizationId: string;
  checkoutUrl: string;
  apiBase: string;
}

const DEFAULT_API_BASE = "https://api.polar.sh";

/**
 * Reads Polar.sh config from env. Returns null when unset, which hides the
 * Pro unlock UI entirely (e.g. local/fork builds without a Polar account).
 *
 * Required: NEXT_PUBLIC_POLAR_ORG_ID, NEXT_PUBLIC_POLAR_CHECKOUT_URL.
 * Optional: NEXT_PUBLIC_POLAR_API_BASE (defaults to production; set to
 * https://sandbox-api.polar.sh while testing against a sandbox org).
 */
export function getPolarConfig(): PolarConfig | null {
  const organizationId = process.env.NEXT_PUBLIC_POLAR_ORG_ID;
  const checkoutUrl = process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL;
  if (!organizationId || !checkoutUrl) return null;
  return {
    organizationId,
    checkoutUrl,
    apiBase: process.env.NEXT_PUBLIC_POLAR_API_BASE ?? DEFAULT_API_BASE,
  };
}
