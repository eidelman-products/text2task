import type { UseCase } from "@/app/lib/use-cases";

export default function UseCaseCapabilities({ useCase }: { useCase: UseCase }) {
  const { capabilities } = useCase;
  if (!capabilities) return null;

  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 sm:py-16 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:px-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {capabilities.title}
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            {capabilities.description}
          </p>
        </div>

        <ul className="grid gap-x-10 sm:grid-cols-2">
          {capabilities.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 border-t border-slate-200 py-3.5 text-sm font-bold leading-6 text-slate-700"
            >
              <span aria-hidden="true" className="font-black text-blue-600">
                {"\u2713"}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
