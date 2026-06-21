import Image from "next/image";
import Link from "next/link";

const navigation = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Demo", href: "/#demo" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "About", href: "/about" },
  { label: "Log in", href: "/login" },
];

export default function LandingHeader() {
  return (
    <header className="bg-white">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 border-b border-slate-200/80 px-3 py-3.5 sm:gap-6 sm:px-5 sm:py-4 xl:px-0">
        <Link href="/" className="inline-flex items-center" aria-label="Text2Task home">
          <Image
            src="/text2task-logo.png"
            alt="Text2Task"
            width={176}
            height={48}
            priority
            className="h-auto w-[136px] sm:w-[154px]"
          />
        </Link>

        <nav
          className="hidden items-center gap-6 text-[13px] font-bold text-slate-600 lg:flex"
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
          className="inline-flex h-[38px] items-center justify-center rounded-xl bg-blue-600 px-3.5 text-xs font-extrabold text-white shadow-lg shadow-blue-600/15 transition hover:-translate-y-0.5 hover:bg-blue-700 sm:h-[42px] sm:px-5 sm:text-[13px]"
        >
          Try Text2Task
        </Link>
      </div>
    </header>
  );
}
