const STORAGE_KEY = "parquetkit:pro:license";

/** Store the validated license key locally. Never sent anywhere except back to Polar for re-validation. */
export function storeEntitlement(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Storage unavailable (private mode, quota, etc.) — Pro unlock just won't persist.
  }
}

export function clearEntitlement(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // No-op: nothing to clear if storage is unavailable.
  }
}

/** The stored license key, if any (does not re-validate against Polar). */
export function getStoredLicenseKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function isProUnlocked(): boolean {
  return getStoredLicenseKey() !== null;
}
