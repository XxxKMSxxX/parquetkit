import { afterEach, describe, expect, it, vi } from "vitest";
import { getPolarConfig } from "@/lib/pro/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPolarConfig", () => {
  it("returns null when the org id or checkout url is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_POLAR_ORG_ID", undefined);
    vi.stubEnv("NEXT_PUBLIC_POLAR_CHECKOUT_URL", undefined);
    expect(getPolarConfig()).toBeNull();
  });

  it("returns null when only one of the two is set", () => {
    vi.stubEnv("NEXT_PUBLIC_POLAR_ORG_ID", "org_123");
    vi.stubEnv("NEXT_PUBLIC_POLAR_CHECKOUT_URL", undefined);
    expect(getPolarConfig()).toBeNull();
  });

  it("defaults apiBase to the production Polar API", () => {
    vi.stubEnv("NEXT_PUBLIC_POLAR_ORG_ID", "org_123");
    vi.stubEnv("NEXT_PUBLIC_POLAR_CHECKOUT_URL", "https://buy.polar.sh/xyz");
    vi.stubEnv("NEXT_PUBLIC_POLAR_API_BASE", undefined);
    expect(getPolarConfig()).toEqual({
      organizationId: "org_123",
      checkoutUrl: "https://buy.polar.sh/xyz",
      apiBase: "https://api.polar.sh",
    });
  });

  it("honors an explicit apiBase override (e.g. sandbox)", () => {
    vi.stubEnv("NEXT_PUBLIC_POLAR_ORG_ID", "org_123");
    vi.stubEnv("NEXT_PUBLIC_POLAR_CHECKOUT_URL", "https://buy.polar.sh/xyz");
    vi.stubEnv("NEXT_PUBLIC_POLAR_API_BASE", "https://sandbox-api.polar.sh");
    expect(getPolarConfig()?.apiBase).toBe("https://sandbox-api.polar.sh");
  });
});
