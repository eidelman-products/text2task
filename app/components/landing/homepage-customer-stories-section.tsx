import {
  getPublicCustomerStories,
  type PublicCustomerStory,
} from "@/lib/customer-stories/public-customer-stories.server";

type HomepageCustomerStoriesSectionProps = Readonly<{
  variant?: "default" | "compact";
}>;

export default async function HomepageCustomerStoriesSection({
  variant = "default",
}: HomepageCustomerStoriesSectionProps) {
  let stories: PublicCustomerStory[];

  try {
    stories = await getPublicCustomerStories(3);
  } catch (error) {
    console.error("Homepage customer stories unavailable:", error);
    return null;
  }

  if (stories.length === 0) {
    return null;
  }

  const isCompact = variant === "compact";
  const visibleStories = isCompact ? stories.slice(0, 2) : stories.slice(0, 3);
  const gridClassName =
    isCompact
      ? visibleStories.length === 1
        ? "t2t-customer-stories-grid t2t-customer-stories-grid--compact mx-auto grid max-w-md grid-cols-1 gap-4"
        : "t2t-customer-stories-grid t2t-customer-stories-grid--compact mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2"
      : visibleStories.length === 1
        ? "t2t-customer-stories-grid mx-auto grid max-w-md grid-cols-1 gap-6"
        : visibleStories.length === 2
          ? "t2t-customer-stories-grid mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2"
          : "t2t-customer-stories-grid mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section
      className={
        isCompact
          ? "t2t-customer-stories t2t-customer-stories--compact"
          : "t2t-customer-stories"
      }
      aria-labelledby="homepage-customer-stories-heading"
    >
      <style>{customerStoriesCss}</style>

      <div className="t2t-customer-stories-shell">
        <div className="t2t-customer-stories-header">
          {isCompact ? null : (
            <p className="t2t-customer-stories-eyebrow">
              What early users say
            </p>
          )}
          <h2 id="homepage-customer-stories-heading" className="homepage-heading">
            {isCompact
              ? "What early users say"
              : "Early feedback from people using Text2Task."}
          </h2>
        </div>

        <div className={gridClassName}>
          {visibleStories.map((story) => (
            <article key={story.id} className="t2t-customer-story-card">
              <span className="t2t-customer-story-quote" aria-hidden="true">
                “
              </span>
              <blockquote className="t2t-customer-story-text">
                <p>{story.feedbackText}</p>
              </blockquote>

              <div className="t2t-customer-story-footer">
                <div className="t2t-customer-story-avatar" aria-hidden="true">
                  {getInitials(story.displayName)}
                </div>

                <div className="t2t-customer-story-person">
                  <div className="t2t-customer-story-name">
                    {story.displayName}
                  </div>

                  <div className="t2t-customer-story-role">
                    {formatRoleLine(story.roleOrBusinessType)}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatRoleLine(roleOrBusinessType: string | null) {
  const cleanRole = roleOrBusinessType?.trim();

  return cleanRole ? `${cleanRole} \u00b7 Early user` : "Early user";
}

function getInitials(displayName: string) {
  const cleanName = String(displayName || "").trim();

  if (!cleanName) return "EU";

  const parts = cleanName.match(/[\p{L}\p{N}]+/gu) ?? [];
  const [firstPart, secondPart] = parts;
  const initials = `${getFirstUnicodeCharacter(firstPart)}${getFirstUnicodeCharacter(
    secondPart
  )}`.toUpperCase();

  return initials || "EU";
}

function getFirstUnicodeCharacter(value: string | undefined): string {
  if (!value) return "";

  return Array.from(value)[0] ?? "";
}

const customerStoriesCss = `
  .t2t-customer-stories {
    background: #f5f9ff;
    color: #0f172a;
  }

  .t2t-customer-stories,
  .t2t-customer-stories * {
    box-sizing: border-box;
  }

  .t2t-customer-stories-shell {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
    padding: 44px 0 28px;
  }

  .t2t-customer-stories-header {
    max-width: 620px;
    margin: 0 auto 34px;
    text-align: center;
  }

  .t2t-customer-stories-eyebrow {
    margin: 0 0 8px;
    color: #2563eb;
    font-size: 13px;
    line-height: 1.5;
    font-weight: 700;
  }

  .t2t-customer-stories-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: clamp(25px, 2.8vw, 34px);
    font-weight: 600;
  }

  .t2t-customer-stories-grid {
    align-items: stretch;
  }

  .t2t-customer-story-card {
    position: relative;
    display: flex;
    height: 100%;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    border: 1px solid #d7e6ff;
    border-radius: 18px;
    background: #ffffff;
    padding: 22px;
    box-shadow: 0 8px 24px rgba(37, 99, 235, 0.055);
  }

  .t2t-customer-story-card::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 2px;
    background: #2563eb;
    opacity: 0.72;
  }

  .t2t-customer-story-quote {
    height: 30px;
    margin-bottom: 6px;
    color: #2563eb;
    font-family: Georgia, serif;
    font-size: 42px;
    line-height: 1;
  }

  .t2t-customer-story-text {
    flex: 1;
    margin: 0;
    color: #1e293b;
    font-size: 15px;
    line-height: 1.7;
    font-weight: 500;
    overflow-wrap: anywhere;
    white-space: pre-line;
  }

  .t2t-customer-story-text p {
    margin: 0;
  }

  .t2t-customer-story-footer {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 11px;
    align-items: center;
    margin-top: auto;
    padding-top: 20px;
  }

  .t2t-customer-story-avatar {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    color: #1d4ed8;
    background: #eaf2ff;
    border: 1px solid #d7e6ff;
    font-size: 11px;
    font-weight: 700;
  }

  .t2t-customer-story-person {
    min-width: 0;
  }

  .t2t-customer-story-name {
    color: #0f172a;
    font-size: 13px;
    line-height: 1.3;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .t2t-customer-story-role {
    margin-top: 2px;
    color: #64748b;
    font-size: 11px;
    line-height: 1.45;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .t2t-customer-stories--compact {
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
  }

  .t2t-customer-stories--compact .t2t-customer-stories-shell {
    padding: 52px 0 44px;
  }

  .t2t-customer-stories--compact .t2t-customer-stories-header {
    max-width: 520px;
    margin-bottom: 18px;
  }

  .t2t-customer-stories--compact .t2t-customer-stories-header h2 {
    font-size: clamp(28px, 2.4vw, 34px);
    font-weight: 600;
  }

  .t2t-customer-stories--compact .t2t-customer-stories-grid {
    align-items: stretch;
  }

  .t2t-customer-stories--compact .t2t-customer-story-card {
    border-color: #dbe6f6;
    border-radius: 14px;
    padding: 22px;
    box-shadow: none;
  }

  .t2t-customer-stories--compact .t2t-customer-story-card::before {
    opacity: 0.5;
  }

  .t2t-customer-stories--compact .t2t-customer-story-quote {
    height: 24px;
    margin-bottom: 4px;
    font-size: 34px;
  }

  .t2t-customer-stories--compact .t2t-customer-story-footer {
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 10px;
    padding-top: 16px;
  }

  .t2t-customer-stories--compact .t2t-customer-story-avatar {
    width: 32px;
    height: 32px;
    font-size: 10px;
  }

  @media (min-width: 640px) and (max-width: 1023px) {
    .t2t-customer-stories-grid > :last-child:nth-child(odd) {
      width: min(100%, 360px);
      grid-column: 1 / -1;
      justify-self: center;
    }
  }

  @media (max-width: 640px) {
    .t2t-customer-stories-shell {
      width: min(100% - 24px, 1180px);
      padding: 38px 0 24px;
    }

    .t2t-customer-stories-grid {
      gap: 20px;
    }
  }

  @media (max-width: 560px) {
    .t2t-customer-stories-header h2 {
      font-size: 28px;
    }

    .t2t-customer-story-card {
      padding: 20px;
    }

    .t2t-customer-stories--compact .t2t-customer-stories-header h2 {
      font-size: 28px;
    }
  }

  @media (max-width: 640px) {
    .t2t-customer-stories--compact .t2t-customer-stories-shell {
      padding: 38px 0 34px;
    }

    .t2t-customer-stories--compact .t2t-customer-story-card {
      padding: 20px;
    }
  }
`;
