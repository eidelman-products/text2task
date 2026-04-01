"use client";

import { Inter, Plus_Jakarta_Sans } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export default function Home() {
  function signInWithGoogle() {
    window.location.href = "/api/auth/login";
  }

  const trustPillStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 16px",
    borderRadius: "999px",
    fontSize: "15px",
    fontWeight: 700,
    color: "#334155",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  } as const;

  const sectionCardStyle = {
    background: "#ffffff",
    borderRadius: "30px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.06)",
  } as const;

  const previewImageStyle = {
    width: "100%",
    display: "block",
    margin: "0 auto",
    borderRadius: "18px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
  } as const;

  return (
    <main
      className={inter.className}
      style={{
        background:
          "radial-gradient(circle at top left, #eef4ff 0%, #f7f9fc 40%, #f8fafc 100%)",
        minHeight: "100vh",
        padding: 0,
        margin: 0,
        color: "#0f172a",
      }}
    >
      <section
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "80px 24px 60px",
        }}
      >
        <div
          style={{
            maxWidth: "960px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <h1
            className={jakarta.className}
            style={{
              fontSize: "78px",
              lineHeight: "1.02",
              margin: "0 0 26px 0",
              fontWeight: 800,
              letterSpacing: "-0.05em",
              maxWidth: "920px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Clean your Gmail inbox in minutes.
          </h1>

          <p
            style={{
              fontSize: "25px",
              color: "#475569",
              maxWidth: "860px",
              margin: "0 auto 22px",
              lineHeight: "1.7",
              fontWeight: 500,
            }}
          >
            InboxShaper helps you scan clutter, review top senders, remove
            promotions, and clean your inbox faster without manual work.
          </p>

          <p
            className={jakarta.className}
            style={{
              fontSize: "20px",
              color: "#0f172a",
              maxWidth: "860px",
              margin: "0 auto 34px",
              lineHeight: "1.8",
              fontWeight: 700,
            }}
          >
            Connect Gmail securely, review the results, and approve every
            cleanup action yourself.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "16px",
              flexWrap: "wrap",
              marginBottom: "18px",
            }}
          >
            <button
              onClick={signInWithGoogle}
              className={jakarta.className}
              style={{
                padding: "18px 34px",
                fontSize: "20px",
                borderRadius: "16px",
                border: "none",
                background: "#0f172a",
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: 800,
                boxShadow: "0 18px 35px rgba(15, 23, 42, 0.16)",
              }}
            >
              Connect Gmail Securely
            </button>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "14px",
              flexWrap: "wrap",
              marginBottom: "14px",
            }}
          >
            <span style={trustPillStyle}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "999px",
                  background: "#2563eb",
                  display: "inline-block",
                }}
              />
              Metadata only
            </span>

            <span style={trustPillStyle}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "999px",
                  background: "#16a34a",
                  display: "inline-block",
                }}
              />
              No email storage
            </span>

            <span style={trustPillStyle}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "999px",
                  background: "#f59e0b",
                  display: "inline-block",
                }}
              />
              Every action requires approval
            </span>
          </div>

          <div
            style={{
              fontSize: "16px",
              color: "#64748b",
              lineHeight: "1.7",
              fontWeight: 500,
              marginBottom: "16px",
            }}
          >
            Google OAuth • Privacy-first • Disconnect anytime
          </div>

          <div
            style={{
              maxWidth: "720px",
              margin: "0 auto",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "999px",
              padding: "12px 18px",
              color: "#334155",
              fontSize: "15px",
              fontWeight: 500,
              lineHeight: 1.7,
              boxShadow: "0 6px 18px rgba(15, 23, 42, 0.04)",
            }}
          >
            No access to email content • No storage • Disconnect anytime
          </div>
        </div>

        <div
          style={{
            marginTop: "46px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "22px",
              border: "1px solid #e2e8f0",
              padding: "10px",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
            }}
          >
            <div
              className={jakarta.className}
              style={{
                fontSize: "15px",
                fontWeight: 800,
                color: "#2563eb",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "10px",
              }}
            >
              Inbox health overview
            </div>

            <img
              src="/inbox-health.png"
              alt="Inbox health preview"
              style={{
                ...previewImageStyle,
                maxWidth: "480px",
              }}
            />
          </div>

          <div
            style={{
              background: "#ffffff",
              borderRadius: "22px",
              border: "1px solid #e2e8f0",
              padding: "10px",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
            }}
          >
            <div
              className={jakarta.className}
              style={{
                fontSize: "15px",
                fontWeight: 800,
                color: "#2563eb",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "10px",
              }}
            >
              Email categories breakdown
            </div>

            <img
              src="/email-categories.png"
              alt="Email categories preview"
              style={{
                ...previewImageStyle,
                maxWidth: "480px",
              }}
            />
          </div>
        </div>

        <section
          id="product-preview"
          style={{
            ...sectionCardStyle,
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
              className={jakarta.className}
              style={{
                fontSize: "34px",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                marginBottom: "10px",
              }}
            >
              What you’ll see after connecting
            </div>

            <div
              style={{
                fontSize: "19px",
                color: "#64748b",
                lineHeight: "1.8",
                maxWidth: "860px",
                margin: "0 auto",
                fontWeight: 500,
              }}
            >
              InboxShaper shows you real sender groups, cleanup opportunities,
              and inbox insights before you apply any action.
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
            }}
          >
            <div
              className={jakarta.className}
              style={{
                fontSize: "32px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                marginBottom: "12px",
              }}
            >
              Clean emails in one click
            </div>

            <div
              style={{
                fontSize: "18px",
                color: "#64748b",
                lineHeight: "1.8",
                marginBottom: "20px",
                maxWidth: "920px",
                marginLeft: "auto",
                marginRight: "auto",
                fontWeight: 500,
              }}
            >
              Review sender rows, unsubscribe where available, and move or
              archive emails only after you approve the action.
            </div>

            <div
              style={{
                maxWidth: "980px",
                margin: "0 auto",
                padding: "2px",
                borderRadius: "20px",
              }}
            >
              <img
                src="/sender-actions-new.png"
                alt="Sender cleanup table preview"
                style={{
                  ...previewImageStyle,
                  maxWidth: "920px",
                  border: "1px solid rgba(226,232,240,0.9)",
                  boxShadow: "0 6px 14px rgba(15, 23, 42, 0.04)",
                }}
              />
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: "46px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              ...sectionCardStyle,
              padding: "28px 30px",
              maxWidth: "1100px",
              width: "100%",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "20px",
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "20px",
                padding: "22px",
              }}
            >
              <div
                style={{
                  fontSize: "28px",
                  marginBottom: "10px",
                }}
              >
                🔐
              </div>
              <div
                className={jakarta.className}
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  marginBottom: "10px",
                }}
              >
                Secure Google sign-in
              </div>
              <div
                style={{
                  fontSize: "17px",
                  color: "#64748b",
                  lineHeight: "1.8",
                  fontWeight: 500,
                }}
              >
                Connect with Google OAuth and revoke access anytime.
              </div>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "20px",
                padding: "22px",
              }}
            >
              <div
                style={{
                  fontSize: "28px",
                  marginBottom: "10px",
                }}
              >
                ✅
              </div>
              <div
                className={jakarta.className}
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  marginBottom: "10px",
                }}
              >
                No automatic changes
              </div>
              <div
                style={{
                  fontSize: "17px",
                  color: "#64748b",
                  lineHeight: "1.8",
                  fontWeight: 500,
                }}
              >
                InboxShaper never auto-deletes or auto-archives your emails.
              </div>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "20px",
                padding: "22px",
              }}
            >
              <div
                style={{
                  fontSize: "28px",
                  marginBottom: "10px",
                }}
              >
                🛡️
              </div>
              <div
                className={jakarta.className}
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  marginBottom: "10px",
                }}
              >
                Privacy-first design
              </div>
              <div
                style={{
                  fontSize: "17px",
                  color: "#64748b",
                  lineHeight: "1.8",
                  fontWeight: 500,
                }}
              >
                We only access the Gmail metadata required to provide the
                product functionality.
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: "72px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              ...sectionCardStyle,
              maxWidth: "1100px",
              width: "100%",
              padding: "40px 32px 34px",
              textAlign: "center",
            }}
          >
            <div
              className={jakarta.className}
              style={{
                fontSize: "36px",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                marginBottom: "12px",
              }}
            >
              Simple, transparent pricing
            </div>

            <div
              style={{
                fontSize: "18px",
                color: "#64748b",
                lineHeight: "1.8",
                maxWidth: "760px",
                margin: "0 auto 34px",
                fontWeight: 500,
              }}
            >
              Start free to scan and review your inbox. Upgrade when you need
              full inbox cleanup power.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "24px",
                alignItems: "stretch",
                maxWidth: "860px",
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "24px",
                  padding: "30px 26px",
                  textAlign: "left",
                  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
                  opacity: 0.9,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    className={jakarta.className}
                    style={{
                      fontSize: "24px",
                      fontWeight: 800,
                      marginBottom: "10px",
                    }}
                  >
                    Free
                  </div>

                  <div
                    className={jakarta.className}
                    style={{
                      fontSize: "42px",
                      fontWeight: 800,
                      letterSpacing: "-0.04em",
                      marginBottom: "18px",
                    }}
                  >
                    $0
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      color: "#475569",
                      fontSize: "17px",
                      lineHeight: "1.8",
                      fontWeight: 500,
                    }}
                  >
                    <div>✓ Sample scan of up to 1,000 emails</div>
                    <div>✓ Up to 250 cleanup actions per week</div>
                    <div>✓ Mark emails as read (up to 250/week)</div>
                    <div>✓ Sender insights and category breakdown</div>
                    <div>✓ No automatic actions</div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "22px",
                    fontSize: "14px",
                    color: "#64748b",
                    fontWeight: 600,
                  }}
                >
                  Best for light weekly cleanup
                </div>
              </div>

              <div
                style={{
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: "24px",
                  padding: "30px 26px",
                  textAlign: "left",
                  boxShadow: "0 22px 44px rgba(15, 23, 42, 0.16)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      borderRadius: "999px",
                      background: "rgba(255,255,255,0.08)",
                      fontSize: "13px",
                      fontWeight: 800,
                      marginBottom: "12px",
                    }}
                  >
                    Most popular
                  </div>

                  <div
                    className={jakarta.className}
                    style={{
                      fontSize: "24px",
                      fontWeight: 800,
                      marginBottom: "10px",
                    }}
                  >
                    Pro
                  </div>

                  <div
                    className={jakarta.className}
                    style={{
                      fontSize: "42px",
                      fontWeight: 800,
                      letterSpacing: "-0.04em",
                      marginBottom: "18px",
                    }}
                  >
                    $6.9
                    <span
                      style={{
                        fontSize: "18px",
                        fontWeight: 700,
                        opacity: 0.8,
                        marginLeft: "4px",
                      }}
                    >
                      /month
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "12px",
                      color: "rgba(255,255,255,0.88)",
                      fontSize: "17px",
                      lineHeight: "1.8",
                      fontWeight: 500,
                    }}
                  >
                    <div>✓ Full inbox scan</div>
                    <div>✓ Unlimited cleanup actions</div>
                    <div>✓ Unlimited mark as read actions</div>
                    <div>✓ Advanced inbox analytics</div>
                    <div>✓ Faster cleanup workflow</div>
                    <div>✓ Clean your entire inbox in minutes</div>
                  </div>
                </div>

                <div style={{ marginTop: "22px" }}>
                  <div
                    style={{
                      fontSize: "14px",
                      color: "rgba(255,255,255,0.72)",
                      fontWeight: 600,
                      marginBottom: "14px",
                    }}
                  >
                    Best for full inbox control
                  </div>

                  <button
                    onClick={signInWithGoogle}
                    className={jakarta.className}
                    style={{
                      padding: "14px 18px",
                      width: "100%",
                      borderRadius: "14px",
                      border: "none",
                      background: "#ffffff",
                      color: "#0f172a",
                      cursor: "pointer",
                      fontSize: "17px",
                      fontWeight: 800,
                      boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
                    }}
                  >
                    Start Pro Plan
                  </button>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "18px",
                fontSize: "13px",
                color: "#94a3b8",
                fontWeight: 500,
              }}
            >
              No credit card required to start • Cancel anytime
            </div>
          </div>
        </section>

        <footer
          style={{
            marginTop: "44px",
            display: "flex",
            justifyContent: "center",
            gap: "24px",
            flexWrap: "wrap",
            fontSize: "15px",
          }}
        >
          <a
            href="/privacy"
            className={jakarta.className}
            style={{
              color: "#475569",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Privacy Policy
          </a>

          <a
            href="/terms"
            className={jakarta.className}
            style={{
              color: "#475569",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Terms of Service
          </a>
        </footer>
      </section>
    </main>
  );
}