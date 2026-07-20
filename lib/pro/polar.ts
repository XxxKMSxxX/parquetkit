import type { PolarConfig } from "./config";

export interface LicenseValidation {
  valid: boolean;
  error?: string;
}

interface ValidatedLicenseKey {
  status: "granted" | "revoked" | "disabled";
}

/**
 * Validate a license key against Polar's public customer-portal endpoint.
 * No access token required — safe to call directly from the browser
 * (https://polar.sh/docs/api-reference/customer-portal/license-keys/validate).
 * Only the key string is sent; no file name or file content ever leaves the browser.
 */
export async function validateLicenseKey(
  config: PolarConfig,
  key: string,
): Promise<LicenseValidation> {
  const trimmed = key.trim();
  if (!trimmed) return { valid: false, error: "Enter a license key." };

  let response: Response;
  try {
    response = await fetch(`${config.apiBase}/v1/customer-portal/license-keys/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: trimmed, organization_id: config.organizationId }),
    });
  } catch {
    return { valid: false, error: "Could not reach the license server. Check your connection." };
  }

  if (response.status === 404) return { valid: false, error: "License key not found." };
  if (!response.ok) return { valid: false, error: `Validation failed (HTTP ${response.status}).` };

  const data = (await response.json()) as ValidatedLicenseKey;
  if (data.status === "granted") return { valid: true };
  return { valid: false, error: `This license key is ${data.status}.` };
}
