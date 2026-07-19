import HomepageCtaLink from "./homepage-cta-link.client";
import HomepageTrackedAnchor from "./homepage-tracked-anchor.client";

const plans = [
  {
    name: "Free",
    price: "$0",
    features: [
      "30 total AI extracts",
      "Text and image extraction",
      "Review and edit before saving",
      "Project CRM workspace",
      "Client updates and history",
      "Resource attachments",
      "Deadlines, priorities, budgets, and status tracking",
    ],
    cta: "CREATE FREE WORKSPACE",
    helper:
      "Create your workspace with Google or email. No credit card required.",
    href: "/signup",
    featured: false,
  },
  {
    name: "Pro",
    price: "$12.90",
    features: [
      "Unlimited AI extracts",
      "Text and image extraction",
      "Review and edit before saving",
      "Project CRM workspace",
      "Client updates and history",
      "Resource attachments",
      "Deadlines, priorities, budgets, and status tracking",
      "CSV export",
    ],
    cta: "START PRO",
    helper: "Create your account and continue to checkout.",
    href: "/api/billing/start-pro",
    featured: true,
  },
] as const;

export default function HomepagePricingSection() {
  return (
    <section id="pricing" aria-labelledby="homepage-pricing-heading" className="bg-white">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="homepage-pricing-heading"
            className="homepage-heading text-3xl text-slate-950 sm:text-4xl"
          >
            Start free. Upgrade when you need more.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Every plan includes the full Text2Task workspace. Pro adds unlimited
            extraction and CSV export.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl items-stretch gap-6 lg:grid-cols-2">
          {plans.map((plan) => {
            const ctaClassName = `mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-xl border px-5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4 ${
              plan.featured
                ? "border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700"
                : "border-blue-300 bg-white text-blue-700 hover:border-blue-400 hover:bg-blue-50"
            }`;
            const cardClassName = `flex h-full flex-col rounded-2xl border p-6 transition-all duration-200 ease-out hover:-translate-y-1 focus-within:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none sm:p-7 ${
              plan.featured
                ? "border-blue-300 bg-blue-50/40 hover:border-blue-400 hover:shadow-[0_18px_42px_rgba(30,64,175,0.16)] focus-within:border-blue-400 focus-within:shadow-[0_18px_42px_rgba(30,64,175,0.16)]"
                : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_16px_34px_rgba(15,23,42,0.10)] focus-within:border-blue-200 focus-within:shadow-[0_16px_34px_rgba(15,23,42,0.10)]"
            }`;

            return (
              <article
                key={plan.name}
                className={cardClassName}
              >
                <h3 className="text-xl font-semibold text-slate-950">
                  {plan.name}
                </h3>

                <div className="mt-5 flex items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                    {plan.price}
                  </span>
                  <span className="pb-1 text-sm font-bold text-slate-500">
                    /month
                  </span>
                </div>

                <ul className="mt-7 flex-1 space-y-2.5 text-sm font-medium leading-6 text-slate-700">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <span aria-hidden="true" className="text-blue-600">
                        {"\u2713"}
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.featured ? (
                  <HomepageTrackedAnchor
                    href={plan.href}
                    className={ctaClassName}
                    trackingEvent="homepage_pro_plan_click"
                  >
                    <span className="text-white">{plan.cta}</span>
                  </HomepageTrackedAnchor>
                ) : (
                  <HomepageCtaLink
                    href={plan.href}
                    prefetch={false}
                    className={ctaClassName}
                    trackingEvent="homepage_free_plan_click"
                  >
                    {plan.cta}
                  </HomepageCtaLink>
                )}
                <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">
                  {plan.helper}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
