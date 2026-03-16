import type {
  HealthTone,
  SenderBucket,
  ToneStyles,
} from "./dashboard-types";

export const FREE_WEEKLY_LIMIT = 250;

export function getHealthTone(score: number): HealthTone {
  if (score >= 80) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

export function calculateHealthScore(
  scanned: number,
  senderGroups: number,
  promotionsFound: number
): number {
  if (!scanned) return 0;

  let score = 100;
  score -= Math.min(45, Math.floor(promotionsFound / 12));
  score -= Math.min(25, senderGroups * 2);

  return Math.max(18, Math.min(92, score));
}

export function getSenderBucketLabel(count: number): SenderBucket | null {
  if (count >= 1000) return "1000+ messages";
  if (count >= 500) return "500–999 messages";
  if (count >= 100) return "100–499 messages";
  if (count >= 10) return "10–99 messages";
  return null;
}

export function getToneStyles(healthTone: HealthTone): ToneStyles {
  if (healthTone === "green") {
    return {
      cardBg: "#ecfdf5",
      cardBorder: "#86efac",
      title: "#166534",
      bar: "#16a34a",
      chipBg: "#dcfce7",
      chipColor: "#166534",
      chipText: "Healthy",
    };
  }

  if (healthTone === "yellow") {
    return {
      cardBg: "#fefce8",
      cardBorder: "#facc15",
      title: "#a16207",
      bar: "#eab308",
      chipBg: "#fef3c7",
      chipColor: "#92400e",
      chipText: "Needs cleanup",
    };
  }

  return {
    cardBg: "#fef2f2",
    cardBorder: "#fca5a5",
    title: "#b91c1c",
    bar: "#ef4444",
    chipBg: "#fee2e2",
    chipColor: "#b91c1c",
    chipText: "At risk",
  };
}