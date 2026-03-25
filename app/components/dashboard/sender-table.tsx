"use client";

import { useState } from "react";
import ActionCell from "./action-cell";

type TopSender = {
  sender: string;
  count: number;
  ids?: string[];
  unsubscribeAvailable?: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod?: "url" | "mailto" | null;
};

type SenderTableProps = {
  rows: TopSender[];
  deletingSender: string | null;
  archivingSender: string | null;
  readingSender?: string | null;
  remainingWeeklyCleanup: number;
  plan: "free" | "pro";
  unsubscribedSenders?: Record<string, boolean>;
  onDelete: (item: TopSender) => void;
  onArchive: (item: TopSender) => void;
  onUnsubscribe: (item: TopSender) => void;
  onMarkRead?: (item: TopSender) => void;
};

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatSender(sender: string) {
  const match = sender.match(/^(.*)<(.+)>$/);

  if (!match) {
    return {
      name: sender.trim(),
      email: sender.includes("@") ? sender.trim() : null,
    };
  }

  const name = match[1]?.trim() || "Unknown Sender";
  const email = match[2]?.trim() || null;

  return {
    name,
    email,
  };
}

function getBaseDomainFromEmail(email: string) {
  if (!email || !email.includes("@")) return "";
  const domain = email.split("@")[1]?.toLowerCase().trim() || "";
  if (!domain) return "";

  const parts = domain.split(".").filter(Boolean);
  if (parts.length <= 2) return domain;

  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];

  if (
    parts.length >= 3 &&
    secondLast.length <= 3 &&
    ["co", "com", "org", "net"].includes(secondLast)
  ) {
    return parts.slice(-3).join(".");
  }

  return `${secondLast}.${last}`;
}

function getSenderInitials(sender: string) {
  const formatted = formatSender(sender);
  const parts = formatted.name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return formatted.name.slice(0, 2).toUpperCase();
}

function getSenderAccent(sender: string) {
  const palette = [
    "linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)",
    "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
    "linear-gradient(135deg, #0f766e 0%, #2dd4bf 100%)",
    "linear-gradient(135deg, #ea580c 0%, #fb923c 100%)",
    "linear-gradient(135deg, #be123c 0%, #fb7185 100%)",
    "linear-gradient(135deg, #4338ca 0%, #818cf8 100%)",
  ];

  let hash = 0;
  for (let i = 0; i < sender.length; i++) {
    hash = sender.charCodeAt(i) + ((hash << 5) - hash);
  }

  return palette[Math.abs(hash) % palette.length];
}

function SenderLogo({
  sender,
  email,
}: {
  sender: string;
  email: string | null;
}) {
  const domain = getBaseDomainFromEmail(email || "");
  const initials = getSenderInitials(sender);
  const accent = getSenderAccent(sender);
  const [imgError, setImgError] = useState(false);

  const logoUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    : "";

  const showImage = Boolean(domain) && !imgError;

  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "14px",
        background: showImage ? "#ffffff" : accent,
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        fontSize: "12px",
        flexShrink: 0,
        boxShadow: "0 10px 24px rgba(15,23,42,0.10)",
        overflow: "hidden",
        border: showImage ? "1px solid #e5e7eb" : "none",
      }}
      title={sender}
    >
      {showImage ? (
        <img
          src={logoUrl}
          alt={sender}
          width={22}
          height={22}
          style={{ display: "block" }}
          onError={() => setImgError(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

export default function SenderTable({
  rows,
  deletingSender,
  archivingSender,
  readingSender = null,
  remainingWeeklyCleanup,
  plan,
  unsubscribedSenders = {},
  onDelete,
  onArchive,
  onUnsubscribe,
  onMarkRead,
}: SenderTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  return (
    <div
      style={{
        border: "1px solid #dbe7ff",
        borderRadius: "22px",
        overflow: "hidden",
        background:
          "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(250,252,255,0.96) 100%)",
        boxShadow: "0 14px 32px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.8fr 0.45fr 1fr",
          padding: "15px 18px",
          background: "#f8fbff",
          borderBottom: "1px solid #dbe7ff",
          fontSize: "13px",
          color: "#64748b",
          fontWeight: 900,
          letterSpacing: "0.01em",
        }}
      >
        <div>Sender</div>
        <div>Emails</div>
        <div style={{ textAlign: "right" }}>Actions</div>
      </div>

      {rows.map((item, index) => {
        const isUnsubscribed = Boolean(unsubscribedSenders[item.sender]);
        const formattedSender = formatSender(item.sender);
        const rowKey = `${item.sender}-${index}`;
        const isHovered = hoveredRow === rowKey;

        return (
          <div
            key={rowKey}
            onMouseEnter={() => setHoveredRow(rowKey)}
            onMouseLeave={() => setHoveredRow(null)}
            style={{
              display: "grid",
              gridTemplateColumns: "1.8fr 0.45fr 1fr",
              padding: "18px",
              borderBottom:
                index === rows.length - 1 ? "none" : "1px solid #edf2f7",
              alignItems: "center",
              gap: "14px",
              background: isUnsubscribed
                ? "#f0fdf4"
                : isHovered
                ? "linear-gradient(180deg, rgba(248,251,255,0.96) 0%, rgba(255,255,255,1) 100%)"
                : "#ffffff",
              transition:
                "background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
              boxShadow: isHovered
                ? "0 8px 20px rgba(37,99,235,0.08)"
                : "none",
              transform: isHovered ? "translateY(-1px)" : "translateY(0)",
            }}
          >
            <div
              style={{
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <SenderLogo sender={item.sender} email={formattedSender.email} />

              <div
                style={{
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    color: "#0f172a",
                    fontSize: "16px",
                    overflowWrap: "anywhere",
                    lineHeight: 1.25,
                    marginBottom: formattedSender.email ? "4px" : "0",
                  }}
                >
                  {formattedSender.name}
                </div>

                {formattedSender.email ? (
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#64748b",
                      fontWeight: 600,
                      overflowWrap: "anywhere",
                      lineHeight: 1.35,
                    }}
                  >
                    {formattedSender.email}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              style={{
                fontWeight: 900,
                color: "#0f172a",
                fontSize: "18px",
                letterSpacing: "-0.02em",
              }}
            >
              {formatNumber(item.count)}
            </div>

            <div>
              <ActionCell
                item={item}
                deletingSender={deletingSender}
                archivingSender={archivingSender}
                readingSender={readingSender}
                remainingWeeklyCleanup={remainingWeeklyCleanup}
                plan={plan}
                isUnsubscribed={isUnsubscribed}
                onDelete={onDelete}
                onArchive={onArchive}
                onUnsubscribe={onUnsubscribe}
                onMarkRead={onMarkRead}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}