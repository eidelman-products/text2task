import Link from "next/link";
import type { UseCase } from "@/app/lib/use-cases";
import { getUseCaseAccentClasses } from "./use-case-accent";
import UseCaseScreenshotFrame from "./use-case-screenshot-frame";

function HeroCtas({
  useCase,
  justify = "start",
}: {
  useCase: UseCase;
  justify?: "start" | "center";
}) {
  return (
    <div
      className={`mt-8 flex flex-col gap-3 sm:flex-row ${
        justify === "center" ? "sm:justify-center" : ""
      }`}
    >
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
  );
}

const headingClassName =
  "text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-[3.35rem] lg:leading-[1.02]";

export default function UseCaseHero({ useCase }: { useCase: UseCase }) {
  const variant = useCase.heroVariant ?? "split";
  const accent = getUseCaseAccentClasses(useCase.accentTone);

  if (variant === "editorial") {
    return (
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-14 sm:py-16 lg:px-8">
          <h1 className={`max-w-4xl ${headingClassName}`}>
            {useCase.hero.title}{" "}
            <span className="text-blue-600">{useCase.hero.highlight}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {useCase.hero.description}
          </p>
          <HeroCtas useCase={useCase} />
        </div>
        <div className="mx-auto max-w-5xl px-6 pb-14 sm:pb-16 lg:px-8">
          <UseCaseScreenshotFrame
            image={useCase.hero.visual}
            sizes="(min-width: 1024px) 900px, 100vw"
            priority
          />
        </div>
      </section>
    );
  }

  if (variant === "centered") {
    return (
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center sm:py-16 lg:px-8">
          <h1 className={`mx-auto max-w-3xl ${headingClassName}`}>
            {useCase.hero.title}{" "}
            <span className="text-blue-600">{useCase.hero.highlight}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {useCase.hero.description}
          </p>
          <HeroCtas useCase={useCase} justify="center" />
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-14 sm:pb-16 lg:px-8">
          <UseCaseScreenshotFrame
            image={useCase.hero.visual}
            sizes="(min-width: 1024px) 1100px, 100vw"
            priority
          />
        </div>
      </section>
    );
  }

  if (variant === "panel") {
    return (
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:py-16 lg:grid-cols-[0.62fr_1.38fr] lg:items-center lg:px-8 lg:py-20">
          <div>
            <h1 className={headingClassName}>
              {useCase.hero.title}{" "}
              <span className="text-blue-600">{useCase.hero.highlight}</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              {useCase.hero.description}
            </p>
            <HeroCtas useCase={useCase} />
          </div>

          <div>
            <p
              className={`mb-3 inline-flex items-center gap-2 rounded-full ${accent.bg} ${accent.text} px-3 py-1 text-xs font-black uppercase tracking-wide`}
            >
              Example request
            </p>
            <UseCaseScreenshotFrame
              image={useCase.hero.visual}
              sizes="(min-width: 1024px) 62vw, 100vw"
              priority
            />
          </div>
        </div>
      </section>
    );
  }

  if (variant === "reversed") {
    return (
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-20">
          <div>
            <h1 className={headingClassName}>
              {useCase.hero.title}{" "}
              <span className="text-blue-600">{useCase.hero.highlight}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              {useCase.hero.description}
            </p>
            <HeroCtas useCase={useCase} />
          </div>

          <div className="lg:order-first">
            <UseCaseScreenshotFrame
              image={useCase.hero.visual}
              sizes="(min-width: 1024px) 48vw, 100vw"
              priority
            />
          </div>
        </div>
      </section>
    );
  }

  if (variant === "overlap") {
    return (
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8 lg:py-20">
          <div>
            <h1 className={headingClassName}>
              {useCase.hero.title}{" "}
              <span className="text-blue-600">{useCase.hero.highlight}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              {useCase.hero.description}
            </p>
            <HeroCtas useCase={useCase} />
          </div>

          <div className="relative">
            <div
              aria-hidden="true"
              className={`absolute -inset-6 -z-10 rounded-[2rem] ${accent.bg} opacity-70 blur-2xl`}
            />
            <UseCaseScreenshotFrame
              image={useCase.hero.visual}
              sizes="(min-width: 1024px) 60vw, 100vw"
              priority
            />
          </div>
        </div>
      </section>
    );
  }

  if (variant === "wide") {
    return (
      <section className="border-b border-slate-200 bg-white">
        <div className={`border-b ${accent.border} ${accent.bg}`}>
          <div className="mx-auto max-w-4xl px-6 py-14 text-center sm:py-16 lg:px-8">
            <h1 className={`mx-auto max-w-3xl ${headingClassName}`}>
              {useCase.hero.title}{" "}
              <span className="text-blue-600">{useCase.hero.highlight}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              {useCase.hero.description}
            </p>
            <HeroCtas useCase={useCase} justify="center" />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
          <UseCaseScreenshotFrame
            image={useCase.hero.visual}
            sizes="(min-width: 1024px) 1100px, 100vw"
            priority
          />
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-20">
        <div>
          <h1 className={`max-w-4xl ${headingClassName}`}>
            {useCase.hero.title}{" "}
            <span className="text-blue-600">{useCase.hero.highlight}</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {useCase.hero.description}
          </p>

          <HeroCtas useCase={useCase} />
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
