"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { UseCasePageData } from "@/app/lib/seo/use-cases";
import { getRelatedUseCases } from "@/app/lib/seo/use-cases";

type UseCasePageProps = {
  useCase: UseCasePageData;
};

function PriorityBadge({ priority }: { priority: "Low" | "Medium" | "High" }) {
  const className =
    priority === "High"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : priority === "Medium"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {priority}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
      {children}
    </div>
  );
}

function V5UseCasePage({
  useCase,
  relatedUseCases,
  webPageJsonLd,
  faqJsonLd,
}: {
  useCase: UseCasePageData;
  relatedUseCases: UseCasePageData[];
  webPageJsonLd: object;
  faqJsonLd: object;
}) {
  const v5 = useCase.v5;
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    alt: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (!lightboxImage) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxImage]);

  if (!v5) return null;

  const flowSteps =
    v5.flowSteps && v5.flowSteps.length === 3
      ? v5.flowSteps
      : [
          {
            title: "Client request arrives",
            description: "Messy notes, assets, details, deadline, and budget.",
          },
          {
            title: "AI extracts the work",
            description: "Tasks, deadline, budget, client details, and assets.",
          },
          {
            title: "Review and save",
            description: "A clean project plan ready to manage.",
          },
        ];

  return (
    <main className="min-h-screen bg-[#f8f7ff] text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="relative overflow-hidden border-b border-indigo-100 bg-[radial-gradient(circle_at_top_left,_#eef2ff,_transparent_34%),linear-gradient(135deg,_#ffffff_0%,_#f8f7ff_48%,_#eef2ff_100%)]">
        <div className="absolute left-[8%] top-8 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="absolute bottom-0 right-[12%] h-64 w-64 rounded-full bg-violet-200/25 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[0.94fr_1.06fr] lg:px-8 lg:py-24">
          <div className="flex flex-col justify-center">
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              {useCase.heroTitle}{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                {useCase.heroHighlight}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              {useCase.heroDescription}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-indigo-700"
              >
                <span className="text-white">{useCase.primaryCta}</span>
              </Link>

              <a
                href="#transformation"
                className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700"
              >
                <span>{useCase.secondaryCta}</span>
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white bg-white/80 p-3 shadow-2xl shadow-indigo-200/40 backdrop-blur transition duration-300 hover:-translate-y-1.5 hover:shadow-indigo-200/60">
            <button
              type="button"
              onClick={() =>
                setLightboxImage({
                  src: v5.heroImage,
                  alt: v5.heroImageAlt,
                  label: "Client request",
                })
              }
              className="group block w-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white text-left shadow-xl shadow-slate-200/70 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-100/70 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
            >
              <div className="relative overflow-hidden">
                <span className="absolute right-3 top-3 z-10 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-xs font-black text-indigo-700 shadow-lg shadow-slate-900/10 backdrop-blur transition group-hover:bg-white">
                  Click to enlarge
                </span>
                <Image
                  src={v5.heroImage}
                  alt={v5.heroImageAlt}
                  width={1672}
                  height={941}
                  priority
                  className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  sizes="(min-width: 1024px) 48vw, 100vw"
                />
              </div>
            </button>
          </div>
        </div>
      </section>

      <section id="transformation" className="mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {v5.transformationTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
            {v5.transformationDescription}
          </p>
        </div>

        <div className="relative mx-auto mt-10 grid max-w-5xl gap-7 lg:grid-cols-3 lg:gap-6">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-6 hidden h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent lg:block" />
          {flowSteps.map((step, index) => (
            <div
              key={step.title}
              className="group relative rounded-[1.5rem] px-4 py-2 text-center transition duration-300 hover:-translate-y-1"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-indigo-100 bg-white text-sm font-black text-indigo-700 shadow-xl shadow-indigo-100/80 transition duration-300 group-hover:scale-105 group-hover:shadow-indigo-200/90">
                <span className="absolute h-16 w-16 rounded-full bg-indigo-200/20 blur-2xl" />
                <span className="relative">{index + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-black text-slate-950 sm:text-lg">
                {step.title}
              </h3>
              <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-6 text-slate-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-indigo-100 bg-[radial-gradient(circle_at_top,_rgba(199,210,254,0.28),_transparent_36%),#ffffff]">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {v5.proofTitle}
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              {v5.proofDescription}
            </p>
          </div>

          <div className="mt-8 rounded-[2.25rem] border border-white bg-white/60 p-3 shadow-2xl shadow-indigo-100/50 backdrop-blur">
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            {v5.proofImages.map((image, index) => (
              <button
                key={image.src}
                type="button"
                onClick={() => setLightboxImage(image)}
                className={
                  index === 0
                    ? "group rounded-[2rem] border border-white bg-white/95 p-3 text-left shadow-2xl shadow-indigo-100/80 transition duration-300 hover:-translate-y-1.5 hover:shadow-indigo-200/80 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
                    : "group rounded-[2rem] border border-slate-200 bg-slate-50 p-3 text-left shadow-xl shadow-slate-200/70 transition duration-300 hover:-translate-y-1 hover:border-indigo-100 hover:shadow-indigo-100/70 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
                }
              >
                <div className="mb-3 flex items-center justify-between gap-3 px-2">
                  <p className="text-sm font-black text-slate-950">
                    {image.label}
                  </p>
                  <span className="text-xs font-bold text-indigo-600 opacity-80 transition group-hover:opacity-100">
                    Click to enlarge
                  </span>
                </div>
                <div className="overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={index === 0 ? 1380 : 1218}
                    height={index === 0 ? 564 : 610}
                    className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                    sizes={index === 0 ? "(min-width: 1024px) 58vw, 100vw" : "(min-width: 1024px) 36vw, 100vw"}
                  />
                </div>
              </button>
            ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {v5.manageTitle ?? "What this workflow can help organize"}
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              {v5.manageDescription ?? useCase.benefitsDescription}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {useCase.specificTasks.slice(0, 8).map((item, index) => (
              <div
                key={item}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/75 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm shadow-slate-200/40 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-100 hover:bg-white hover:shadow-lg hover:shadow-indigo-100/50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-black text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                  {index + 1}
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/70">
        <div className="mx-auto max-w-4xl px-6 py-12 sm:py-14 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {useCase.faqTitle}
            </h2>
          </div>

          <div className="mt-7 divide-y divide-slate-100 rounded-[1.75rem] border border-slate-200/60 bg-white/80 shadow-sm shadow-slate-200/40">
            {useCase.faq.map((item) => (
              <div key={item.question} className="p-4 sm:p-5">
                <h3 className="text-base font-black text-slate-950">
                  {item.question}
                </h3>
                <p className="mt-2 leading-7 text-slate-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {relatedUseCases.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 py-12 sm:py-14 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Explore nearby workflows
              </h2>
            </div>
            <Link href="/use-cases" className="text-sm font-bold text-indigo-700 hover:text-indigo-900">
              View all use cases
            </Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {relatedUseCases.map((related) => (
              <Link
                key={related.slug}
                href={`/use-cases/${related.slug}`}
                className="group rounded-[1.35rem] border border-slate-200/80 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/70"
              >
                <p className="text-sm font-bold text-indigo-700">
                  {related.audienceLabel}
                </p>
                <h3 className="mt-2 text-base font-black text-slate-950">
                  {related.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                  {related.metaDescription}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bg-slate-950 px-6 py-16 text-white sm:py-20 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            {useCase.finalCtaTitle}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            {useCase.finalCtaDescription}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-50"
            >
              <span className="text-slate-950">{useCase.finalCtaPrimary}</span>
            </Link>
            <Link
              href="/"
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              <span className="text-white">{useCase.finalCtaSecondary}</span>
            </Link>
          </div>
        </div>
      </section>

      {lightboxImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label={`${lightboxImage.label} preview`}
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative w-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-xl backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
            >
              Close
            </button>
            <div className="overflow-hidden rounded-[2rem] border border-white/15 bg-white p-2 shadow-2xl shadow-slate-950/40">
              <Image
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                width={1600}
                height={980}
                className="h-auto max-h-[82vh] w-full rounded-[1.5rem] object-contain"
                sizes="100vw"
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function UseCasePage({ useCase }: UseCasePageProps) {
  const relatedUseCases = getRelatedUseCases(useCase.relatedUseCases);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: useCase.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: useCase.seoTitle,
    description: useCase.metaDescription,
    url: `https://text2task.com/use-cases/${useCase.slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: "Text2Task",
      url: "https://text2task.com",
    },
    about: {
      "@type": "SoftwareApplication",
      name: "Text2Task",
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
    },
  };

  if (useCase.v5) {
    return (
      <V5UseCasePage
        useCase={useCase}
        relatedUseCases={relatedUseCases}
        webPageJsonLd={webPageJsonLd}
        faqJsonLd={faqJsonLd}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f7ff] text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="relative overflow-hidden border-b border-indigo-100 bg-[radial-gradient(circle_at_top_left,_#eef2ff,_transparent_34%),linear-gradient(135deg,_#ffffff_0%,_#f8f7ff_48%,_#eef2ff_100%)]">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-200/30 blur-3xl" />

        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-[1.04fr_0.96fr] lg:px-8 lg:py-24">
          <div className="relative z-10 flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm shadow-indigo-100/60 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {useCase.badge}
            </div>

            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              {useCase.heroTitle}{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                {useCase.heroHighlight}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-650 sm:text-xl">
              {useCase.heroDescription}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-indigo-700"
              >
                <span className="text-white">{useCase.primaryCta}</span>
              </Link>

              <a
                href="#example"
                className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700"
              >
                <span>{useCase.secondaryCta}</span>
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <span className="rounded-full border border-white bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                Text + screenshot extraction
              </span>
              <span className="rounded-full border border-white bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                Editable preview before saving
              </span>
              <span className="rounded-full border border-white bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                Free plan includes 30 extracts
              </span>
            </div>
          </div>

          <div className="relative z-10">
            <div className="rounded-[2rem] border border-white bg-white/85 p-4 shadow-2xl shadow-indigo-200/40 backdrop-blur">
              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-950 p-4 text-white">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
                      Client message
                    </p>
                    <p className="mt-1 text-sm text-white/70">
                      Before Text2Task
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                </div>

                <div className="rounded-2xl bg-white/8 p-4 text-sm leading-7 text-white/85">
                  “{useCase.beforeMessage}”
                </div>
              </div>

              <div className="-mt-3 rounded-[1.5rem] border border-indigo-100 bg-white p-4 shadow-xl shadow-slate-200/60">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
                      Clean task output
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      After Text2Task
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Ready to save
                  </span>
                </div>

                <div className="space-y-2">
                  {useCase.exampleTasks.slice(0, 4).map((task) => (
                    <div
                      key={`${task.task}-${task.priority}`}
                      className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-950">
                          {task.task}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {task.client} · Due {task.deadline} · {task.budget}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <PriorityBadge priority={task.priority} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="example"
        className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8"
      >
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionLabel>Problem</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {useCase.problemTitle}
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              {useCase.problemDescription}
            </p>

            <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold text-slate-950">
                What Text2Task extracts
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {useCase.extractedFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
                Real client scenario
              </p>
              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
                {useCase.scenario.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {useCase.scenario.description}
              </p>
            </div>

            <div className="grid gap-4 p-4">
              <div
                className={
                  useCase.scenario.frameType === "chat"
                    ? "rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-4"
                    : useCase.scenario.frameType === "note"
                      ? "rounded-[1.5rem] border border-amber-100 bg-amber-50/60 p-4"
                      : "rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"
                }
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">
                      {useCase.scenario.senderName}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {useCase.scenario.senderMeta}
                    </p>
                  </div>
                  <span className="rounded-full border border-white bg-white/80 px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
                    {useCase.scenario.timeLabel}
                  </span>
                </div>

                {useCase.scenario.subject ? (
                  <div className="mb-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Subject
                    </p>
                    <p className="mt-1 text-sm font-black text-slate-900">
                      {useCase.scenario.subject}
                    </p>
                  </div>
                ) : null}

                <p
                  className={
                    useCase.scenario.frameType === "chat"
                      ? "rounded-2xl bg-white px-4 py-3 text-sm font-semibold leading-7 text-slate-700 shadow-sm"
                      : "text-sm font-semibold leading-7 text-slate-700"
                  }
                >
                  {useCase.scenario.message}
                </p>

                {useCase.scenario.attachments?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {useCase.scenario.attachments.map((attachment) => (
                      <span
                        key={attachment}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm"
                      >
                        {attachment}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[1.5rem] border border-indigo-100 bg-indigo-50/70 p-4">
                <p className="text-sm font-black text-indigo-950">
                  {useCase.scenario.outcomeTitle}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {useCase.scenario.outcomeBullets.map((bullet) => (
                    <div key={bullet} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-indigo-700 shadow-sm">
                        ✓
                      </span>
                      <span className="text-sm font-semibold text-slate-700">
                        {bullet}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-indigo-100 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 sm:py-16 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:px-8">
          <div>
            <SectionLabel>Product proof</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {useCase.productProofTitle}
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              {useCase.productProofDescription}
            </p>

            <div className="mt-7 grid gap-3">
              {useCase.productProofBullets.map((bullet) => (
                <div
                  key={bullet}
                  className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500 shadow-sm shadow-indigo-300" />
                  <p className="text-sm font-semibold leading-6 text-slate-700">
                    {bullet}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white bg-white/90 p-3 shadow-2xl shadow-indigo-100/70 backdrop-blur">
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-100 bg-slate-50">
              <Image
                src={useCase.productProofImage}
                alt={useCase.productProofImageAlt}
                width={1380}
                height={831}
                className="h-auto w-full object-cover"
                sizes="(min-width: 1024px) 52vw, 100vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-indigo-100 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <SectionLabel>Workflow</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {useCase.workflowTitle}
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              {useCase.workflowDescription}
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {useCase.workflowSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                  {index + 1}
                </div>
                <h3 className="text-lg font-black text-slate-950">
                  {step.title}
                </h3>
                <p className="mt-3 leading-7 text-slate-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionLabel>Benefits</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {useCase.benefitsTitle}
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              {useCase.benefitsDescription}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {useCase.benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-black text-slate-950">
                  {benefit.title}
                </h3>
                <p className="mt-3 leading-7 text-slate-600">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 rounded-[2rem] border border-indigo-100 bg-indigo-50/70 p-6 sm:p-8">
          <h3 className="text-xl font-black text-slate-950">
            {useCase.commonTasksTitle}
          </h3>
          <div className="mt-5 flex flex-wrap gap-2">
            {useCase.specificTasks.map((task) => (
              <span
                key={task}
                className="rounded-full border border-white bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                {task}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20 lg:px-8">
          <div className="text-center">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {useCase.faqTitle}
            </h2>
          </div>

          <div className="mt-10 divide-y divide-slate-200 rounded-[2rem] border border-slate-200 bg-white">
            {useCase.faq.map((item) => (
              <div key={item.question} className="p-6">
                <h3 className="text-base font-black text-slate-950">
                  {item.question}
                </h3>
                <p className="mt-3 leading-7 text-slate-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {relatedUseCases.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <SectionLabel>Related use cases</SectionLabel>
              <h2 className="text-3xl font-black tracking-tight text-slate-950">
                Explore more workflows
              </h2>
            </div>
            <Link
              href="/use-cases"
              className="text-sm font-bold text-indigo-700 hover:text-indigo-900"
            >
              View all use cases →
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {relatedUseCases.map((related) => (
              <Link
                key={related.slug}
                href={`/use-cases/${related.slug}`}
                className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100"
              >
                <p className="text-sm font-bold text-indigo-700">
                  {related.audienceLabel}
                </p>
                <h3 className="mt-3 text-xl font-black text-slate-950">
                  {related.title}
                </h3>
                <p className="mt-3 line-clamp-3 leading-7 text-slate-600">
                  {related.metaDescription}
                </p>
                <p className="mt-5 text-sm font-bold text-slate-950 group-hover:text-indigo-700">
                  Read use case →
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bg-slate-950 px-6 py-16 text-white sm:py-20 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">
            {useCase.finalCtaEyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {useCase.finalCtaTitle}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            {useCase.finalCtaDescription}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-50"
            >
              <span className="text-slate-950">{useCase.finalCtaPrimary}</span>
            </Link>
            <Link
              href="/"
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              <span className="text-white">{useCase.finalCtaSecondary}</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
