import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LandingFooter from "@/app/components/landing/landing-footer";
import LandingHeader from "@/app/components/landing/landing-header";
import UseCaseLightbox from "@/app/components/use-cases/use-case-lightbox";
import { absoluteUrl } from "@/app/lib/site-config";
import {
  getAllUseCases,
  getUseCaseCategoryGroups,
} from "@/app/lib/use-cases";

export const metadata: Metadata = {
  title: "Use Cases for Freelancers & Agencies | Text2Task",
  description:
    "See how freelancers and agencies use Text2Task to turn client messages into organized projects and tasks without manual task entry.",
  alternates: {
    canonical: "/use-cases",
  },
  openGraph: {
    title: "Use Cases for Freelancers & Agencies | Text2Task",
    description:
      "See how freelancers and agencies turn client messages into organized projects and tasks without manual task entry.",
    url: absoluteUrl("/use-cases"),
    siteName: "Text2Task",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Use Cases for Freelancers & Agencies | Text2Task",
    description:
      "Turn client messages into organized projects and tasks without manual task entry.",
  },
};

export default function UseCasesPage() {
  const useCases = getAllUseCases();
  const categoryGroups = getUseCaseCategoryGroups();

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Text2Task Use Cases",
    description:
      "Use cases for freelancers and agencies organizing client messages into projects and tasks with Text2Task.",
    url: absoluteUrl("/use-cases"),
    mainEntity: useCases.map((useCase) => ({
      "@type": "WebPage",
      name: useCase.listing.label,
      url: absoluteUrl(`/use-cases/${useCase.slug}`),
      description: useCase.listing.description,
    })),
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": absoluteUrl("/use-cases#item-list"),
    name: "Text2Task use cases for freelancers and agencies",
    numberOfItems: useCases.length,
    itemListElement: useCases.map((useCase, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: useCase.listing.label,
      url: absoluteUrl(`/use-cases/${useCase.slug}`),
    })),
  };

  return (
    <div className="min-h-screen bg-[#fbfcfe] text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <LandingHeader />

      <main>
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8 lg:py-24">
            <div className="max-w-4xl">
              <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.04]">
                Stop manually turning client messages into projects and tasks.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">
                Paste an email, WhatsApp message, screenshot, note, or client
                request. Text2Task turns it into a structured project with
                tasks, then lets you review the result before anything is
                saved.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="inline-flex min-w-[145px] items-center justify-center rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/15 transition hover:-translate-y-0.5 hover:bg-blue-700"
                >
                  Start free
                </Link>
                <Link
                  href="#use-case-categories"
                  className="inline-flex min-w-[145px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-black text-slate-900 transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700"
                >
                  Explore use cases
                </Link>
              </div>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-[1.12fr_auto_0.88fr] lg:items-center">
              <div>
                <p className="mb-3 text-sm font-black text-slate-700">
                  Client request
                </p>
                <button
                  type="button"
                  data-image-lightbox-trigger
                  data-image-lightbox-src="/landing/text2task-client-gmail-request.png"
                  data-image-lightbox-alt="Client email containing homepage revisions, a deadline, budget, and attached logo."
                  data-image-lightbox-label="Client email request"
                  data-image-lightbox-width="1672"
                  data-image-lightbox-height="941"
                  aria-label="Open preview: client email request"
                  className="block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-blue-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                >
                  <Image
                    src="/landing/text2task-client-gmail-request.png"
                    alt="Client email containing homepage revisions, a deadline, budget, and attached logo."
                    width={1672}
                    height={941}
                    priority
                    className="h-auto w-full rounded-xl border border-slate-100 object-contain"
                    sizes="(min-width: 1024px) 58vw, 100vw"
                  />
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 py-1 text-center text-sm font-black text-blue-700 lg:flex-col lg:px-1">
                <span>Text2Task organizes it</span>
                <span className="text-xl lg:hidden" aria-hidden="true">
                  {"\u2193"}
                </span>
                <span className="hidden text-xl lg:inline" aria-hidden="true">
                  {"\u2192"}
                </span>
              </div>

              <div>
                <p className="mb-3 text-sm font-black text-slate-700">
                  Structured project and tasks
                </p>
                <button
                  type="button"
                  data-image-lightbox-trigger
                  data-image-lightbox-src="/landing/text2task-ai-project-preview.png"
                  data-image-lightbox-alt="Text2Task preview of an organized website project with extracted tasks, budget, deadline, and client details."
                  data-image-lightbox-label="Structured project preview"
                  data-image-lightbox-width="959"
                  data-image-lightbox-height="909"
                  aria-label="Open preview: structured project and tasks"
                  className="block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-blue-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                >
                  <Image
                    src="/landing/text2task-ai-project-preview.png"
                    alt="Text2Task preview of an organized website project with extracted tasks, budget, deadline, and client details."
                    width={959}
                    height={909}
                    priority
                    className="h-auto w-full rounded-xl border border-slate-100 object-contain"
                    sizes="(min-width: 1024px) 38vw, 100vw"
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          id="use-case-categories"
          className="scroll-mt-6 bg-[#fbfcfe]"
        >
          <div className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8 lg:py-20">
            {categoryGroups.map(({ category, useCases: categoryUseCases }) => (
              <section
                key={category.id}
                className="grid gap-8 border-t border-slate-200 py-10 first:pt-0 lg:grid-cols-[0.7fr_1.3fr] lg:gap-14 lg:py-14"
              >
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    {category.heading}
                  </h2>
                  <p className="mt-4 max-w-md leading-7 text-slate-600">
                    {category.description}
                  </p>
                </div>

                <div className="divide-y divide-slate-200 border-y border-slate-200">
                  {categoryUseCases.map((useCase) => (
                    <Link
                      key={useCase.slug}
                      href={`/use-cases/${useCase.slug}`}
                      className="group grid gap-4 py-6 transition sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-bold text-blue-700">
                          {useCase.listing.label}
                        </p>
                        <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950 transition group-hover:text-blue-700">
                          {useCase.listing.title}
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                          {useCase.listing.description}
                        </p>
                      </div>
                      <span className="text-sm font-black text-blue-700">
                        Explore {useCase.listing.label} {"\u2192"}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                One workspace for new requests and project updates
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Start a project from a new request, or compare a follow-up with
                work that is already saved. In both workflows, you review and
                approve the result.
              </p>
            </div>

            <div className="mt-10 grid divide-y divide-slate-200 border-y border-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              <div className="py-7 lg:pr-10">
                <h3 className="text-xl font-black text-slate-950">
                  New client request
                </h3>
                <ol className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                  <li>1. Paste or upload the request.</li>
                  <li>2. Review the extracted project and tasks.</li>
                  <li>3. Save the work only after it is approved.</li>
                </ol>
              </div>

              <div className="py-7 lg:pl-10">
                <h3 className="text-xl font-black text-slate-950">
                  Existing project update
                </h3>
                <ol className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                  <li>1. Analyze a follow-up against the saved project.</li>
                  <li>2. Separate new work from requests already handled.</li>
                  <li>3. Approve only the changes that should be applied.</li>
                </ol>
              </div>
            </div>

            <Link
              href="/signup"
              className="mt-8 inline-flex items-center text-sm font-black text-blue-700 transition hover:text-slate-950"
            >
              Start organizing client work {"\u2192"}
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />

      <UseCaseLightbox />
    </div>
  );
}
