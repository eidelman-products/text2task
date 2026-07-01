import type { ReactNode } from "react";

import HomepageDemoVideo from "./homepage-demo-video";

type HomepageDemoSectionProps = Readonly<{
  testimonials?: ReactNode | null;
}>;

const demoSteps = [
  {
    title: "Paste or upload a request",
    description:
      "Text2Task reads the request and identifies the work.",
  },
  {
    title: "Review the project draft",
    description:
      "Check the tasks, budget, deadline, priority, and client details.",
  },
  {
    title: "Edit and save",
    description: "Nothing is saved until you approve it.",
  },
] as const;

export default function HomepageDemoSection({
  testimonials = null,
}: HomepageDemoSectionProps) {
  return (
    <section
      id="demo"
      aria-labelledby="homepage-demo-heading"
      className="border-b border-slate-200/80 bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="homepage-demo-heading"
            className="homepage-heading text-3xl text-slate-950 sm:text-4xl"
          >
            See Text2Task in action
          </h2>
          <p
            id="homepage-demo-description"
            className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600"
          >
            See how Text2Task turns a client request into an organized project
            you can review and save.
          </p>
        </div>

        <ol
          id="how-it-works"
          className="mx-auto mt-8 grid max-w-5xl gap-6 lg:grid-cols-3 lg:gap-8"
        >
          {demoSteps.map((step, index) => (
            <li key={step.title} className="flex min-w-0 items-start gap-4">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-sm font-bold text-blue-700"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold text-slate-950">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {testimonials}

        <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:mt-12">
          <HomepageDemoVideo />
        </div>
      </div>
    </section>
  );
}
