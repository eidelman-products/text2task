import type { Metadata } from "next";
import { notFound } from "next/navigation";
import UseCaseDetailPage from "@/app/components/use-cases/use-case-detail-page";
import { getUseCaseBySlug, getUseCaseSlugs } from "@/app/lib/use-cases";

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
    title: useCase.seo.title,
    description: useCase.seo.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: useCase.seo.title,
      description: useCase.seo.description,
      url: canonicalUrl,
      siteName: "Text2Task",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: useCase.seo.title,
      description: useCase.seo.description,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const useCase = getUseCaseBySlug(slug);

  if (!useCase) {
    notFound();
  }

  return <UseCaseDetailPage useCase={useCase} />;
}
