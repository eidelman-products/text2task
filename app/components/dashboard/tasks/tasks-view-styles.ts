import type { CSSProperties } from "react";

export const responsiveCss = `
  .tasks-mobile-list {
    display: none;
  }

  .tasks-desktop-table {
    display: block;
  }

  @media (max-width: 900px) {
    .tasks-top-stats {
      justify-content: flex-start !important;
      gap: 8px !important;
    }

    .tasks-top-stats > div {
      font-size: 12px !important;
      padding: 8px 10px !important;
    }

    .tasks-desktop-table {
      display: none !important;
    }

    .tasks-mobile-list {
      display: grid !important;
    }

    .tasks-bulk-bar {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
    }

    .tasks-bulk-bar > div:first-child {
      grid-column: 1 / -1 !important;
    }

    .mobile-task-two-grid {
      grid-template-columns: 1fr !important;
    }

    .tasks-archive-tabs {
      grid-template-columns: 1fr 1fr !important;
      gap: 8px !important;
    }
  }

  @media (min-width: 901px) {
    .tasks-mobile-list {
      display: none !important;
    }

    .tasks-desktop-table {
      display: block !important;
    }
  }
`;

export const mainContentStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  minWidth: 0,
  width: "100%",
};

export const mobileListStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};