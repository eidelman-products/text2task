import CustomerStoriesSection from "./customer-stories-section";

export default function HeroSection() {
  return (
    <div className="t2t-page">
      <style>{styles}</style>

      <div className="t2t-main">
        <div className="t2t-customer-stories-wrap">
          <CustomerStoriesSection />
        </div>
      </div>
    </div>
  );
}

const styles = `
  .t2t-page {
    background: #f5f9ff;
    color: #0f172a;
  }

  .t2t-page * {
    box-sizing: border-box;
  }

  .t2t-header {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
    padding: 16px 0 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    border-bottom: 1px solid rgba(226, 232, 240, 0.72);
  }

  .t2t-logo {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }

  .t2t-logo img {
    width: 154px;
    height: auto;
    display: block;
    object-fit: contain;
    object-position: left center;
  }

  .t2t-nav {
    display: flex;
    align-items: center;
    gap: 23px;
    font-size: 13px;
    font-weight: 750;
  }

  .t2t-nav a {
    color: #475569;
    text-decoration: none;
    transition: color 160ms ease;
  }

  .t2t-nav a:hover {
    color: #1d4ed8;
  }

  .t2t-nav-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 42px;
    padding: 0 19px;
    border-radius: 12px;
    border: 1px solid #2563eb;
    background: #2563eb;
    color: white;
    text-decoration: none;
    font-size: 13px;
    font-weight: 850;
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.18);
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .t2t-nav-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px rgba(37, 99, 235, 0.22);
  }

  .t2t-main {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
    padding-bottom: 0;
  }

  .t2t-customer-stories-wrap {
    padding: 44px 0 28px;
  }

  .t2t-customer-stories-wrap:not(:has(.t2t-customer-stories)) {
    display: none;
  }

  .t2t-customer-stories-wrap .t2t-customer-stories {
    padding: 0;
  }

  .t2t-customer-stories-wrap .t2t-customer-stories-shell {
    max-width: none;
    margin-left: 0;
    margin-right: 0;
  }

  .t2t-customer-stories-wrap .t2t-customer-stories-grid {
    margin-left: auto;
    margin-right: auto;
  }

  .t2t-customer-stories-wrap .t2t-customer-story-card {
    border-color: #d7e6ff;
    background: #ffffff;
    box-shadow: 0 8px 24px rgba(37, 99, 235, 0.055);
  }

  .t2t-customer-stories-wrap .t2t-customer-story-quote {
    color: #2563eb;
  }

  .t2t-footer {
    margin-top: 0;
    border-top-color: rgba(226, 232, 240, 0.58);
    background: rgba(255, 255, 255, 0.92);
  }

  .t2t-footer .t2t-footer-inner {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.95fr);
    gap: 64px;
    padding: 42px 4px 36px;
  }

  .t2t-footer .t2t-footer-brand {
    max-width: 370px;
  }

  .t2t-footer .t2t-footer-brand p {
    margin-top: 17px;
    color: #64748b;
    font-weight: 560;
  }

  .t2t-footer .t2t-footer-support {
    margin-top: 21px;
  }

  .t2t-footer .t2t-footer-support span {
    color: #94a3b8;
    font-weight: 800;
  }

  .t2t-footer .t2t-footer-support strong {
    color: #2563eb;
    font-weight: 750;
    transition: color 160ms ease;
  }

  .t2t-footer .t2t-footer-support:hover strong {
    color: #1d4ed8;
  }

  .t2t-footer .t2t-footer-nav {
    gap: 36px;
    padding-top: 5px;
  }

  .t2t-footer .t2t-footer-column h3 {
    margin-bottom: 16px;
    color: #334155;
    font-weight: 750;
  }

  .t2t-footer .t2t-footer-column div {
    gap: 11px;
  }

  .t2t-footer .t2t-footer-column a {
    color: #64748b;
    font-weight: 560;
  }

  .t2t-footer .t2t-footer-column a:hover {
    color: #1d4ed8;
  }

  .t2t-footer .t2t-footer-bottom {
    border-top-color: rgba(226, 232, 240, 0.58);
    padding: 20px 4px;
    color: #94a3b8;
    font-weight: 560;
  }

  .t2t-footer .t2t-footer-bottom div {
    gap: 11px;
  }

  .t2t-footer .t2t-footer-bottom a {
    color: #64748b;
    font-weight: 650;
  }

  .t2t-footer .t2t-footer-bottom a:hover {
    color: #1d4ed8;
  }

  .t2t-footer .t2t-footer-bottom div span {
    color: #cbd5e1;
  }

  @media (max-width: 980px) {
    .t2t-nav {
      display: none;
    }

    .t2t-customer-stories-wrap .t2t-customer-stories-grid {
      gap: 20px;
      margin-left: auto;
      margin-right: auto;
    }

    .t2t-footer .t2t-footer-inner {
      grid-template-columns: 1fr;
      gap: 42px;
    }

    .t2t-footer .t2t-footer-nav {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 34px 28px;
    }

  }

  @media (max-width: 640px) {
    .t2t-header,
    .t2t-main {
      width: min(100% - 24px, 1180px);
    }

    .t2t-header {
      padding-top: 14px;
      gap: 12px;
    }

    .t2t-logo img {
      width: 136px;
    }

    .t2t-nav-cta {
      height: 38px;
      padding: 0 14px;
      font-size: 12px;
    }

    .t2t-footer {
      margin-top: 50px;
    }

    .t2t-footer .t2t-footer-inner {
      padding: 32px 0;
      gap: 34px;
    }

    .t2t-footer .t2t-footer-nav {
      gap: 30px 20px;
    }

    .t2t-footer .t2t-footer-bottom {
      padding: 22px 0;
      gap: 16px;
    }

    .t2t-customer-stories-wrap {
      padding: 38px 0 24px;
    }

    .t2t-customer-stories-wrap .t2t-customer-stories-grid {
      gap: 20px;
    }
  }
`;
