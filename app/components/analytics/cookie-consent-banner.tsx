"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  useAnalyticsConsentChoice,
  writeAnalyticsConsentChoice,
} from "@/lib/analytics/analytics-consent";

const HOMEPAGE_DEMO_REVIEW_PATH = "/homepage-demo/review";

export function CookieConsentBanner() {
  const pathname = usePathname();

  if (pathname === HOMEPAGE_DEMO_REVIEW_PATH) {
    return null;
  }

  return <CookieConsentBannerContent />;
}

function CookieConsentBannerContent() {
  const consentChoice = useAnalyticsConsentChoice();

  if (consentChoice) {
    return null;
  }

  return (
    <div className="t2t-cookie-banner" role="region" aria-label="Cookie notice">
      <style>{cookieBannerCss}</style>

      <div className="t2t-cookie-banner__copy">
        <strong>Analytics cookies</strong>
        <p>
          Text2Task uses optional analytics to understand traffic and improve the
          product. We do not use analytics to store raw client messages,
          screenshots, task text, project content, files, notes, or private
          client data.
        </p>
        <Link href="/privacy">Privacy Policy</Link>
      </div>

      <div className="t2t-cookie-banner__actions">
        <button
          type="button"
          className="t2t-cookie-banner__button t2t-cookie-banner__button--secondary"
          onClick={() => writeAnalyticsConsentChoice("rejected")}
        >
          Reject non-essential analytics
        </button>
        <button
          type="button"
          className="t2t-cookie-banner__button t2t-cookie-banner__button--primary"
          onClick={() => writeAnalyticsConsentChoice("accepted")}
        >
          Accept analytics
        </button>
      </div>
    </div>
  );
}

const cookieBannerCss = `
  .t2t-cookie-banner {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: 16px;
    z-index: 80;
    margin: 0 auto;
    width: min(960px, calc(100% - 32px));
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    padding: 16px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 22px 60px rgba(15, 23, 42, 0.16);
    color: #0f172a;
  }

  .t2t-cookie-banner__copy {
    display: grid;
    gap: 6px;
  }

  .t2t-cookie-banner__copy strong {
    font-size: 14px;
    line-height: 1.25;
    font-weight: 850;
  }

  .t2t-cookie-banner__copy p {
    margin: 0;
    color: #475569;
    font-size: 13px;
    line-height: 1.55;
  }

  .t2t-cookie-banner__copy a {
    width: fit-content;
    color: #2563eb;
    font-size: 13px;
    font-weight: 800;
    text-decoration: none;
  }

  .t2t-cookie-banner__actions {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .t2t-cookie-banner__button {
    min-height: 40px;
    border-radius: 8px;
    padding: 0 13px;
    font-size: 13px;
    line-height: 1.2;
    font-weight: 850;
    cursor: pointer;
    white-space: nowrap;
  }

  .t2t-cookie-banner__button--secondary {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #334155;
  }

  .t2t-cookie-banner__button--primary {
    border: 1px solid #0f172a;
    background: #0f172a;
    color: #ffffff;
  }

  @media (max-width: 720px) {
    .t2t-cookie-banner {
      left: 10px;
      right: 10px;
      bottom: 10px;
      width: calc(100% - 20px);
      grid-template-columns: 1fr;
      align-items: stretch;
      padding: 14px;
    }

    .t2t-cookie-banner__actions {
      justify-content: stretch;
    }

    .t2t-cookie-banner__button {
      width: 100%;
      white-space: normal;
    }
  }
`;
