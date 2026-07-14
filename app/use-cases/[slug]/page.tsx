import type { Metadata } from "next";
import { notFound } from "next/navigation";
import UseCaseDetailPage from "@/app/components/use-cases/use-case-detail-page";
import { absoluteUrl } from "@/app/lib/site-config";
import { getUseCaseBySlug, getUseCaseSlugs } from "@/app/lib/use-cases";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

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
      title: "Use Case Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonicalPath = `/use-cases/${useCase.slug}`;
  const canonicalUrl = absoluteUrl(canonicalPath);
  const brandedTitle = `${useCase.seo.title} | Text2Task`;

  return {
    title: useCase.seo.title,
    description: useCase.seo.description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: brandedTitle,
      description: useCase.seo.description,
      url: canonicalUrl,
      siteName: "Text2Task",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: brandedTitle,
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
