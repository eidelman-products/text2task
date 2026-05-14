"use client";

import type { CSSProperties } from "react";

type ProductPreviewSectionProps = {
  jakartaClassName: string;
};

const stats = [
  { label: "Open tasks", value: "18" },
  { label: "Due this week", value: "7" },
  { label: "This month", value: "$4,800" },
];

const taskRows = [
  {
    client: "Brightside",
    task: "Landing page",
    due: "Fri",
    amount: "$1,200",
    priority: "High",
    status: "New",
  },
  {
    client: "Brightside",
    task: "Logo cleanup",
    due: "Fri",
    amount: "$250",
    priority: "Medium",
    status: "Review",
  },
  {
    client: "Northline",
    task: "Pricing section",
    due: "Fri",
    amount: "$300",
    priority: "Medium",
    status: "In Progress",
  },
  {
    client: "Northline",
    task: "3 email templates",
    due: "Fri",
    amount: "$550",
    priority: "High",
    status: "New",
  },
  {
    client: "Apex Roofing",
    task: "Brochure revisions",
    due: "May 10",
    amount: "$950",
    priority: "High",
    status: "Urgent",
  },
];

const benefitCards = [
  {
    title: "Review before save",
    text: "Check extracted tasks before adding them to your workspace.",
  },
  {
    title: "Track by client",
    text: "Keep requests, budgets, deadlines, and notes organized in one place.",
  },
  {
    title: "See business value",
    text: "Understand workload, due dates, and income at a glance.",
  },
];

export default function ProductPreviewSection({
  jakartaClassName,
}: ProductPreviewSectionProps) {
  return (
    <section
      id="product-preview"
      style={{
        background: "#ffffff",
        borderRadius: "30px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
        marginTop: "60px",
        padding: "34px 28px 38px",
      }}
    >
      <div
        style={{
          marginBottom: "26px",
          textAlign: "center",
        }}
      >
        <div
          className={jakartaClassName}
          style={{
            fontSize: "34px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            marginBottom: "10px",
            color: "#0f172a",
          }}
        >
          What you’ll see after extraction
        </div>

        <div
          style={{
            fontSize: "19px",
            color: "#64748b",
            lineHeight: "1.8",
            maxWidth: "900px",
            margin: "0 auto",
            fontWeight: 500,
          }}
        >
          Text2Task doesn’t just extract text — it turns messy client input
          into an organized workspace you can review, edit, and manage.
        </div>
      </div>

      <div
        style={{
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          borderRadius: "26px",
          border: "1px solid #e2e8f0",
          padding: "22px",
          boxShadow: "0 10px 26px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            marginBottom: "18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              className={jakartaClassName}
              style={{
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#0f172a",
                marginBottom: "6px",
              }}
            >
              Client task workspace
            </div>

            <div
              style={{
                fontSize: "16px",
                color: "#64748b",
                fontWeight: 600,
              }}
            >
              Tasks organized by client, deadline, amount, and priority.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span style={topPillStyle}>Editable preview</span>
            <span style={topPillStyle}>Text + screenshot extraction</span>
            <span style={topPillStyle}>Revenue visibility</span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "14px",
            marginBottom: "18px",
          }}
        >
          {stats.map((stat) => (
            <div key={stat.label} style={statCardStyle}>
              <div style={statLabelStyle}>{stat.label}</div>
              <div style={statValueStyle}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "22px",
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 1.4fr 0.7fr 0.8fr 0.8fr 0.8fr",
              gap: "12px",
              padding: "14px 16px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <div style={tableHeadStyle}>Client</div>
            <div style={tableHeadStyle}>Task</div>
            <div style={tableHeadStyle}>Due</div>
            <div style={tableHeadStyle}>Amount</div>
            <div style={tableHeadStyle}>Priority</div>
            <div style={tableHeadStyle}>Status</div>
          </div>

          {taskRows.map((row, index) => (
            <div
              key={`${row.client}-${row.task}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 1.4fr 0.7fr 0.8fr 0.8fr 0.8fr",
                gap: "12px",
                padding: "16px",
                borderBottom:
                  index === taskRows.length - 1
                    ? "none"
                    : "1px solid #eef2f7",
                alignItems: "center",
              }}
            >
              <div style={tableCellStrongStyle}>{row.client}</div>
              <div style={tableCellStrongStyle}>{row.task}</div>
              <div style={tableCellStyle}>{row.due}</div>
              <div style={tableCellStrongStyle}>{row.amount}</div>
              <div>
                <span style={priorityPillStyle(row.priority)}>{row.priority}</span>
              </div>
              <div>
                <span style={statusPillStyle(row.status)}>{row.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: "20px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
        }}
      >
        {benefitCards.map((card) => (
          <div key={card.title} style={benefitCardStyle}>
            <div className={jakartaClassName} style={benefitTitleStyle}>
              {card.title}
            </div>

            <div style={benefitTextStyle}>{card.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const topPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 14px",
  borderRadius: "999px",
  background: "#eef2ff",
  color: "#4338ca",
  fontSize: "13px",
  fontWeight: 800,
  border: "1px solid rgba(99,102,241,0.14)",
};

const statCardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "20px",
  padding: "18px",
  boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
};

const statLabelStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 800,
  color: "#64748b",
  marginBottom: "8px",
};

const statValueStyle: CSSProperties = {
  fontSize: "36px",
  fontWeight: 900,
  letterSpacing: "-0.04em",
  color: "#0f172a",
  lineHeight: 1,
};

const tableHeadStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 800,
  color: "#64748b",
};

const tableCellStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "#334155",
};

const tableCellStrongStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: 800,
  color: "#0f172a",
};

function priorityPillStyle(priority: string): CSSProperties {
  if (priority === "High") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "7px 12px",
      borderRadius: "999px",
      background: "#fee2e2",
      color: "#b91c1c",
      fontSize: "12px",
      fontWeight: 800,
    };
  }

  if (priority === "Medium") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "7px 12px",
      borderRadius: "999px",
      background: "#fef3c7",
      color: "#a16207",
      fontSize: "12px",
      fontWeight: 800,
    };
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 12px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#15803d",
    fontSize: "12px",
    fontWeight: 800,
  };
}

function statusPillStyle(status: string): CSSProperties {
  if (status === "Urgent") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "7px 12px",
      borderRadius: "999px",
      background: "#fff7ed",
      color: "#c2410c",
      fontSize: "12px",
      fontWeight: 800,
    };
  }

  if (status === "Review") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "7px 12px",
      borderRadius: "999px",
      background: "#ede9fe",
      color: "#6d28d9",
      fontSize: "12px",
      fontWeight: 800,
    };
  }

  if (status === "In Progress") {
    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "7px 12px",
      borderRadius: "999px",
      background: "#dbeafe",
      color: "#1d4ed8",
      fontSize: "12px",
      fontWeight: 800,
    };
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 12px",
    borderRadius: "999px",
    background: "#f1f5f9",
    color: "#334155",
    fontSize: "12px",
    fontWeight: 800,
  };
}

const benefitCardStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  padding: "18px",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
};

const benefitTitleStyle: CSSProperties = {
  fontSize: "18px",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  color: "#0f172a",
  marginBottom: "8px",
};

const benefitTextStyle: CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.7,
  color: "#64748b",
  fontWeight: 500,
};