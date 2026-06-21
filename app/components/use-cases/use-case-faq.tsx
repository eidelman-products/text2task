import type { UseCase } from "@/app/lib/use-cases";

export default function UseCaseFaq({ useCase }: { useCase: UseCase }) {
  const { faq } = useCase;
  if (!faq) return null;

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-14 sm:py-16 lg:px-8">
        <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          {faq.title}
        </h2>

        <div className="mt-9 divide-y divide-slate-200 border-y border-slate-200">
          {faq.items.map((item) => (
            <div key={item.question} className="py-6">
              <h3 className="text-base font-black text-slate-950">
                {item.question}
              </h3>
              <p className="mt-3 leading-7 text-slate-600">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
