"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import DashboardUserMenu from "@/app/components/dashboard/dashboard-user-menu";

type AccountInfo = {
  id: string;
  email: string;
  plan: "free" | "pro";
  created_at?: string | null;
};

type FeedbackFormState = {
  displayName: string;
  roleOrBusinessType: string;
  rating: string;
  feedbackText: string;
  publicPermission: boolean;
};

const initialFeedbackForm: FeedbackFormState = {
  displayName: "",
  roleOrBusinessType: "",
  rating: "",
  feedbackText: "",
  publicPermission: true,
};

export default function ProfilePage() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [feedbackForm, setFeedbackForm] =
    useState<FeedbackFormState>(initialFeedbackForm);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState("");

  useEffect(() => {
    async function loadAccount() {
      try {
        const res = await fetch("/api/billing/subscription", {
          method: "GET",
          cache: "no-store",
        });

        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }

        const data = await res.json();

        if (res.ok) {
          setAccount({
            id: data.id,
            email: data.email,
            plan: data.plan === "pro" ? "pro" : "free",
            created_at: data.created_at || null,
          });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadAccount();
  }, []);

  const displayName = account?.email?.split("@")[0] || "Text2Task user";
  const displayEmail = isLoading ? "Loading account..." : account?.email || "Unavailable";
  const isPro = account?.plan === "pro";
  const planLabel = isLoading ? "Loading" : isPro ? "Pro plan" : "Free plan";
  const memberSince = formatMemberSince(account?.created_at);

  const suggestedDisplayName = useMemo(() => {
    if (!account?.email) return "";

    const localPart = account.email.split("@")[0] || "";
    const clean = localPart
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) return "";

    return clean
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }, [account?.email]);

  useEffect(() => {
    if (!suggestedDisplayName) return;

    setFeedbackForm((current) => {
      if (current.displayName.trim()) return current;

      return {
        ...current,
        displayName: suggestedDisplayName,
      };
    });
  }, [suggestedDisplayName]);

  useEffect(() => {
    if (!isFeedbackModalOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmittingFeedback) {
        setIsFeedbackModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFeedbackModalOpen, isSubmittingFeedback]);

  function updateFeedbackField<K extends keyof FeedbackFormState>(
    field: K,
    value: FeedbackFormState[K]
  ) {
    setFeedbackForm((current) => ({
      ...current,
      [field]: value,
    }));

    setFeedbackError("");
    setFeedbackSuccess("");
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmittingFeedback) return;

    const cleanDisplayName = feedbackForm.displayName.trim();
    const cleanRole = feedbackForm.roleOrBusinessType.trim();
    const cleanFeedback = feedbackForm.feedbackText.trim();
    const ratingValue = feedbackForm.rating
      ? Number(feedbackForm.rating)
      : null;

    if (cleanDisplayName.length < 2) {
      setFeedbackError("Please enter a display name with at least 2 characters.");
      return;
    }

    if (cleanFeedback.length < 20) {
      setFeedbackError("Please write at least 20 characters of feedback.");
      return;
    }

    if (
      ratingValue !== null &&
      (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5)
    ) {
      setFeedbackError("Rating must be between 1 and 5.");
      return;
    }

    try {
      setIsSubmittingFeedback(true);
      setFeedbackError("");
      setFeedbackSuccess("");

      const res = await fetch("/api/customer-stories/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          displayName: cleanDisplayName,
          roleOrBusinessType: cleanRole || null,
          rating: ratingValue,
          feedbackText: cleanFeedback,
          publicPermission: feedbackForm.publicPermission,
        }),
      });

      const data = await res.json();

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit feedback.");
      }

      setFeedbackSuccess(
        data?.message ||
          "Thanks - your feedback was sent for review. If you allowed public display, it may appear after approval."
      );

      setFeedbackForm({
        ...initialFeedbackForm,
        displayName: cleanDisplayName,
      });
    } catch (error: any) {
      console.error(error);
      setFeedbackError(
        error?.message || "Could not submit feedback right now."
      );
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div style={styles.accountMenu}>
        <DashboardUserMenu />
      </div>

      <section className="account-center-shell" style={styles.shell}>
        <header style={styles.heroCard}>
          <div style={styles.heroTopRow}>
            <a href="/dashboard" style={styles.backLink}>
              Back to workspace
            </a>

            <div
              style={{
                ...styles.planBadge,
                ...(isPro ? styles.proBadge : styles.freeBadge),
              }}
            >
              <span
                style={{
                  ...styles.planDot,
                  background: isPro ? "#22c55e" : "#6366f1",
                }}
              />
              {planLabel}
            </div>
          </div>

          <div style={styles.heroMain}>
            <div style={styles.avatar}>{getInitials(account?.email)}</div>

            <div style={styles.heroCopy}>
              <div style={styles.kicker}>Profile</div>
              <h1 style={styles.title}>Account center</h1>
              <p style={styles.accountIdentity}>{displayEmail}</p>
              <p style={styles.subtitle}>
                Manage your Text2Task account, billing, support, and feedback.
              </p>
            </div>
          </div>
        </header>

        <div className="account-center-grid" style={styles.accountGrid}>
          <section style={styles.mainCard}>
            <div style={styles.cardHeader}>
              <div>
                <div style={styles.cardEyebrow}>Account details</div>
                <h2 style={styles.cardTitle}>{displayName}</h2>
              </div>
            </div>

            <div style={styles.detailList}>
              <InfoRow label="Email" value={displayEmail} />
              <InfoRow label="Workspace" value="Text2Task CRM" />
              <InfoRow label="Member since" value={memberSince} />
            </div>
          </section>

          <aside style={styles.sideColumn}>
            <section style={styles.sideCard}>
              <div style={styles.cardEyebrow}>Plan & support</div>
              <div style={styles.planSummary}>
                <div>
                  <h2 style={styles.sideTitle}>
                    {isLoading ? "Loading plan" : isPro ? "Text2Task Pro" : "Text2Task Free"}
                  </h2>
                  <p style={styles.sideText}>
                    {isPro
                      ? "Your unlimited workspace is active."
                      : "Upgrade when you are ready for the full workspace."}
                  </p>
                </div>
              </div>

              <div style={styles.actionStack}>
                <a
                  href="/dashboard/billing"
                  className="account-center-primary-button"
                  style={styles.primaryButton}
                >
                  Open billing
                </a>

                <a href="/contact?from=dashboard" style={styles.secondaryButton}>
                  Contact support
                </a>
              </div>
            </section>
          </aside>
        </div>

        <section style={styles.feedbackCtaCard}>
          <div style={styles.feedbackCtaCopy}>
            <div>
              <h2 style={styles.feedbackCtaTitle}>Share feedback</h2>
              <p style={styles.feedbackCtaText}>
                Tell us how Text2Task is working for you. Approved feedback may
                appear in Customer stories.
              </p>
            </div>

            <span style={styles.feedbackCtaNote}>Reviewed before publishing.</span>
          </div>

          <button
            type="button"
            className="account-center-feedback-button"
            onClick={() => setIsFeedbackModalOpen(true)}
            style={styles.feedbackCtaButton}
          >
            Share your experience
          </button>
        </section>
      </section>

      {isFeedbackModalOpen ? (
        <div
          role="presentation"
          style={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmittingFeedback) {
              setIsFeedbackModalOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-feedback-title"
            style={styles.feedbackModal}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div style={styles.feedbackHeader}>
              <div>
                <div style={styles.feedbackKicker}>Share feedback</div>
                <h2 id="share-feedback-title" style={styles.feedbackTitle}>
                  Share your experience
                </h2>
                <p style={styles.feedbackSubtitle}>
                  Tell us how Text2Task helps you organize client work. With
                  your permission, approved feedback may appear publicly.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsFeedbackModalOpen(false)}
                disabled={isSubmittingFeedback}
                aria-label="Close feedback form"
                style={{
                  ...styles.modalCloseButton,
                  opacity: isSubmittingFeedback ? 0.62 : 1,
                  cursor: isSubmittingFeedback ? "not-allowed" : "pointer",
                }}
              >
                x
              </button>
            </div>

            <form onSubmit={submitFeedback} style={styles.feedbackForm}>
              <div className="profile-feedback-form-grid" style={styles.formGrid}>
                <label style={styles.formField}>
                  <span style={styles.formLabel}>Display name</span>
                  <input
                    value={feedbackForm.displayName}
                    onChange={(event) =>
                      updateFeedbackField("displayName", event.target.value)
                    }
                    placeholder="Yan E."
                    maxLength={80}
                    style={styles.input}
                    disabled={isSubmittingFeedback}
                  />
                </label>

                <label style={styles.formField}>
                  <span style={styles.formLabel}>Role or business type</span>
                  <input
                    value={feedbackForm.roleOrBusinessType}
                    onChange={(event) =>
                      updateFeedbackField("roleOrBusinessType", event.target.value)
                    }
                    placeholder="Freelancer, designer, agency owner..."
                    maxLength={120}
                    style={styles.input}
                    disabled={isSubmittingFeedback}
                  />
                </label>
              </div>

              <label style={styles.formField}>
                <span style={styles.formLabel}>Rating</span>
                <select
                  value={feedbackForm.rating}
                  onChange={(event) =>
                    updateFeedbackField("rating", event.target.value)
                  }
                  style={styles.select}
                  disabled={isSubmittingFeedback}
                >
                  <option value="">No rating</option>
                  <option value="5">5 - Excellent</option>
                  <option value="4">4 - Very good</option>
                  <option value="3">3 - Good</option>
                  <option value="2">2 - Needs work</option>
                  <option value="1">1 - Not helpful</option>
                </select>
              </label>

              <label style={styles.formField}>
                <span style={styles.formLabel}>Your feedback</span>
                <textarea
                  value={feedbackForm.feedbackText}
                  onChange={(event) =>
                    updateFeedbackField("feedbackText", event.target.value)
                  }
                  placeholder="Example: Text2Task helps me turn messy client messages into clear projects, tasks, deadlines, and follow-ups..."
                  minLength={20}
                  maxLength={1200}
                  rows={6}
                  style={styles.textarea}
                  disabled={isSubmittingFeedback}
                />
                <span style={styles.characterHint}>
                  {feedbackForm.feedbackText.trim().length}/1200 characters
                </span>
              </label>

              <label style={styles.permissionRow}>
                <input
                  type="checkbox"
                  checked={feedbackForm.publicPermission}
                  onChange={(event) =>
                    updateFeedbackField("publicPermission", event.target.checked)
                  }
                  disabled={isSubmittingFeedback}
                  style={styles.checkbox}
                />
                <span>
                  I allow Text2Task to display this feedback publicly after approval.
                </span>
              </label>

              {feedbackError ? (
                <div style={styles.errorBox}>{feedbackError}</div>
              ) : null}

              {feedbackSuccess ? (
                <div style={styles.successBox}>{feedbackSuccess}</div>
              ) : null}

              <div style={styles.feedbackActions}>
                <button
                  type="submit"
                  className="account-center-submit-button"
                  disabled={isSubmittingFeedback}
                  style={{
                    ...styles.submitButton,
                    ...(isSubmittingFeedback ? styles.disabledButton : {}),
                  }}
                >
                  {isSubmittingFeedback ? "Sending..." : "Send feedback"}
                </button>

                <span style={styles.reviewNote}>
                  Feedback is reviewed before it appears publicly.
                </span>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

function getInitials(email?: string | null) {
  const value = String(email || "U").trim();
  if (!value || value === "U") return "U";

  const localPart = value.split("@")[0] || value;
  const clean = localPart.replace(/[._-]+/g, " ").trim();
  const words = clean.split(" ").filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return clean.slice(0, 2).toUpperCase() || "U";
}

function formatMemberSince(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

const responsiveCss = `
  @media (max-width: 860px) {
    .account-center-grid,
    .profile-feedback-form-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 640px) {
    .account-center-shell {
      padding: 0 !important;
    }
  }

  .account-center-primary-button:hover,
  .account-center-feedback-button:hover,
  .account-center-submit-button:hover {
    transform: translateY(-1px);
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px",
    background:
      "linear-gradient(180deg, #ffffff 0%, #f8fafc 56%, #ffffff 100%)",
    color: "#0f172a",
    boxSizing: "border-box",
  },

  accountMenu: {
    position: "fixed",
    top: 24,
    right: 32,
    zIndex: 1000,
  },

  shell: {
    width: "100%",
    maxWidth: 1060,
    margin: "58px auto 0",
  },

  heroCard: {
    position: "relative",
    overflow: "visible",
    borderRadius: 0,
    border: "none",
    background: "transparent",
    boxShadow: "none",
    padding: "0 0 18px",
  },

  heroTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 28,
    flexWrap: "wrap",
  },

  backLink: {
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    color: "#1d4ed8",
    background: "rgba(239,246,255,0.72)",
    border: "1px solid rgba(191,219,254,0.86)",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 900,
  },

  planBadge: {
    minHeight: 28,
    padding: "0 12px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    color: "#047857",
    background: "rgba(236,253,245,0.84)",
    border: "1px solid rgba(34,197,94,0.20)",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.045em",
  },

  proBadge: {
    color: "#166534",
    background: "rgba(240,253,244,0.9)",
    border: "1px solid rgba(187,247,208,0.82)",
  },

  freeBadge: {
    color: "#4338ca",
    background: "rgba(238,242,255,0.9)",
    border: "1px solid rgba(199,210,254,0.82)",
  },

  planDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    boxShadow: "0 0 0 4px rgba(99,102,241,0.11)",
  },

  heroMain: {
    marginTop: 26,
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    display: "grid",
    placeItems: "center",
    color: "#1d4ed8",
    background:
      "linear-gradient(135deg, rgba(239,246,255,0.98), rgba(255,255,255,0.98))",
    border: "1px solid rgba(191,219,254,0.92)",
    fontSize: 20,
    fontWeight: 950,
    boxShadow:
      "0 12px 24px rgba(37,99,235,0.075), inset 0 1px 0 rgba(255,255,255,0.96)",
    flexShrink: 0,
  },

  heroCopy: {
    minWidth: 0,
  },

  kicker: {
    color: "#4f46e5",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: 7,
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.052em",
  },

  accountIdentity: {
    margin: "8px 0 0",
    color: "#334155",
    fontSize: 15,
    lineHeight: 1.4,
    fontWeight: 850,
    wordBreak: "break-word",
  },

  subtitle: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.6,
    fontWeight: 650,
    maxWidth: 720,
  },

  accountGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.3fr) minmax(300px, 0.7fr)",
    gap: 18,
    alignItems: "stretch",
  },

  mainCard: {
    borderRadius: 26,
    border: "1px solid rgba(226,232,240,0.92)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.72))",
    boxShadow:
      "0 16px 38px rgba(15,23,42,0.045), inset 0 1px 0 rgba(255,255,255,0.94)",
    padding: 24,
  },

  sideColumn: {
    display: "grid",
    minWidth: 0,
  },

  sideCard: {
    borderRadius: 26,
    border: "1px solid rgba(226,232,240,0.92)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(239,246,255,0.46))",
    boxShadow:
      "0 16px 38px rgba(15,23,42,0.045), inset 0 1px 0 rgba(255,255,255,0.94)",
    padding: 24,
    display: "grid",
    gap: 18,
  },

  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
  },

  cardEyebrow: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.11em",
    marginBottom: 7,
  },

  cardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 25,
    lineHeight: 1.1,
    fontWeight: 950,
    letterSpacing: "-0.045em",
    textTransform: "capitalize",
  },

  detailList: {
    display: "grid",
    gap: 10,
  },

  infoRow: {
    minHeight: 58,
    borderRadius: 19,
    border: "1px solid rgba(226,232,240,0.78)",
    background: "rgba(255,255,255,0.72)",
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },

  infoLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    flexShrink: 0,
  },

  infoValue: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
    textAlign: "right",
    wordBreak: "break-word",
  },

  planSummary: {
    display: "grid",
    gap: 8,
  },

  sideTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.12,
    fontWeight: 950,
    letterSpacing: "-0.045em",
  },

  sideText: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 750,
  },

  actionStack: {
    display: "grid",
    gap: 10,
  },

  primaryButton: {
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 16,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 950,
    textDecoration: "none",
    boxShadow: "0 14px 30px rgba(37,99,235,0.20)",
  },

  secondaryButton: {
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 16,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.82)",
    color: "#0f172a",
    border: "1px solid rgba(203,213,225,0.86)",
    fontSize: 14,
    fontWeight: 950,
    textDecoration: "none",
    boxShadow: "0 10px 24px rgba(15,23,42,0.045)",
  },

  feedbackCtaCard: {
    marginTop: 18,
    borderRadius: 28,
    border: "1px solid rgba(226,232,240,0.82)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(248,250,252,0.82))",
    boxShadow:
      "0 18px 48px rgba(15,23,42,0.052), inset 0 1px 0 rgba(255,255,255,0.92)",
    padding: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 18,
  },

  feedbackCtaCopy: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },

  feedbackCtaTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 19,
    lineHeight: 1.15,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },

  feedbackCtaText: {
    margin: "5px 0 0",
    maxWidth: 570,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 700,
  },

  feedbackCtaNote: {
    minHeight: 28,
    padding: "0 11px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    background: "rgba(239,246,255,0.72)",
    border: "1px solid rgba(191,219,254,0.82)",
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  feedbackCtaButton: {
    minHeight: 42,
    border: 0,
    borderRadius: 15,
    padding: "0 16px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(37,99,235,0.18)",
    whiteSpace: "nowrap",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 5000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    background: "rgba(15,23,42,0.54)",
    backdropFilter: "blur(14px) saturate(118%)",
    boxSizing: "border-box",
  },

  feedbackModal: {
    width: "min(720px, calc(100vw - 36px))",
    maxHeight: "calc(100dvh - 36px)",
    overflowY: "auto",
    borderRadius: 28,
    border: "1px solid rgba(226,232,240,0.92)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.96))",
    boxShadow:
      "0 42px 110px rgba(15,23,42,0.30), inset 0 1px 0 rgba(255,255,255,0.96)",
    padding: 26,
    boxSizing: "border-box",
  },

  feedbackHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 22,
  },

  feedbackKicker: {
    color: "#4f46e5",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.11em",
    marginBottom: 7,
  },

  feedbackTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  feedbackSubtitle: {
    margin: "9px 0 0",
    maxWidth: 590,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.65,
    fontWeight: 650,
  },

  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 15,
    border: "1px solid rgba(203,213,225,0.84)",
    background: "rgba(255,255,255,0.92)",
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1,
    fontWeight: 950,
    display: "grid",
    placeItems: "center",
    boxShadow: "0 12px 26px rgba(15,23,42,0.08)",
    flexShrink: 0,
  },

  feedbackForm: {
    display: "grid",
    gap: 14,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },

  formField: {
    display: "grid",
    gap: 7,
  },

  formLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: 900,
  },

  input: {
    width: "100%",
    minHeight: 46,
    borderRadius: 16,
    border: "1px solid rgba(203,213,225,0.95)",
    background: "rgba(255,255,255,0.92)",
    color: "#0f172a",
    padding: "0 14px",
    fontSize: 14,
    fontWeight: 750,
    outline: "none",
    boxSizing: "border-box",
  },

  select: {
    width: "100%",
    minHeight: 46,
    borderRadius: 16,
    border: "1px solid rgba(203,213,225,0.95)",
    background: "rgba(255,255,255,0.92)",
    color: "#0f172a",
    padding: "0 14px",
    fontSize: 14,
    fontWeight: 750,
    outline: "none",
    boxSizing: "border-box",
  },

  textarea: {
    width: "100%",
    resize: "vertical",
    minHeight: 138,
    borderRadius: 18,
    border: "1px solid rgba(203,213,225,0.95)",
    background: "rgba(255,255,255,0.92)",
    color: "#0f172a",
    padding: "14px",
    fontSize: 14,
    lineHeight: 1.65,
    fontWeight: 650,
    outline: "none",
    boxSizing: "border-box",
  },

  characterHint: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 800,
    textAlign: "right",
  },

  permissionRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(199,210,254,0.7)",
    background: "rgba(255,255,255,0.66)",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
  },

  checkbox: {
    width: 17,
    height: 17,
    marginTop: 1,
    accentColor: "#4f46e5",
    flexShrink: 0,
  },

  errorBox: {
    borderRadius: 16,
    border: "1px solid rgba(248,113,113,0.35)",
    background: "rgba(254,242,242,0.88)",
    color: "#b91c1c",
    padding: "12px 14px",
    fontSize: 13,
    fontWeight: 800,
  },

  successBox: {
    borderRadius: 16,
    border: "1px solid rgba(34,197,94,0.28)",
    background: "rgba(240,253,244,0.9)",
    color: "#166534",
    padding: "12px 14px",
    fontSize: 13,
    fontWeight: 800,
  },

  feedbackActions: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 2,
  },

  submitButton: {
    minHeight: 46,
    border: 0,
    borderRadius: 16,
    padding: "0 18px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(37,99,235,0.20)",
  },

  disabledButton: {
    opacity: 0.68,
    cursor: "not-allowed",
  },

  reviewNote: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },
};
