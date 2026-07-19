import HomepageWhyImageLightbox from "./homepage-why-image-lightbox.client";

const benefitRows = [
  "Stop retyping requests into your CRM",
  "Keep deadlines, priorities, and budgets visible",
  "Review everything before anything is saved",
] as const;

export default function HomepageWhySection() {
  return (
    <section
      aria-labelledby="homepage-why-heading"
      className="border-b border-slate-200/80 bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 xl:max-w-[96rem]">
        <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <div>
            <h2
              id="homepage-why-heading"
              className="homepage-heading text-3xl text-slate-950 sm:text-4xl"
            >
              Client requests are already written. Why are you typing them
              again?
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Requests arrive through WhatsApp, email, screenshots, voice
              notes, and project briefs. Before the real work begins,
              someone still has to read everything, identify the tasks,
              find the deadlines and priorities, and enter it all into a
              CRM or task tool.
            </p>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Text2Task turns that scattered information into a structured
              project draft you can review before saving.
            </p>

            <ul className="mt-8 space-y-3">
              {benefitRows.map((row) => (
                <li key={row} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 text-base font-bold text-blue-600"
                  >
                    {"✓"}
                  </span>
                  <span className="text-base font-semibold leading-6 text-slate-950">
                    {row}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto w-full max-w-2xl lg:max-w-none">
            <HomepageWhyImageLightbox
              src="/landing/text2task-scattered-client-requests-to-project-draft-cutout.png"
              alt="Scattered client requests organized into a structured Text2Task project draft"
              width={1535}
              height={1024}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
