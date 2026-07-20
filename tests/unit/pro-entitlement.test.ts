import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearEntitlement,
  getStoredLicenseKey,
  isProUnlocked,
  storeEntitlement,
} from "@/lib/pro/entitlement";

// The unit project runs in a plain node environment (no jsdom), which has no
// `localStorage` global — stub a minimal in-memory implementation.
function fakeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeLocalStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("entitlement", () => {
  it("is not unlocked before any key is stored", () => {
    expect(isProUnlocked()).toBe(false);
    expect(getStoredLicenseKey()).toBeNull();
  });

  it("unlocks after storing a key", () => {
    storeEntitlement("KEY-123");
    expect(isProUnlocked()).toBe(true);
    expect(getStoredLicenseKey()).toBe("KEY-123");
  });

  it("clears the stored key", () => {
    storeEntitlement("KEY-123");
    clearEntitlement();
    expect(isProUnlocked()).toBe(false);
  });
});
