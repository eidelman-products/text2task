import Link from "next/link";
import type { UseCase } from "@/app/lib/use-cases";

export default function UseCaseRelatedLinks({
  useCase,
}: {
  useCase: UseCase;
}) {
  const { relatedLinks } = useCase;
  if (!relatedLinks) return null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8">
      <div className="max-w-3xl">
        <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          {relatedLinks.title}
        </h2>
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {relatedLinks.links.map((link) => (
          <div key={link.href} className="border-t border-slate-200 pt-5">
            <Link
              href={link.href}
              className="text-base font-black text-blue-700 transition hover:text-blue-800 focus-visible:outline-none focus-visible:underline"
            >
              {link.label}
            </Link>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {link.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
