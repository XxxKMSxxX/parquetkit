"use client";

import { useCallback, useState } from "react";
import { getPolarConfig } from "@/lib/pro/config";
import { storeEntitlement } from "@/lib/pro/entitlement";
import { validateLicenseKey } from "@/lib/pro/polar";

interface ProUnlockProps {
  onUnlocked: () => void;
}

/** Buy/unlock widget for the paid diff report. Hidden entirely when Polar isn't configured. */
export function ProUnlock({ onUnlocked }: ProUnlockProps) {
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = getPolarConfig();

  const unlock = useCallback(async () => {
    if (!config) return;
    setChecking(true);
    setError(null);
    const result = await validateLicenseKey(config, key);
    setChecking(false);
    if (result.valid) {
      storeEntitlement(key.trim());
      onUnlocked();
    } else {
      setError(result.error ?? "Invalid license key.");
    }
  }, [config, key, onUnlocked]);

  if (!config) return null;

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800"
      data-testid="pro-unlock"
    >
      <p className="font-semibold">Get the full report — $15, one-time</p>
      <p className="text-xs text-neutral-500">
        Includes every added/removed/changed row. The free report only includes the summary and
        schema diff.
      </p>
      <a
        href={config.checkoutUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="pro-checkout-link"
        className="w-fit rounded-md bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-sky-500"
      >
        Buy full report unlock →
      </a>
      <label htmlFor="pro-license-key" className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
        Already purchased? Paste your license key:
      </label>
      <div className="flex gap-2">
        <input
          id="pro-license-key"
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          data-testid="pro-license-input"
          className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="button"
          onClick={unlock}
          disabled={checking || !key.trim()}
          data-testid="pro-unlock-button"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-sky-500 disabled:opacity-50 dark:border-neutral-700"
        >
          {checking ? "Checking…" : "Unlock"}
        </button>
      </div>
      {error ? (
        <p role="alert" data-testid="pro-unlock-error" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-neutral-400">
        Only the key is sent to Polar.sh to verify your purchase — no file name or file content
        ever leaves your browser.
      </p>
    </div>
  );
}
