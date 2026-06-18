"use client";

import { useSyncExternalStore } from "react";

export type AnalyticsConsentChoice = "accepted" | "rejected" | null;

export const ANALYTICS_CONSENT_STORAGE_KEY =
  "text2task:analytics_consent";
export const ANALYTICS_CONSENT_COOKIE = "t2t_analytics_consent";

const CONSENT_CHANGE_EVENT = "text2task:analytics-consent-change";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

let memoryChoice: AnalyticsConsentChoice = null;

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function normalizeConsentChoice(value: unknown): AnalyticsConsentChoice {
  return value === "accepted" || value === "rejected" ? value : null;
}

function getCookie(name: string) {
  if (!isBrowser()) {
    return null;
  }

  try {
    const prefix = `${name}=`;
    const cookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));

    if (!cookie) {
      return null;
    }

    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string) {
  if (!isBrowser()) {
    return;
  }

  try {
    const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";

    document.cookie = `${name}=${encodeURIComponent(
      value
    )}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secureFlag}`;
  } catch {
    // Consent persistence is best-effort and must never affect the app.
  }
}

export function readAnalyticsConsentChoice(): AnalyticsConsentChoice {
  if (!isBrowser()) {
    return null;
  }

  try {
    const stored = normalizeConsentChoice(
      window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)
    );

    if (stored) {
      memoryChoice = stored;
      return stored;
    }
  } catch {
    // Fall back to cookie or in-memory choice.
  }

  const cookieChoice = normalizeConsentChoice(
    getCookie(ANALYTICS_CONSENT_COOKIE)
  );

  if (cookieChoice) {
    memoryChoice = cookieChoice;
    return cookieChoice;
  }

  return memoryChoice;
}

export function hasAcceptedAnalyticsConsent() {
  return readPersistedAnalyticsConsentChoice() === "accepted";
}

export function readPersistedAnalyticsConsentChoice(): AnalyticsConsentChoice {
  if (!isBrowser()) {
    return null;
  }

  try {
    const stored = normalizeConsentChoice(
      window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)
    );

    if (stored) {
      return stored;
    }
  } catch {
    // If consent storage cannot be read, default to no analytics collection.
  }

  return normalizeConsentChoice(getCookie(ANALYTICS_CONSENT_COOKIE));
}

export function writeAnalyticsConsentChoice(
  choice: Exclude<AnalyticsConsentChoice, null>
) {
  memoryChoice = choice;

  if (isBrowser()) {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, choice);
    } catch {
      // Cookie and memory fallback still allow the UI to continue safely.
    }

    setCookie(ANALYTICS_CONSENT_COOKIE, choice);

    try {
      window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
    } catch {
      // No user-facing error for consent notification failures.
    }
  }
}

function subscribe(callback: () => void) {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === ANALYTICS_CONSENT_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener(CONSENT_CHANGE_EVENT, callback);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useAnalyticsConsentChoice() {
  return useSyncExternalStore(
    subscribe,
    readAnalyticsConsentChoice,
    () => null
  );
}

export function useAnalyticsConsentAccepted() {
  const consentChoice = useAnalyticsConsentChoice();

  return (
    consentChoice === "accepted" &&
    readPersistedAnalyticsConsentChoice() === "accepted"
  );
}
