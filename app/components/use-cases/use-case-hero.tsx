import Link from "next/link";
import type { UseCase } from "@/app/lib/use-cases";
import UseCaseScreenshotFrame from "./use-case-screenshot-frame";

export default function UseCaseHero({ useCase }: { useCase: UseCase }) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-20">
        <div>
          <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-[3.35rem] lg:leading-[1.02]">
            {useCase.hero.title}{" "}
            <span className="text-blue-600">{useCase.hero.highlight}</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {useCase.hero.description}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={useCase.hero.primaryCta.href}
              className="inline-flex min-w-[150px] items-center justify-center rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/15 transition hover:-translate-y-0.5 hover:bg-blue-700"
            >
              <span className="text-white">{useCase.hero.primaryCta.label}</span>
            </Link>

            <a
              href={useCase.hero.secondaryCta.href}
              className="inline-flex min-w-[150px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-black text-slate-900 transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700"
            >
              <span>{useCase.hero.secondaryCta.label}</span>
            </a>
          </div>
        </div>

        <UseCaseScreenshotFrame
          image={useCase.hero.visual}
          sizes="(min-width: 1024px) 52vw, 100vw"
          priority
        />
      </div>
    </section>
  );
}
