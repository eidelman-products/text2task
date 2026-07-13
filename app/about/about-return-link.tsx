"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type ReturnTarget = {
  href: string;
  label: string;
};

function getReturnTarget(fromParam: string | null): ReturnTarget | null {
  if (fromParam === "dashboard") {
    return {
      href: "/dashboard",
      label: "Back to dashboard",
    };
  }

  if (typeof document !== "undefined" && document.referrer) {
    try {
      const referrerUrl = new URL(document.referrer);

      if (
        referrerUrl.origin === window.location.origin &&
        referrerUrl.pathname.startsWith("/dashboard")
      ) {
        return {
          href: "/dashboard",
          label: "Back to dashboard",
        };
      }
    } catch {
      // If the referrer cannot be parsed, do not show a dashboard return link.
    }
  }

  return null;
}

export default function AboutReturnLink() {
  const searchParams = useSearchParams();
  const [target, setTarget] = useState<ReturnTarget | null>(null);

  useEffect(() => {
    setTarget(getReturnTarget(searchParams.get("from")));
  }, [searchParams]);

  if (!target) return null;

  return (
    <Link
      href={target.href}
      className="mb-6 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-sm font-black text-blue-700 transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-slate-950 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
    >
      <span aria-hidden="true">{"\u2190"}</span>
      <span>{target.label}</span>
    </Link>
  );
}
