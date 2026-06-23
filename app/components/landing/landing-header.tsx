import Image from "next/image";
import Link from "next/link";

const navigation = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Features", href: "/#features" },
  { label: "Use cases", href: "/use-cases" },
  { label: "Pricing", href: "/#pricing" },
  { label: "About", href: "/about" },
  { label: "Log in", href: "/login" },
];

export default function LandingHeader() {
  return (
    <header className="bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3.5 sm:gap-5 sm:px-6 sm:py-4 lg:px-8">
        <Link href="/" className="inline-flex items-center" aria-label="Text2Task home">
          <Image
            src="/text2task-logo.png"
            alt="Text2Task"
            width={176}
            height={48}
            priority
            className="h-auto w-[148px] sm:w-[168px]"
          />
        </Link>

        <nav
          className="hidden items-center gap-5 text-[13px] font-semibold text-slate-600 lg:flex"
          aria-label="Main navigation"
        >
          {navigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="transition hover:text-blue-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/signup"
          className="inline-flex h-[38px] items-center justify-center rounded-xl bg-blue-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:h-[42px] sm:px-5 sm:text-[13px]"
        >
          <span className="text-white">START FOR FREE</span>
        </Link>
      </div>
    </header>
  );
}
