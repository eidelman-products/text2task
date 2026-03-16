"use client";

import { useEffect, useMemo, useState } from "react";
import ScanBanner from "./dashboard/scan-banner";
import DashboardSidebar from "./dashboard/dashboard-sidebar";
import EmptyStateCard from "./dashboard/empty-state-card";
import NoScanState from "./dashboard/no-scan-state";
import PrivacyTrust from "./dashboard/privacy-trust";
import SmartViewPage from "./dashboard/smart-view-page";
import DashboardOverview from "./dashboard/dashboard-overview";
import ScanResultsView from "./dashboard/scan-results-view";
import TopSendersView from "./dashboard/top-senders-view";
import PromotionsView from "./dashboard/promotions-view";
import DashboardHeader from "./dashboard/dashboard-header";
import {
  FREE_WEEKLY_LIMIT,
  calculateHealthScore,
  getHealthTone,
  getSenderBucketLabel,
  getToneStyles,
} from "./dashboard/dashboard-utils";
import type {
  ActiveNav,
  ScanResult,
  SenderBucket,
  SmartViewIds,
  SmartViews,
  TopSender,
} from "./dashboard/dashboard-types";

type DashboardClientProps = {
  email: string;
};

export default function DashboardClient({ email }: DashboardClientProps) {
  const [plan] = useState<"free" | "pro">("free");
  const [activeNav, setActiveNav] = useState<ActiveNav>("dashboard");

  const [loadingScan, setLoadingScan] = useState(false);
  const [deletingSender, setDeletingSender] = useState<string | null>(null);
  const [archivingSender, setArchivingSender] = useState<string | null>(null);
  const [cleaningPromotions, setCleaningPromotions] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [cleaningPromotionsStep, setCleaningPromotionsStep] = useState<
    "idle" | "checking" | "cleaning" | "refreshing"
  >("idle");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [weeklyCleanupUsed, setWeeklyCleanupUsed] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  async function loadQuotaStatus() {
    try {
      const res = await fetch("/api/quota/status", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) return;

      if (typeof data.weekly_cleanup_used === "number") {
        setWeeklyCleanupUsed(data.weekly_cleanup_used);
      }
    } catch (err) {
      console.error("Failed to load quota status", err);
    }
  }

  const remainingWeeklyCleanup = Math.max(
    0,
    FREE_WEEKLY_LIMIT - weeklyCleanupUsed
  );

  useEffect(() => {
    loadQuotaStatus();
  }, []);

  const healthTone = getHealthTone(scanResult?.healthScore ?? 0);
  const toneStyles = getToneStyles(healthTone);

  const promotionRows = useMemo(() => {
    if (!scanResult) return [];
    return [...scanResult.promotionsSenders].sort((a, b) => b.count - a.count);
  }, [scanResult]);

  const groupedTopSenders = useMemo(() => {
    const buckets: Record<SenderBucket, TopSender[]> = {
      "1000+ messages": [],
      "500–999 messages": [],
      "100–499 messages": [],
      "10–99 messages": [],
    };

    if (!scanResult) return buckets;

    const sorted = [...scanResult.topSenders].sort((a, b) => b.count - a.count);

    for (const item of sorted) {
      const label = getSenderBucketLabel(item.count);
      if (!label) continue;
      buckets[label].push(item);
    }

    return buckets;
  }, [scanResult]);

  function getSmartViewRows(view: keyof SmartViewIds): TopSender[] {
    if (!scanResult) return [];

    const ids = new Set(scanResult.smartViewIds[view] || []);
    if (!ids.size) return [];

    const rows: TopSender[] = [];

    for (const sender of scanResult.topSenders) {
      const senderIds = Array.isArray(sender.ids) ? sender.ids : [];
      const matchedIds = senderIds.filter((id) => ids.has(id));

      if (!matchedIds.length) continue;

      rows.push({
        sender: sender.sender,
        count: matchedIds.length,
        ids: matchedIds,
        unsubscribeAvailable: sender.unsubscribeAvailable,
      });
    }

    return rows.sort((a, b) => b.count - a.count);
  }

  async function handleDisconnectGmail() {
    const confirmed = window.confirm(
      "Disconnect Gmail and sign out?\n\nYou will need to reconnect Gmail to run scans again."
    );

    if (!confirmed) return;

    try {
      setIsDisconnecting(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/disconnect", {
        method: "POST",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Failed to disconnect Gmail");
        return;
      }

      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Failed to disconnect Gmail");
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function runSampleScan(options?: { preserveActiveNav?: boolean }) {
    try {
      setLoadingScan(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/gmail/scan", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Sample Scan failed");
        return;
      }

      const topSenders: TopSender[] = Array.isArray(data.topSenders)
        ? data.topSenders.map((item: any) => ({
            sender: String(item.sender || "Unknown Sender"),
            count: Number(item.count || 0),
            ids: Array.isArray(item.ids) ? item.ids : [],
            unsubscribeAvailable: Boolean(item.unsubscribeAvailable),
          }))
        : [];

      const promotionsSenders: TopSender[] = Array.isArray(data.promotionsSenders)
        ? data.promotionsSenders.map((item: any) => ({
            sender: String(item.sender || "Unknown Sender"),
            count: Number(item.count || 0),
            ids: Array.isArray(item.ids) ? item.ids : [],
            unsubscribeAvailable: Boolean(item.unsubscribeAvailable),
          }))
        : [];

      const scanned = Number(data.scanned || 0);
      const senderGroups = topSenders.length;
      const largestSenderCount = topSenders.length
        ? Math.max(...topSenders.map((s) => s.count))
        : 0;

      const promotionsFoundInSampleScan = promotionsSenders.reduce(
        (sum: number, row: TopSender) => sum + row.count,
        0
      );

      const fullInboxPromotionsCount =
        typeof data.fullInboxPromotionsCount === "number"
          ? data.fullInboxPromotionsCount
          : null;

      const smartViewIds: SmartViewIds = {
        unread: Array.isArray(data.smartViewIds?.unread)
          ? data.smartViewIds.unread
          : [],
        social: Array.isArray(data.smartViewIds?.social)
          ? data.smartViewIds.social
          : [],
        jobSearch: Array.isArray(data.smartViewIds?.jobSearch)
          ? data.smartViewIds.jobSearch
          : [],
        shopping: Array.isArray(data.smartViewIds?.shopping)
          ? data.smartViewIds.shopping
          : [],
      };

      const smartViews: SmartViews = {
        unread:
          typeof data.smartViews?.unread === "number"
            ? data.smartViews.unread
            : smartViewIds.unread.length,
        social:
          typeof data.smartViews?.social === "number"
            ? data.smartViews.social
            : smartViewIds.social.length,
        jobSearch:
          typeof data.smartViews?.jobSearch === "number"
            ? data.smartViews.jobSearch
            : smartViewIds.jobSearch.length,
        shopping:
          typeof data.smartViews?.shopping === "number"
            ? data.smartViews.shopping
            : smartViewIds.shopping.length,
      };

      const healthScore = calculateHealthScore(
        scanned,
        senderGroups,
        promotionsFoundInSampleScan
      );

      setScanResult({
        scanned,
        topSenders,
        promotionsSenders,
        promotionsFound: promotionsFoundInSampleScan,
        promotionsFoundInSampleScan,
        fullInboxPromotionsCount,
        senderGroups,
        largestSenderCount,
        healthScore,
        smartViews,
        smartViewIds,
      });

      setSuccess(`Sample Scan completed. Analyzed ${scanned} emails.`);

      if (!options?.preserveActiveNav) {
        setActiveNav("dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Sample Scan failed");
    } finally {
      setLoadingScan(false);
    }
  }

  async function handleCleanPromotionsBulk() {
    if (!scanResult) {
      setError("Run Sample Scan first.");
      return;
    }

    if (remainingWeeklyCleanup <= 0) {
      setError(
        "Free plan weekly cleanup limit reached. Upgrade to Pro for unlimited cleanup."
      );
      return;
    }

    const promotionIds = promotionRows
      .flatMap((item) => item.ids || [])
      .slice(0, remainingWeeklyCleanup);

    if (!promotionIds.length) {
      setError("No promotion email ids available to clean.");
      return;
    }

    const confirmed = window.confirm(
      `Move up to ${promotionIds.length} Promotions emails to Trash?`
    );

    if (!confirmed) return;

    try {
      setCleaningPromotions(true);
      setCleaningPromotionsStep("checking");
      setError("");
      setSuccess("");

      await new Promise((resolve) => setTimeout(resolve, 250));

      setCleaningPromotionsStep("cleaning");

      const res = await fetch("/api/cleanup/promotions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: promotionIds }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to clean Promotions");
        return;
      }

      const cleaned = Number(data.cleaned || 0);
      const updatedUsed =
        typeof data.weekly_cleanup_used === "number"
          ? data.weekly_cleanup_used
          : Math.min(FREE_WEEKLY_LIMIT, weeklyCleanupUsed + cleaned);

      setWeeklyCleanupUsed(updatedUsed);
      setSuccess(data.message || `Moved ${cleaned} Promotions emails to Trash.`);

      setCleaningPromotionsStep("refreshing");
      await runSampleScan({ preserveActiveNav: true });
      setActiveNav("promotions");
    } catch (err: any) {
      setError(err.message || "Failed to clean Promotions");
    } finally {
      setCleaningPromotions(false);
      setCleaningPromotionsStep("idle");
    }
  }

  async function handleDeleteBySender(item: TopSender) {
    if (plan === "free" && item.count > remainingWeeklyCleanup) {
      setError(
        `Free plan can clean up to ${remainingWeeklyCleanup} more emails this week. Upgrade to Pro for larger cleanup.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Move ${item.count} emails from ${item.sender} to Trash?`
    );
    if (!confirmed) return;

    try {
      setDeletingSender(item.sender);
      setError("");
      setSuccess("");

      const res = await fetch("/api/delete-by-sender", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: item.sender,
          ids: item.ids || [],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to move emails to Trash");
        return;
      }

      const deleted = Number(data.deleted || item.count);
      const updatedUsed =
        typeof data.weekly_cleanup_used === "number"
          ? data.weekly_cleanup_used
          : Math.min(FREE_WEEKLY_LIMIT, weeklyCleanupUsed + deleted);

      setWeeklyCleanupUsed(updatedUsed);
      setSuccess(`Moved ${deleted} emails from ${item.sender} to Trash.`);

      await runSampleScan({ preserveActiveNav: true });
    } catch (err: any) {
      setError(err.message || "Failed to move emails to Trash");
    } finally {
      setDeletingSender(null);
    }
  }

  async function handleArchiveBySender(item: TopSender) {
    if (plan === "free" && item.count > remainingWeeklyCleanup) {
      setError(
        `Free plan can clean up to ${remainingWeeklyCleanup} more emails this week. Upgrade to Pro for larger cleanup.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Archive ${item.count} emails from ${item.sender}?`
    );
    if (!confirmed) return;

    try {
      setArchivingSender(item.sender);
      setError("");
      setSuccess("");

      const res = await fetch("/api/archive-by-sender", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: item.sender,
          ids: item.ids || [],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to archive emails");
        return;
      }

      const archived = Number(data.archived || item.count);
      const updatedUsed =
        typeof data.weekly_cleanup_used === "number"
          ? data.weekly_cleanup_used
          : Math.min(FREE_WEEKLY_LIMIT, weeklyCleanupUsed + archived);

      setWeeklyCleanupUsed(updatedUsed);
      setSuccess(`Archived ${archived} emails from ${item.sender}.`);

      await runSampleScan({ preserveActiveNav: true });
    } catch (err: any) {
      setError(err.message || "Failed to archive emails");
    } finally {
      setArchivingSender(null);
    }
  }

  function renderNoScanState() {
    return (
      <NoScanState
        loadingScan={loadingScan}
        onRunSampleScan={() => runSampleScan()}
      />
    );
  }

  function renderDashboard() {
    if (!scanResult) return renderNoScanState();

    return (
      <DashboardOverview
        scanResult={scanResult}
        email={email}
        loadingScan={loadingScan}
        toneStyles={toneStyles}
        onRunSampleScan={() => runSampleScan()}
      />
    );
  }

  function renderEmptyStateCard(title: string, description: string) {
    return (
      <EmptyStateCard
        title={title}
        description={description}
        loadingScan={loadingScan}
        onRunSampleScan={() => runSampleScan()}
      />
    );
  }

  function renderScanResults() {
    if (!scanResult) {
      return renderEmptyStateCard(
        "Scan Results",
        "Review what the latest scan found. No scan has been run yet."
      );
    }

    return (
      <ScanResultsView
        scanned={scanResult.scanned}
        senderGroups={scanResult.senderGroups}
        promotionsFoundInSampleScan={scanResult.promotionsFoundInSampleScan}
        fullInboxPromotionsCount={scanResult.fullInboxPromotionsCount}
      />
    );
  }

  function renderTopSenders() {
    if (!scanResult) {
      return renderEmptyStateCard(
        "Top Senders",
        "Review sender groups by size after running a Sample Scan."
      );
    }

    return (
      <TopSendersView
        groupedTopSenders={groupedTopSenders}
        weeklyCleanupUsed={weeklyCleanupUsed}
        freeWeeklyLimit={FREE_WEEKLY_LIMIT}
        remainingWeeklyCleanup={remainingWeeklyCleanup}
        deletingSender={deletingSender}
        archivingSender={archivingSender}
        plan={plan}
        onDelete={handleDeleteBySender}
        onArchive={handleArchiveBySender}
      />
    );
  }

  function renderPromotions() {
    if (!scanResult) {
      return renderEmptyStateCard(
        "Promotions",
        "Detected promotional emails will appear here after the first scan."
      );
    }

    return (
      <PromotionsView
        promotionsFoundInSampleScan={scanResult.promotionsFoundInSampleScan}
        fullInboxPromotionsCount={scanResult.fullInboxPromotionsCount}
        remainingWeeklyCleanup={remainingWeeklyCleanup}
        cleaningPromotions={cleaningPromotions}
        cleaningPromotionsStep={cleaningPromotionsStep}
        promotionRows={promotionRows}
        deletingSender={deletingSender}
        archivingSender={archivingSender}
        plan={plan}
        onDelete={handleDeleteBySender}
        onArchive={handleArchiveBySender}
        onCleanPromotionsBulk={handleCleanPromotionsBulk}
      />
    );
  }

  function renderSmartViewPage(
    title: string,
    count: number,
    viewKey: keyof SmartViewIds,
    description: string
  ) {
    if (!scanResult) {
      return renderEmptyStateCard(
        title,
        `${title} will be available after the first scan.`
      );
    }

    const rows = getSmartViewRows(viewKey);

    return (
      <SmartViewPage
        title={title}
        count={count}
        viewKey={viewKey}
        description={description}
        rows={rows}
        deletingSender={deletingSender}
        archivingSender={archivingSender}
        remainingWeeklyCleanup={remainingWeeklyCleanup}
        plan={plan}
        onDelete={handleDeleteBySender}
        onArchive={handleArchiveBySender}
      />
    );
  }

  function renderPrivacyTrust() {
    return <PrivacyTrust />;
  }

  function renderContent() {
    switch (activeNav) {
      case "scan-results":
        return renderScanResults();
      case "top-senders":
        return renderTopSenders();
      case "promotions":
        return renderPromotions();
      case "unread":
        return renderSmartViewPage(
          "Unread",
          scanResult?.smartViews.unread || 0,
          "unread",
          "Unread emails found in your current inbox and matched inside the latest sample scan."
        );
      case "social-notifications":
        return renderSmartViewPage(
          "Social Notifications",
          scanResult?.smartViews.social || 0,
          "social",
          "Social-related emails copied directly from Gmail Social classification."
        );
      case "job-search":
        return renderSmartViewPage(
          "Job Search",
          scanResult?.smartViews.jobSearch || 0,
          "jobSearch",
          "Job-related emails matched inside your latest sample scan."
        );
      case "online-shopping":
        return renderSmartViewPage(
          "Online Shopping",
          scanResult?.smartViews.shopping || 0,
          "shopping",
          "Shopping-related emails matched inside your latest sample scan."
        );
      case "privacy-trust":
        return renderPrivacyTrust();
      case "dashboard":
      default:
        return renderDashboard();
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        alignItems: "stretch",
        minHeight: "100vh",
        background: "#f5f7fb",
      }}
    >
      <DashboardSidebar
        email={email}
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        setError={setError}
        setSuccess={setSuccess}
        weeklyCleanupUsed={weeklyCleanupUsed}
        remainingWeeklyCleanup={remainingWeeklyCleanup}
        freeWeeklyLimit={FREE_WEEKLY_LIMIT}
        scanResult={scanResult}
      />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "26px",
        }}
      >
        <DashboardHeader
          onDisconnect={handleDisconnectGmail}
          isDisconnecting={isDisconnecting}
        />

        <ScanBanner error={error} success={success} />

        {renderContent()}
      </div>
    </div>
  );
}