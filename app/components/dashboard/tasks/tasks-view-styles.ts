import type { CSSProperties } from "react";

export const responsiveCss = `
  .tasks-mobile-list {
    display: none;
  }

  .tasks-desktop-table {
    display: block;
  }

  @media (max-width: 1080px) {
    .tasks-open-header-top {
      align-items: flex-start !important;
      flex-direction: column !important;
      gap: 12px !important;
    }

    .tasks-top-stats {
      justify-content: flex-start !important;
      width: 100% !important;
    }
  }

  @media (max-width: 900px) {
    .tasks-open-page {
      padding: 14px 14px 30px !important;
    }

    .tasks-open-header {
      gap: 12px !important;
    }

    .tasks-open-header-top {
      align-items: flex-start !important;
      flex-direction: column !important;
      gap: 12px !important;
    }

    .tasks-top-stats {
      justify-content: flex-start !important;
      gap: 7px !important;
      width: 100% !important;
    }

    .tasks-top-stats > div {
      font-size: 11.5px !important;
      padding: 6px 8px !important;
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
