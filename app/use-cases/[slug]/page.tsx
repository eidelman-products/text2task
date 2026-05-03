import type { Metadata } from "next";
import { notFound } from "next/navigation";
import UseCasePage from "@/app/components/use-cases/use-case-page";
import { getUseCaseBySlug, getUseCaseSlugs } from "@/app/lib/seo/use-cases";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://text2task.com";

export async function generateStaticParams() {
  return getUseCaseSlugs().map((slug) => ({
    slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const useCase = getUseCaseBySlug(slug);

  if (!useCase) {
    return {
      title: "Use Case Not Found | Text2Task",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonicalUrl = `${siteUrl}/use-cases/${useCase.slug}`;

  return {
    title: useCase.seoTitle,
    description: useCase.metaDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: useCase.seoTitle,
      description: useCase.metaDescription,
      url: canonicalUrl,
      siteName: "Text2Task",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: useCase.seoTitle,
      description: useCase.metaDescription,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const useCase = getUseCaseBySlug(slug);

  if (!useCase) {
    notFound();
  }

  return <UseCasePage useCase={useCase} />;
}