import SectionCard from "./section-card";
import MetricCard from "./metric-card";
import PrimaryButton from "./primary-button";
import SecondaryButton from "./secondary-button";
import SenderTable from "./sender-table";

type TopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod?: "url" | "mailto" | null;
};

type PromotionsViewProps = {
  promotionsFoundInSampleScan: number;
  fullInboxPromotionsCount: number | null;
  remainingWeeklyCleanup: number;
  cleaningPromotions: boolean;
  cleaningPromotionsStep: "idle" | "checking" | "cleaning" | "refreshing";
  promotionRows: TopSender[];
  deletingSender: string | null;
  archivingSender: string | null;
  plan: "free" | "pro";
  unsubscribedSenders?: Record<string, boolean>;
  onDelete: (item: TopSender) => void;
  onArchive: (item: TopSender) => void;
  onUnsubscribe: (item: TopSender) => void;
  onCleanPromotionsBulk: () => void;
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

export default function PromotionsView({
  promotionsFoundInSampleScan,
  fullInboxPromotionsCount,
  remainingWeeklyCleanup,
  cleaningPromotions,
  cleaningPromotionsStep,
  promotionRows,
  deletingSender,
  archivingSender,
  plan,
  unsubscribedSenders = {},
  onDelete,
  onArchive,
  onUnsubscribe,
  onCleanPromotionsBulk,
}: PromotionsViewProps) {
  return (
    <SectionCard
      title="Promotions"
      subtitle="Promotions is copied directly from Gmail Promotions classification."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: "14px",
          marginBottom: "16px",
        }}
      >
        <MetricCard
          label="Promotions found in sample scan"
          value={formatNumber(promotionsFoundInSampleScan)}
          accent="#ea580c"
          helperText="Only emails Gmail labeled as Promotions inside the 1,000-email sample"
        />
        <MetricCard
          label="Total promotions in your inbox"
          value={
            fullInboxPromotionsCount !== null
              ? formatNumber(fullInboxPromotionsCount)
              : "—"
          }
          accent="#2563eb"
          helperText="Count provided directly by Gmail"
        />
        <MetricCard
          label="Weekly free cleanup left"
          value={formatNumber(remainingWeeklyCleanup)}
          accent="#16a34a"
        />
        <MetricCard label="Plan" value="Free" accent="#2563eb" />
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <PrimaryButton
          onClick={onCleanPromotionsBulk}
          disabled={cleaningPromotions || remainingWeeklyCleanup <= 0}
        >
          {cleaningPromotions
            ? "Cleaning Promotions..."
            : `Clean ${remainingWeeklyCleanup} Promotions`}
        </PrimaryButton>
        <SecondaryButton>Upgrade to Pro</SecondaryButton>
      </div>

      {cleaningPromotions ? (
        <div
          style={{
            background: "#f8fbff",
            border: "1px solid #bfd3ff",
            borderRadius: "18px",
            padding: "16px",
            marginBottom: "16px",
            color: "#1e3a8a",
            fontWeight: 700,
            lineHeight: 1.8,
          }}
        >
          <div>Cleaning promotions...</div>
          <div
            style={{ opacity: cleaningPromotionsStep === "checking" ? 1 : 0.55 }}
          >
            1/3 Checking free cleanup quota
          </div>
          <div
            style={{ opacity: cleaningPromotionsStep === "cleaning" ? 1 : 0.55 }}
          >
            2/3 Cleaning emails in Gmail
          </div>
          <div
            style={{
              opacity: cleaningPromotionsStep === "refreshing" ? 1 : 0.55,
            }}
          >
            3/3 Refreshing dashboard results
          </div>
        </div>
      ) : null}

      <div
        style={{
          background: "#fff7ed",
          border: "1px solid #fdba74",
          borderRadius: "18px",
          padding: "16px",
          color: "#b45309",
          fontWeight: 700,
          lineHeight: 1.8,
          marginBottom: "18px",
        }}
      >
        <div>
          We detected{" "}
          <b>
            {fullInboxPromotionsCount !== null
              ? formatNumber(fullInboxPromotionsCount)
              : formatNumber(promotionsFoundInSampleScan)}
          </b>{" "}
          promotion emails in your inbox.
        </div>
        <div>
          The table below is based only on emails Gmail itself placed in{" "}
          <b>Promotions</b> inside the sample scan.
        </div>
        <div>
          Free users can clean up to <b>{remainingWeeklyCleanup}</b> emails this
          week.
        </div>
      </div>

      {promotionRows.length === 0 ? (
        <div
          style={{
            border: "1px solid #dbe7ff",
            borderRadius: "20px",
            padding: "20px",
            color: "#64748b",
            fontWeight: 700,
          }}
        >
          No promotional sender groups available in this sample scan.
        </div>
      ) : (
        <SenderTable
          rows={promotionRows}
          deletingSender={deletingSender}
          archivingSender={archivingSender}
          remainingWeeklyCleanup={remainingWeeklyCleanup}
          plan={plan}
          unsubscribedSenders={unsubscribedSenders}
          onDelete={onDelete}
          onArchive={onArchive}
          onUnsubscribe={onUnsubscribe}
        />
      )}
    </SectionCard>
  );
}