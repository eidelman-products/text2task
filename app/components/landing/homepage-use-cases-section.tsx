import Link from "next/link";
import {
  getUseCaseBySlug,
  type UseCaseSlug,
} from "@/app/lib/use-cases";

const selectedUseCaseSlugs = [
  "web-designers",
  "wordpress-freelancers",
  "graphic-designers",
  "social-media-managers",
  "project-managers",
  "small-agencies",
] as const satisfies readonly UseCaseSlug[];

function getSelectedUseCases() {
  return selectedUseCaseSlugs.map((slug) => {
    const useCase = getUseCaseBySlug(slug);

    if (!useCase) {
      throw new Error(`Homepage Use Case not found in registry: ${slug}`);
    }

    return useCase;
  });
}

export default function HomepageUseCasesSection() {
  const useCases = getSelectedUseCases();

  return (
    <section
      aria-labelledby="homepage-use-cases-heading"
      className="border-b border-slate-200 bg-white"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
        <div className="max-w-3xl">
          <h2
            id="homepage-use-cases-heading"
            className="homepage-heading text-3xl text-slate-950 sm:text-4xl"
          >
            Spend less time organizing client requests. More time doing the
            work.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            See how freelancers, project managers, and small teams turn emails,
            WhatsApp messages, notes, and screenshots into organized projects
            and tasks.
          </p>
        </div>

        <ul className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase) => (
            <li key={useCase.slug}>
              <Link
                href={`/use-cases/${useCase.slug}`}
                className="group flex h-full min-h-44 flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
              >
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950 transition-colors group-hover:text-blue-700">
                    {useCase.listing.label}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {useCase.listing.description}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="text-sm font-bold text-blue-700"
                >
                  View use case {"\u2192"}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex justify-center">
          <Link
            href="/use-cases"
            className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
          >
            Explore all use cases
            <span aria-hidden="true">{"\u2192"}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
