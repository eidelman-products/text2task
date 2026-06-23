const faqs = [
  {
    question: "Do I need to connect WhatsApp or Gmail?",
    answer:
      "No. Paste the message or email into Text2Task, or upload a screenshot. Text2Task does not need access to your inbox or WhatsApp account.",
  },
  {
    question: "Can Text2Task read screenshots?",
    answer:
      "Yes. Upload a screenshot or image of a client request, then review the extracted project details and tasks before saving anything.",
  },
  {
    question: "Can I edit the project before saving it?",
    answer:
      "Yes. Text2Task creates a reviewable draft. You can edit the project details and tasks before anything is saved to your workspace.",
  },
  {
    question: "Does Text2Task change my projects automatically?",
    answer:
      "No. You stay in control: Text2Task suggests the revisions, and only the changes you approve are applied.",
  },
  {
    question: "What happens after my 30 free extracts?",
    answer:
      "New AI extraction pauses after you use all 30 free extracts. Your saved workspace remains available, and you can upgrade to Pro for unlimited text and image extraction.",
  },
  {
    question: "Do I need another project-management tool?",
    answer:
      "Not necessarily. Text2Task includes a built-in project CRM for projects, tasks, deadlines, priorities, client updates, history, and resources. It does not automatically sync with external tools.",
  },
] as const;

export default function HomepageFaqSection() {
  return (
    <section id="faq" aria-labelledby="homepage-faq-heading" className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20 lg:px-8">
        <div className="max-w-3xl">
          <h2
            id="homepage-faq-heading"
            className="homepage-heading text-3xl text-slate-950 sm:text-4xl"
          >
            Questions before you start
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Clear answers about turning client requests into projects,
            reviewing changes, and getting started free.
          </p>
        </div>

        <div className="mt-9 space-y-3">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-xl border border-slate-200 bg-white open:border-blue-200 open:bg-blue-50/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 rounded-xl px-5 py-4 text-base font-semibold leading-7 text-slate-950 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:px-6 sm:py-5 sm:text-lg [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span>
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-lg font-medium leading-none text-blue-700 group-open:border-blue-200 group-open:bg-white"
                >
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">{"\u2212"}</span>
                </span>
              </summary>
              <p className="max-w-3xl px-5 pb-5 text-sm leading-7 text-slate-600 sm:px-6 sm:pb-6 sm:text-base">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
