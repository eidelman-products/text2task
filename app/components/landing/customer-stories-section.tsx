"use client";

import { useEffect, useState } from "react";

type CustomerStory = {
  id: string;
  displayName: string;
  roleOrBusinessType: string | null;
  rating: number | null;
  feedbackText: string;
  isFeatured?: boolean;
  approvedAt?: string | null;
  createdAt?: string | null;
};

type CustomerStoriesResponse = {
  stories?: CustomerStory[];
};

export default function CustomerStoriesSection() {
  const [stories, setStories] = useState<CustomerStory[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadStories() {
      try {
        const response = await fetch("/api/customer-stories/public", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          if (isMounted) {
            setStories([]);
            setIsLoaded(true);
          }

          return;
        }

        const data = (await response.json()) as CustomerStoriesResponse;

        if (!isMounted) return;

        const safeStories = Array.isArray(data.stories)
          ? data.stories.filter(
              (story) =>
                story &&
                typeof story.id === "string" &&
                typeof story.displayName === "string" &&
                typeof story.feedbackText === "string"
            )
          : [];

        setStories(safeStories);
        setIsLoaded(true);
      } catch (error) {
        console.error("Failed to load customer stories:", error);

        if (isMounted) {
          setStories([]);
          setIsLoaded(true);
        }
      }
    }

    void loadStories();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isLoaded || stories.length === 0) {
    return null;
  }

  const visibleStories = stories.slice(0, 3);
  const gridClassName =
    visibleStories.length >= 3
      ? "t2t-customer-stories-grid t2t-customer-stories-grid-three"
      : "t2t-customer-stories-grid t2t-customer-stories-grid-two";

  return (
    <section className="t2t-customer-stories" aria-labelledby="customer-stories-title">
      <style>{customerStoriesCss}</style>

      <div className="t2t-customer-stories-shell">
        <div className="t2t-customer-stories-header">
          <h2 id="customer-stories-title">What our users are saying</h2>
          <p>Real feedback from people organizing client work with Text2Task.</p>
        </div>

        <div className={gridClassName}>
          {visibleStories.map((story) => (
            <article key={story.id} className="t2t-customer-story-card">
              <div className="t2t-customer-story-quote" aria-hidden="true">
                "
              </div>

              <p className="t2t-customer-story-text">{story.feedbackText}</p>

              <div className="t2t-customer-story-footer">
                <div className="t2t-customer-story-avatar">
                  {getInitials(story.displayName)}
                </div>

                <div className="t2t-customer-story-person">
                  <div className="t2t-customer-story-name">
                    {story.displayName}
                  </div>

                  {story.roleOrBusinessType ? (
                    <div className="t2t-customer-story-role">
                      {story.roleOrBusinessType}
                    </div>
                  ) : null}
                </div>

                {typeof story.rating === "number" ? (
                  <div
                    className="t2t-customer-story-rating"
                    aria-label={`${story.rating} out of 5 rating`}
                  >
                    {story.rating}/5
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function getInitials(displayName: string) {
  const cleanName = String(displayName || "").trim();

  if (!cleanName) return "TT";

  const parts = cleanName.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const customerStoriesCss = `
  .t2t-customer-stories {
    padding: 34px 0 36px;
  }

  .t2t-customer-stories-shell {
    max-width: 940px;
    margin: 0 auto;
  }

  .t2t-customer-stories-header {
    max-width: 620px;
    margin: 0 auto 22px;
    text-align: center;
  }

  .t2t-customer-stories-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: clamp(25px, 2.8vw, 34px);
    line-height: 1.08;
    letter-spacing: -0.038em;
    font-weight: 950;
  }

  .t2t-customer-stories-header p {
    margin: 8px auto 0;
    max-width: 440px;
    color: #64748b;
    font-size: 13px;
    line-height: 1.5;
    font-weight: 680;
  }

  .t2t-customer-stories-grid {
    display: grid;
    gap: 16px;
    align-items: stretch;
    margin: 0 auto;
  }

  .t2t-customer-stories-grid-two {
    max-width: 760px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .t2t-customer-stories-grid-three {
    max-width: 920px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .t2t-customer-story-card {
    position: relative;
    min-width: 0;
    overflow: hidden;
    border-radius: 16px;
    border: 1px solid rgba(226, 232, 240, 0.92);
    background:
      linear-gradient(90deg, rgba(96, 165, 250, 0.72), rgba(191, 219, 254, 0.18)) 0 0 / 100% 2px no-repeat,
      #ffffff;
    box-shadow: 0 7px 24px rgba(15, 23, 42, 0.04);
    padding: 16px 16px 14px;
    transition:
      transform 180ms ease,
      border-color 180ms ease,
      box-shadow 180ms ease;
  }

  .t2t-customer-story-card:hover {
    transform: translateY(-2px);
    border-color: rgba(147, 197, 253, 0.88);
    box-shadow: 0 12px 32px rgba(37, 99, 235, 0.07);
  }

  .t2t-customer-story-quote {
    width: auto;
    height: 20px;
    margin-bottom: 9px;
    display: grid;
    justify-content: start;
    color: #60a5fa;
    background: transparent;
    border: 0;
    font-size: 24px;
    line-height: 1;
    font-weight: 950;
  }

  .t2t-customer-story-text {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 58px;
    margin: 0;
    color: #1e293b;
    font-size: 13px;
    line-height: 1.52;
    font-weight: 610;
  }

  .t2t-customer-story-footer {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    gap: 9px;
    align-items: center;
    margin-top: 10px;
    padding-top: 9px;
    border-top: 1px solid rgba(226,232,240,0.58);
  }

  .t2t-customer-story-avatar {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    color: #ffffff;
    background: #2563eb;
    font-size: 10px;
    font-weight: 950;
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.14);
  }

  .t2t-customer-story-person {
    min-width: 0;
  }

  .t2t-customer-story-name {
    color: #0f172a;
    font-size: 12.5px;
    line-height: 1.18;
    font-weight: 950;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .t2t-customer-story-role {
    margin-top: 2px;
    color: #64748b;
    font-size: 11px;
    line-height: 1.3;
    font-weight: 740;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .t2t-customer-story-rating {
    min-width: 32px;
    height: 22px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #475569;
    background: #f8fafc;
    border: 1px solid rgba(203, 213, 225, 0.82);
    font-size: 10px;
    font-weight: 900;
  }

  @media (max-width: 760px) {
    .t2t-customer-stories-grid,
    .t2t-customer-stories-grid-two,
    .t2t-customer-stories-grid-three {
      max-width: 520px;
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 560px) {
    .t2t-customer-stories {
      padding: 28px 0 30px;
    }

    .t2t-customer-stories-header h2 {
      font-size: 28px;
    }

    .t2t-customer-story-card {
      padding: 15px;
      border-radius: 15px;
    }
  }
`;
