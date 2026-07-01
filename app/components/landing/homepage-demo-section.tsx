import HomepageDemoVideo from "./homepage-demo-video";

const demoSteps = [
  {
    title: "Paste or upload a request",
    description:
      "Text2Task reads the request and identifies the work.",
  },
  {
    title: "Review the project",
    description:
      "Check the tasks, budget, deadline, priority, and client details.",
  },
  {
    title: "Edit and save",
    description: "Nothing is saved until you approve it.",
  },
] as const;

export default function HomepageDemoSection() {
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
            See the complete workflow
          </h2>
          <p
            id="homepage-demo-description"
            className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600"
          >
            Watch a client request move from message to reviewed project and
            organized tasks.
          </p>
        </div>

        <ol
          id="how-it-works"
          className="mx-auto mt-8 grid max-w-5xl gap-7 lg:grid-cols-3 lg:gap-10"
        >
          {demoSteps.map((step, index) => (
            <li
              key={step.title}
              className="relative min-w-0 border-t border-slate-200 pt-5"
            >
              <div className="text-sm font-bold tracking-[0.18em] text-blue-600">
                {String(index + 1).padStart(2, "0")}
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-950">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {step.description}
              </p>
              {index < demoSteps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-[-1.6rem] top-5 hidden text-2xl font-light leading-none text-blue-300 lg:block"
                >
                  &rarr;
                </span>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:mt-10">
          <HomepageDemoVideo />
        </div>
      </div>
    </section>
  );
}
