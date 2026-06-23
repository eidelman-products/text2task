const trustItems = [
  {
    label: "START FOR FREE",
    description: "30 AI extracts included.",
  },
  {
    label: "STOP RETYPING REQUESTS",
    description: "Turn client messages into reviewable project drafts.",
  },
  {
    label: "BUILT-IN PROJECT CRM",
    description: "Keep projects, tasks, updates, and resources together.",
  },
] as const;

export default function HomepageTrustStrip() {
  return (
    <section
      aria-label="Text2Task product assurances"
      className="border-b border-slate-200/80 bg-white"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-8 gap-y-6 px-4 py-7 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {trustItems.map((item) => (
          <div key={item.label} className="min-w-0 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
              {item.label}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {item.description}
            </p>
          </div>
        ))}

        <div className="min-w-0 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
            REAL SUPPORT
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Get help at{" "}
            <a
              href="mailto:support@text2task.com"
              className="font-bold text-blue-700 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-800 focus:outline-none focus-visible:rounded-sm focus-visible:ring-4 focus-visible:ring-blue-100"
            >
              support@text2task.com
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
