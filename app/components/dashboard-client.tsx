"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ScanBanner from "./dashboard/scan-banner";
import DashboardSidebar from "./dashboard/dashboard-sidebar";
import EmptyStateCard from "./dashboard/empty-state-card";
import PrivacyTrust from "./dashboard/privacy-trust";
import SmartViewPage from "./dashboard/smart-view-page";
import DashboardOverview from "./dashboard/dashboard-overview";
import TopSendersView from "./dashboard/top-senders-view";
import PromotionsView from "./dashboard/promotions-view";
import DashboardHeader from "./dashboard/dashboard-header";
import NoScanState from "./dashboard/no-scan-state";
import UpgradeModal from "./dashboard/upgrade-modal";
import { runUnsubscribeFlow } from "./dashboard/unsubscribe-actions";
import {
  FREE_WEEKLY_LIMIT,
  getHealthTone,
  getSenderBucketLabel,
  getToneStyles,
} from "./dashboard/dashboard-utils";
import type {
  ActiveNav,
  SenderBucket,
  SmartViewIds,
  SmartViews,
} from "./dashboard/dashboard-types";
import { getUserPlan } from "@/app/lib/billing/get-user-plan";
import { prepareBulkClean } from "@/app/lib/cleanup/bulk-clean";

type DashboardClientProps = {
  email: string;
  userId: string;
  initialPlan: "free" | "pro";
};

type DashboardTopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod?: "url" | "mailto" | null;
};

type DashboardScanResult = {
  mode?: "sample" | "full";
  scanned: number;
  totalInboxCount?: number | null;
  topSenders: DashboardTopSender[];
  promotionsSenders: DashboardTopSender[];
  promotionsFound: number;
  promotionsFoundInSampleScan: number;
  fullInboxPromotionsCount: number | null;
  senderGroups: number;
  largestSenderCount: number;
  healthScore: number;
  smartViews: SmartViews;
  smartViewIds: SmartViewIds;
  completed?: boolean;
};

type ActiveScanJob = {
  scanId: string;
  scanType: "sample" | "full";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  currentStep: string;
  processedMessages?: number;
  nextPageToken?: string | null;
  errorMessage?: string | null;
} | null;

type ScanStatusResponse = {
  scanId: string;
  scanType: "sample" | "full";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  currentStep: string;
  processedMessages?: number;
  nextPageToken?: string | null;
  errorMessage?: string | null;
};

type ScanResultsResponse = {
  exists: boolean;
  result: DashboardScanResult | null;
};

function getHealthScoreFromScanned(scanned: number): number {
  if (scanned <= 0) return 100;
  const raw = 100 - scanned / 20;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function removeIdsFromSenderRows(
  rows: DashboardTopSender[],
  idsToRemove: Set<string>
): DashboardTopSender[] {
  return rows
    .map((row) => {
      const originalIds = Array.isArray(row.ids) ? row.ids : [];
      const nextIds = originalIds.filter((id) => !idsToRemove.has(id));
      const nextCount =
        originalIds.length > 0 ? nextIds.length : Math.max(0, row.count);

      return {
        ...row,
        ids: nextIds,
        count: nextCount,
      };
    })
    .filter((row) => row.count > 0);
}

function removeIdsFromSmartViewIds(
  smartViewIds: SmartViewIds,
  idsToRemove: Set<string>
): SmartViewIds {
  return {
    unread: smartViewIds.unread.filter((id) => !idsToRemove.has(id)),
    social: smartViewIds.social.filter((id) => !idsToRemove.has(id)),
    jobSearch: smartViewIds.jobSearch.filter((id) => !idsToRemove.has(id)),
    shopping: smartViewIds.shopping.filter((id) => !idsToRemove.has(id)),
  };
}

function buildSmartViewsFromIds(smartViewIds: SmartViewIds): SmartViews {
  return {
    unread: smartViewIds.unread.length,
    social: smartViewIds.social.length,
    jobSearch: smartViewIds.jobSearch.length,
    shopping: smartViewIds.shopping.length,
  };
}

function applyIdsRemovalToScanResult(
  current: DashboardScanResult,
  idsToRemoveList: string[]
): DashboardScanResult {
  const idsToRemove = new Set(idsToRemoveList);

  const nextTopSenders = removeIdsFromSenderRows(current.topSenders, idsToRemove);
  const nextPromotionsSenders = removeIdsFromSenderRows(
    current.promotionsSenders,
    idsToRemove
  );

  const nextSmartViewIds = removeIdsFromSmartViewIds(
    current.smartViewIds,
    idsToRemove
  );
  const nextSmartViews = buildSmartViewsFromIds(nextSmartViewIds);

  const nextScanned = Math.max(0, current.scanned - idsToRemove.size);
  const nextSenderGroups = nextTopSenders.length;
  const nextLargestSenderCount =
    nextTopSenders.length > 0
      ? Math.max(...nextTopSenders.map((row) => row.count))
      : 0;

  return {
    ...current,
    scanned: nextScanned,
    topSenders: nextTopSenders,
    promotionsSenders: nextPromotionsSenders,
    promotionsFound: nextPromotionsSenders.reduce((sum, row) => sum + row.count, 0),
    promotionsFoundInSampleScan: nextPromotionsSenders.reduce(
      (sum, row) => sum + row.count,
      0
    ),
    senderGroups: nextSenderGroups,
    largestSenderCount: nextLargestSenderCount,
    healthScore: getHealthScoreFromScanned(nextScanned),
    smartViews: nextSmartViews,
    smartViewIds: nextSmartViewIds,
  };
}

export default function DashboardClient({
  email,
  userId,
  initialPlan,
}: DashboardClientProps) {
  const [plan, setPlan] = useState<"free" | "pro">(initialPlan);
  const [activeNav, setActiveNav] = useState<ActiveNav>("dashboard");

  const [loadingScan, setLoadingScan] = useState(false);
  const [deletingSender, setDeletingSender] = useState<string | null>(null);
  const [archivingSender, setArchivingSender] = useState<string | null>(null);
  const [readingSender, setReadingSender] = useState<string | null>(null);
  const [cleaningPromotions, setCleaningPromotions] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [cleaningPromotionsStep, setCleaningPromotionsStep] = useState<
    "idle" | "checking" | "cleaning" | "refreshing"
  >("idle");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [unsubscribedSenders, setUnsubscribedSenders] = useState<
    Record<string, boolean>
  >({});

  const [weeklyCleanupUsed, setWeeklyCleanupUsed] = useState(0);
  const [weeklyUnreadUsed, setWeeklyUnreadUsed] = useState(0);
  const [scanResult, setScanResult] = useState<DashboardScanResult | null>(null);
  const [activeScanJob, setActiveScanJob] = useState<ActiveScanJob>(null);

  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalTitle, setUpgradeModalTitle] = useState(
    "You’ve reached your weekly limit"
  );
  const [upgradeModalDescription, setUpgradeModalDescription] = useState(
    "Upgrade to Pro to continue cleaning your inbox without limits."
  );

  const pollingRef = useRef<number | null>(null);

  function openUpgradeModal(title: string, description: string) {
    setUpgradeModalTitle(title);
    setUpgradeModalDescription(description);
    setUpgradeModalOpen(true);
  }

  function closeUpgradeModal() {
    setUpgradeModalOpen(false);
  }

  function handleUpgradeClick() {
    setUpgradeModalOpen(false);

    const checkoutUrl =
      "https://inboxshaper.lemonsqueezy.com/checkout/buy/6a31c56c-eb35-492e-9268-087535a7f2f1";

    const returnTo = `${window.location.origin}/dashboard`;

    const url =
      `${checkoutUrl}` +
      `?checkout[custom][user_id]=${encodeURIComponent(userId)}` +
      `&checkout[success_url]=${encodeURIComponent(returnTo)}`;

    window.location.href = url;
  }

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

      if (typeof data.weekly_unread_used === "number") {
        setWeeklyUnreadUsed(data.weekly_unread_used);
      }
    } catch (err) {
      console.error("Failed to load quota status", err);
    }
  }

  const remainingWeeklyCleanup = Math.max(
    0,
    FREE_WEEKLY_LIMIT - weeklyCleanupUsed
  );

  const remainingWeeklyUnread = Math.max(
    0,
    FREE_WEEKLY_LIMIT - weeklyUnreadUsed
  );

  useEffect(() => {
    loadQuotaStatus();
  }, []);

  useEffect(() => {
    let mounted = true;
    let intervalId: number | null = null;

    async function refreshPlan() {
      try {
        const currentPlan = await getUserPlan(userId);
        if (!mounted) return;

        setPlan((prev) => {
          if (prev !== currentPlan) {
            if (currentPlan === "pro") {
              setSuccess("Your Pro plan is now active.");
            }
            return currentPlan;
          }
          return prev;
        });
      } catch (err) {
        console.error("Failed to load user plan", err);
      }
    }

    void refreshPlan();

    const handleVisibilityOrFocus = () => {
      void refreshPlan();
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    if (initialPlan === "free") {
      intervalId = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          void refreshPlan();
        }
      }, 5000);
    }

    return () => {
      mounted = false;
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);

      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [email, initialPlan]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
      }
    };
  }, []);

  const healthTone = getHealthTone(scanResult?.healthScore ?? 0);
  const toneStyles = getToneStyles(healthTone);

  const promotionRows = useMemo(() => {
    if (!scanResult) return [];
    return [...scanResult.promotionsSenders].sort((a, b) => b.count - a.count);
  }, [scanResult]);

  const groupedTopSenders = useMemo(() => {
    const buckets: Record<SenderBucket, DashboardTopSender[]> = {
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

  function stopPolling() {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  async function loadScanResults(scanId: string) {
    try {
      const res = await fetch(`/api/scans/${scanId}/results`, {
        method: "GET",
        cache: "no-store",
      });

      const data: ScanResultsResponse = await res.json();

      if (!res.ok) return;
      if (!data.exists || !data.result) return;

      setScanResult(data.result);
    } catch (err) {
      console.error("Failed to load scan results", err);
    }
  }

  async function loadScanStatus(scanId: string) {
    try {
      const res = await fetch(`/api/scans/${scanId}/status`, {
        method: "GET",
        cache: "no-store",
      });

      const data: ScanStatusResponse = await res.json();

      if (!res.ok) {
        if ("error" in (data as any)) {
          setError((data as any).error || "Failed to load scan status");
        }
        return;
      }

      setActiveScanJob({
        scanId: data.scanId,
        scanType: data.scanType,
        status: data.status,
        progress: data.progress ?? 0,
        currentStep: data.currentStep ?? "",
        processedMessages: data.processedMessages ?? 0,
        nextPageToken: data.nextPageToken ?? null,
        errorMessage: data.errorMessage ?? null,
      });

      await loadScanResults(scanId);

      if (data.status === "completed") {
        stopPolling();
        setSuccess(
          data.scanType === "sample"
            ? "Scan complete — your inbox snapshot is ready."
            : "Full scan complete — your entire inbox is now analyzed."
        );
      }

      if (data.status === "failed" || data.status === "cancelled") {
        stopPolling();
        setError(data.errorMessage || `Scan ${data.status}.`);
      }
    } catch (err) {
      console.error("Failed to load scan status", err);
    }
  }

  function startPolling(scanId: string) {
    stopPolling();

    void loadScanStatus(scanId);

    pollingRef.current = window.setInterval(() => {
      void loadScanStatus(scanId);
    }, 2500);
  }

  function getSmartViewRows(view: keyof SmartViewIds): DashboardTopSender[] {
    if (!scanResult) return [];

    const ids = new Set(scanResult.smartViewIds[view] || []);
    if (!ids.size) return [];

    const rows: DashboardTopSender[] = [];

    for (const sender of scanResult.topSenders) {
      const senderIds = Array.isArray(sender.ids) ? sender.ids : [];
      const matchedIds = senderIds.filter((id) => ids.has(id));

      if (!matchedIds.length) continue;

      rows.push({
        sender: sender.sender,
        count: matchedIds.length,
        ids: matchedIds,
        unsubscribeAvailable: sender.unsubscribeAvailable,
        unsubscribeTarget: sender.unsubscribeTarget,
        unsubscribeMethod: sender.unsubscribeMethod ?? null,
      });
    }

    return rows.sort((a, b) => b.count - a.count);
  }

  function applyLiveRemoval(idsToRemove: string[]) {
    if (!idsToRemove.length) return;

    setScanResult((current) => {
      if (!current) return current;
      return applyIdsRemovalToScanResult(current, idsToRemove);
    });
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
      stopPolling();

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

      const res = await fetch("/api/scans/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ scanType: "sample" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start scan");
        return;
      }

      const newScanId = String(data.scanId);

      setActiveScanJob({
        scanId: newScanId,
        scanType: data.scanType === "full" ? "full" : "sample",
        status:
          data.status === "running" ||
          data.status === "completed" ||
          data.status === "failed" ||
          data.status === "cancelled"
            ? data.status
            : "queued",
        progress: typeof data.progress === "number" ? data.progress : 0,
        currentStep:
          typeof data.currentStep === "string"
            ? data.currentStep
            : "Starting free scan...",
        processedMessages: 0,
        nextPageToken: null,
        errorMessage: null,
      });

      setSuccess("Free scan started.");

      if (!options?.preserveActiveNav) {
        setActiveNav("dashboard");
      }

      startPolling(newScanId);
    } catch (err: any) {
      setError(err.message || "Failed to start scan");
    } finally {
      setLoadingScan(false);
    }
  }

  async function runFullScan(options?: { preserveActiveNav?: boolean }) {
    if (plan === "free") {
      openUpgradeModal(
        "Unlock Full Scan with Pro",
        "Full inbox scan is available on Pro. Upgrade to scan your full Gmail inbox, unlock unlimited cleanup, and use bulk actions without weekly limits."
      );
      return;
    }

    try {
      setLoadingScan(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/scans/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ scanType: "full" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start full scan");
        return;
      }

      const newScanId = String(data.scanId);

      setActiveScanJob({
        scanId: newScanId,
        scanType: data.scanType === "full" ? "full" : "sample",
        status:
          data.status === "running" ||
          data.status === "completed" ||
          data.status === "failed" ||
          data.status === "cancelled"
            ? data.status
            : "queued",
        progress: typeof data.progress === "number" ? data.progress : 0,
        currentStep:
          typeof data.currentStep === "string"
            ? data.currentStep
            : "Starting full scan...",
        processedMessages: 0,
        nextPageToken: null,
        errorMessage: null,
      });

      setSuccess("Full scan started.");

      if (!options?.preserveActiveNav) {
        setActiveNav("dashboard");
      }

      startPolling(newScanId);
    } catch (err: any) {
      setError(err.message || "Failed to start full scan");
    } finally {
      setLoadingScan(false);
    }
  }

  async function handleCleanPromotionsBulk(selectedRows?: DashboardTopSender[]) {
    if (!scanResult) {
      setError("Run a scan first.");
      return;
    }

    const rowsToClean =
      selectedRows && selectedRows.length > 0 ? selectedRows : promotionRows;

    const totalSelectedEmails = rowsToClean.reduce((sum, row) => sum + row.count, 0);

    if (plan === "free" && totalSelectedEmails > remainingWeeklyCleanup) {
      openUpgradeModal(
        "You’ve reached your weekly cleanup limit",
        `Your Free plan can clean ${remainingWeeklyCleanup} more emails this week. Upgrade to Pro to clean all ${totalSelectedEmails} selected promotion emails at once.`
      );
      return;
    }

    let prepared;
    try {
      prepared = prepareBulkClean(rowsToClean, plan, remainingWeeklyCleanup);
    } catch (err: any) {
      openUpgradeModal(
        "Upgrade to continue bulk cleanup",
        err.message ||
          "Upgrade to Pro to continue bulk cleanup without weekly limits."
      );
      return;
    }

    const { ids: promotionIds } = prepared;

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
          : plan === "pro"
          ? weeklyCleanupUsed
          : Math.min(FREE_WEEKLY_LIMIT, weeklyCleanupUsed + cleaned);

      setWeeklyCleanupUsed(updatedUsed);
      applyLiveRemoval(promotionIds);
      setSuccess(
        data.message ||
          `Nice work — ${cleaned} promotion emails are now out of your inbox.`
      );

      setCleaningPromotionsStep("refreshing");
      setActiveNav("promotions");
    } catch (err: any) {
      setError(err.message || "Failed to clean Promotions");
    } finally {
      setCleaningPromotions(false);
      setCleaningPromotionsStep("idle");
    }
  }

  async function handleDeleteBySender(item: DashboardTopSender) {
    if (plan === "free" && item.count > remainingWeeklyCleanup) {
      openUpgradeModal(
        "You’ve reached your weekly cleanup limit",
        `Your Free plan can clean ${remainingWeeklyCleanup} more emails this week. Upgrade to Pro to move all ${item.count} emails from ${item.sender} to Trash now.`
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

      const idsToRemove = Array.isArray(item.ids) ? item.ids : [];

      const res = await fetch("/api/delete-by-sender", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: item.sender,
          ids: idsToRemove,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to move emails to Trash");
        return;
      }

      const movedToTrash = Number(
        data.movedToTrash ?? data.deleted ?? idsToRemove.length ?? item.count
      );
      const updatedUsed =
        typeof data.weekly_cleanup_used === "number"
          ? data.weekly_cleanup_used
          : Math.min(FREE_WEEKLY_LIMIT, weeklyCleanupUsed + movedToTrash);

      setWeeklyCleanupUsed(updatedUsed);
      applyLiveRemoval(idsToRemove);
      setSuccess(`Moved ${movedToTrash} emails from ${item.sender} to Trash.`);
    } catch (err: any) {
      setError(err.message || "Failed to move emails to Trash");
    } finally {
      setDeletingSender(null);
    }
  }

  async function handleArchiveBySender(item: DashboardTopSender) {
    if (plan === "free" && item.count > remainingWeeklyCleanup) {
      openUpgradeModal(
        "You’ve reached your weekly cleanup limit",
        `Your Free plan can clean ${remainingWeeklyCleanup} more emails this week. Upgrade to Pro to archive all ${item.count} emails from ${item.sender} now.`
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

      const idsToRemove = Array.isArray(item.ids) ? item.ids : [];

      const res = await fetch("/api/archive-by-sender", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: item.sender,
          ids: idsToRemove,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to archive emails");
        return;
      }

      const archived = Number(data.archived || idsToRemove.length || item.count);
      const updatedUsed =
        typeof data.weekly_cleanup_used === "number"
          ? data.weekly_cleanup_used
          : Math.min(FREE_WEEKLY_LIMIT, weeklyCleanupUsed + archived);

      setWeeklyCleanupUsed(updatedUsed);
      applyLiveRemoval(idsToRemove);
      setSuccess(`Archived ${archived} emails from ${item.sender}.`);
    } catch (err: any) {
      setError(err.message || "Failed to archive emails");
    } finally {
      setArchivingSender(null);
    }
  }

  async function handleMarkReadBySender(item: DashboardTopSender) {
    if (plan === "free" && item.count > remainingWeeklyUnread) {
      openUpgradeModal(
        "You’ve reached your weekly unread limit",
        `Your Free plan can mark ${remainingWeeklyUnread} more emails as read this week. Upgrade to Pro to mark all ${item.count} emails from ${item.sender} as read now.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Mark ${item.count} emails from ${item.sender} as read?`
    );
    if (!confirmed) return;

    try {
      setReadingSender(item.sender);
      setError("");
      setSuccess("");

      const idsToRemove = Array.isArray(item.ids) ? item.ids : [];

      const res = await fetch("/api/mark-read-by-sender", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: item.sender,
          ids: idsToRemove,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to mark emails as read");
        return;
      }

      const markedRead = Number(data.markedRead || idsToRemove.length || item.count);
      const updatedUnreadUsed =
        typeof data.weekly_unread_used === "number"
          ? data.weekly_unread_used
          : plan === "pro"
          ? weeklyUnreadUsed
          : Math.min(FREE_WEEKLY_LIMIT, weeklyUnreadUsed + markedRead);

      setWeeklyUnreadUsed(updatedUnreadUsed);
      applyLiveRemoval(idsToRemove);
      setSuccess(`Marked ${markedRead} emails from ${item.sender} as read.`);
    } catch (err: any) {
      setError(err.message || "Failed to mark emails as read");
    } finally {
      setReadingSender(null);
    }
  }

  function handleUnsubscribe(item: DashboardTopSender) {
    setError("");
    setSuccess("");

    runUnsubscribeFlow(item, setError, setSuccess, () => {
      setUnsubscribedSenders((prev) => ({
        ...prev,
        [item.sender]: true,
      }));
    });
  }

  function renderNoScanState() {
    return (
      <NoScanState
        loadingScan={loadingScan}
        onRunSampleScan={() => runSampleScan()}
        onRunFullScan={() => runFullScan()}
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
        onRunFullScan={() => runFullScan()}
        onGoToPromotions={() => setActiveNav("promotions")}
        onGoToTopSenders={() => setActiveNav("top-senders")}
        onGoToUnsubscribe={() => setActiveNav("top-senders")}
        onUpgradeClick={() =>
          openUpgradeModal(
            "Unlock Pro features",
            "Upgrade to Pro to unlock full inbox scan, unlimited cleanup, unlimited unread actions, and bulk actions without weekly limits."
          )
        }
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

  function renderTopSenders() {
    if (!scanResult) {
      return renderEmptyStateCard(
        "Top Senders",
        "Review sender groups by size after running a scan."
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
        unsubscribedSenders={unsubscribedSenders}
        onDelete={handleDeleteBySender}
        onArchive={handleArchiveBySender}
        onUnsubscribe={handleUnsubscribe}
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
        unsubscribedSenders={unsubscribedSenders}
        onDelete={handleDeleteBySender}
        onArchive={handleArchiveBySender}
        onUnsubscribe={handleUnsubscribe}
        onCleanPromotionsBulk={handleCleanPromotionsBulk}
        onUpgradeClick={() =>
          openUpgradeModal(
            "Upgrade to Pro",
            "Upgrade to Pro to unlock full inbox scan, unlimited cleanup, unlimited unread actions, and bulk actions without weekly limits."
          )
        }
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
        readingSender={readingSender}
        remainingWeeklyCleanup={
          viewKey === "unread" ? remainingWeeklyUnread : remainingWeeklyCleanup
        }
        plan={plan}
        unsubscribedSenders={unsubscribedSenders}
        onDelete={handleDeleteBySender}
        onArchive={handleArchiveBySender}
        onUnsubscribe={handleUnsubscribe}
        onMarkRead={handleMarkReadBySender}
      />
    );
  }

  function renderPrivacyTrust() {
    return <PrivacyTrust />;
  }

  function renderBilling() {
    return (
      <div
        style={{
          border: "1px solid #e2e8f0",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "28px",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#0f172a",
            marginBottom: "8px",
          }}
        >
          Billing
        </div>

        <div
          style={{
            fontSize: "16px",
            lineHeight: 1.7,
            color: "#64748b",
            marginBottom: "24px",
            maxWidth: "680px",
          }}
        >
          Manage your InboxShaper plan, upgrade to Pro, and review your
          subscription status.
        </div>

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            padding: "22px",
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "10px",
            }}
          >
            Current plan
          </div>

          <div
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "#0f172a",
              marginBottom: "8px",
            }}
          >
            {plan === "pro" ? "Pro" : "Free"}
          </div>

          <div
            style={{
              fontSize: "15px",
              color: "#64748b",
              lineHeight: 1.7,
              marginBottom: "18px",
            }}
          >
            {plan === "pro"
              ? "Your Pro plan is active. Full Scan and unlimited cleanup are available."
              : "You are currently on the Free plan. Upgrade to Pro to unlock Full Scan and unlimited cleanup."}
          </div>

          <button
            type="button"
            onClick={() => setUpgradeModalOpen(true)}
            style={{
              border: "none",
              background: "#0f172a",
              color: "#ffffff",
              borderRadius: "14px",
              padding: "14px 18px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {plan === "pro" ? "Manage Plan" : "Upgrade to Pro"}
          </button>
        </div>
      </div>
    );
  }

  function renderContent() {
    switch (activeNav) {
      case "top-senders":
        return renderTopSenders();
      case "promotions":
        return renderPromotions();
      case "unread":
        return renderSmartViewPage(
          "Unread",
          scanResult?.smartViews.unread || 0,
          "unread",
          "Unread emails found in your current inbox and matched inside the latest scan."
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
          "Job-related emails matched inside your latest scan."
        );
      case "online-shopping":
        return renderSmartViewPage(
          "Online Shopping",
          scanResult?.smartViews.shopping || 0,
          "shopping",
          "Shopping-related emails matched inside your latest scan."
        );
      case "billing":
        return renderBilling();
      case "privacy-trust":
        return renderPrivacyTrust();
      case "dashboard":
      default:
        return renderDashboard();
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top left, #eef4ff 0%, #f7f9fc 40%, #f8fafc 100%)",
        }}
      >
                <DashboardSidebar
          email={email}
          plan={plan}
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          setError={setError}
          setSuccess={setSuccess}
          weeklyCleanupUsed={weeklyCleanupUsed}
          remainingWeeklyCleanup={remainingWeeklyCleanup}
          freeWeeklyLimit={FREE_WEEKLY_LIMIT}
          weeklyUnreadUsed={weeklyUnreadUsed}
          remainingWeeklyUnread={remainingWeeklyUnread}
          freeWeeklyUnreadLimit={FREE_WEEKLY_LIMIT}
          scanResult={scanResult}
          onUpgradeClick={() =>
            openUpgradeModal(
              "Upgrade to Pro",
              "Upgrade to Pro to unlock full inbox scan, unlimited cleanup, unlimited unread actions, and bulk actions without weekly limits."
            )
          }
        />

        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: "26px 28px 34px 28px",
          }}
        >
          <DashboardHeader
            userEmail={email}
            onBilling={() => setActiveNav("billing")}
            onDisconnect={handleDisconnectGmail}
            onLogout={() => {
              window.location.href = "/";
            }}
            isDisconnecting={isDisconnecting}
          />

          <ScanBanner
            error={error}
            success={success}
            progress={
              activeScanJob &&
              (activeScanJob.status === "queued" ||
                activeScanJob.status === "running")
                ? {
                    step: activeScanJob.currentStep,
                    progress: activeScanJob.progress,
                  }
                : null
            }
          />

          {renderContent()}
        </div>
      </div>

      <UpgradeModal
        open={upgradeModalOpen}
        title={upgradeModalTitle}
        description={upgradeModalDescription}
        onClose={closeUpgradeModal}
        onUpgrade={handleUpgradeClick}
      />
    </>
  );
}