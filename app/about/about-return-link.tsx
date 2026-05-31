"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type ReturnTarget = {
  href: string;
  label: string;
};

function getReturnTarget(fromParam: string | null): ReturnTarget {
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
      // If the referrer cannot be parsed, fall back to the public landing page.
    }
  }

  return {
    href: "/",
    label: "Back to landing page",
  };
}

export default function AboutReturnLink() {
  const searchParams = useSearchParams();
  const [target, setTarget] = useState<ReturnTarget>({
    href: "/",
    label: "Back to landing page",
  });

  useEffect(() => {
    setTarget(getReturnTarget(searchParams.get("from")));
  }, [searchParams]);

  return (
    <Link
      href={target.href}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/85 px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm shadow-slate-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
    >
      <span aria-hidden="true">←</span>
      <span>{target.label}</span>
    </Link>
  );
}