import {
  getPublicCustomerStories,
  type PublicCustomerStory,
} from "@/lib/customer-stories/public-customer-stories.server";

export default async function HomepageCustomerStoriesSection() {
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

  const visibleStories = stories.slice(0, 2);

  return (
    <section
      className="border-b border-slate-200/80 bg-white"
      aria-labelledby="homepage-customer-stories-heading"
    >
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="homepage-customer-stories-heading"
            className="homepage-heading text-[1.75rem] text-slate-950 sm:text-3xl"
          >
            What users say
          </h2>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-10">
          {visibleStories.map((story, index) => (
            <article
              key={story.id}
              className={`min-w-0 border-t border-slate-200 pt-5 ${
                index > 0 ? "md:border-l md:border-t-0 md:pl-10" : ""
              }`}
            >
              <span
                className="block text-4xl leading-none text-blue-600/50"
                aria-hidden="true"
              >
                &ldquo;
              </span>
              <blockquote className="mt-2 text-base leading-7 text-slate-700">
                <p>{story.feedbackText}</p>
              </blockquote>

              <footer className="mt-5 flex min-w-0 items-center gap-3">
                <div
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-blue-100 bg-blue-50 text-[0.65rem] font-bold text-blue-700"
                  aria-hidden="true"
                >
                  {getInitials(story.displayName)}
                </div>

                <div className="min-w-0">
                  <div className="break-words text-sm font-bold leading-5 text-slate-950">
                    {story.displayName}
                  </div>
                  {formatRoleLine(story.roleOrBusinessType) ? (
                    <div className="mt-0.5 break-words text-xs font-semibold leading-5 text-slate-500">
                      {formatRoleLine(story.roleOrBusinessType)}
                    </div>
                  ) : null}
                </div>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatRoleLine(roleOrBusinessType: string | null): string | null {
  const cleanRole = roleOrBusinessType?.trim();

  return cleanRole ? cleanRole : null;
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
