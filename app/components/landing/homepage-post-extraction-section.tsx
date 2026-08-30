import Link from "next/link";
import HomepageCrmImageViewer from "./homepage-crm-image-viewer";

const capabilities = [
  {
    title: "Track projects and tasks",
    description:
      "Keep deadlines, priorities, budgets, and status easy to review.",
  },
  {
    title: "Review client updates",
    description:
      "See suggested changes and apply only what you approve.",
  },
  {
    title: "Keep project history together",
    description: "Review what changed and when.",
  },
  {
    title: "Attach resources and notes",
    description:
      "Keep relevant links, files, and notes with the project.",
  },
  {
    title: "Plan client work on a calendar",
    description:
      "Plan project deadlines and scheduled client work in one calendar.",
    linkHref: "/features/project-deadline-calendar",
    linkLabel: "Explore the Work Calendar",
  },
  {
    title: "Share progress with your client",
    description:
      "Share selected status, tasks, and updates through a private link — nothing else in your workspace is shown.",
    linkHref: "/features/client-project-tracker",
    linkLabel: "Explore Client Project Tracker",
  },
] as const;

export default function HomepagePostExtractionSection() {
  return (
    <section
      id="features"
      aria-labelledby="homepage-post-extraction-heading"
      className="border-b border-slate-200/80 bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-14">
          <div>
            <h2
              id="homepage-post-extraction-heading"
              className="homepage-heading text-3xl text-slate-950 sm:text-4xl"
            >
              Everything you need after the first request
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
              Manage projects, track tasks, review client updates, and keep the
              work connected in one workspace.
            </p>

            <ol className="mt-8 border-b border-slate-200">
              {capabilities.map((capability, index) => (
                <li
                  key={capability.title}
                  className="flex min-w-0 items-start gap-4 border-t border-slate-200 py-4"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-white text-xs font-bold text-blue-700"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">
                      {capability.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {capability.description}
                    </p>
                    {"linkHref" in capability ? (
                      <Link
                        href={capability.linkHref}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
                      >
                        {capability.linkLabel}
                        <span aria-hidden="true">{"→"}</span>
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <HomepageCrmImageViewer />
        </div>
      </div>
    </section>
  );
}
