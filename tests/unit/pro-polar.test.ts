import { afterEach, describe, expect, it, vi } from "vitest";
import { validateLicenseKey } from "@/lib/pro/polar";
import type { PolarConfig } from "@/lib/pro/config";

const CONFIG: PolarConfig = {
  organizationId: "org_123",
  checkoutUrl: "https://buy.polar.sh/xyz",
  apiBase: "https://api.polar.sh",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}), ...response }),
  );
}

describe("validateLicenseKey", () => {
  it("rejects an empty key without calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await validateLicenseKey(CONFIG, "   ");
    expect(result).toEqual({ valid: false, error: "Enter a license key." });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the trimmed key and organization id, no other data", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "granted" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    await validateLicenseKey(CONFIG, "  KEY-123  ");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.polar.sh/v1/customer-portal/license-keys/validate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ key: "KEY-123", organization_id: "org_123" }),
      }),
    );
  });

  it("is valid when the key status is granted", async () => {
    mockFetch({ status: 200, json: async () => ({ status: "granted" }) });
    expect(await validateLicenseKey(CONFIG, "KEY-123")).toEqual({ valid: true });
  });

  it("is invalid when the key is revoked or disabled", async () => {
    mockFetch({ status: 200, json: async () => ({ status: "revoked" }) });
    expect(await validateLicenseKey(CONFIG, "KEY-123")).toEqual({
      valid: false,
      error: "This license key is revoked.",
    });
  });

  it("reports 'not found' on HTTP 404", async () => {
    mockFetch({ ok: false, status: 404 });
    expect(await validateLicenseKey(CONFIG, "KEY-123")).toEqual({
      valid: false,
      error: "License key not found.",
    });
  });

  it("reports a generic failure on other non-OK statuses", async () => {
    mockFetch({ ok: false, status: 500 });
    expect(await validateLicenseKey(CONFIG, "KEY-123")).toEqual({
      valid: false,
      error: "Validation failed (HTTP 500).",
    });
  });

  it("reports a network error without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    expect(await validateLicenseKey(CONFIG, "KEY-123")).toEqual({
      valid: false,
      error: "Could not reach the license server. Check your connection.",
    });
  });
});
