import type { Metadata } from "next";

import { ShareView } from "./share-view.client";

/*
  Phase 3 -- the public Client Share page. A DATA-FREE server shell: this
  file performs no Supabase call, no project fetch, and no fragment read
  of any kind (the server never receives the #secret -- fragments are
  never sent in the HTTP request by any browser). The only thing this
  Server Component knows is the publicId already present in the URL
  path, which it hands to the client component to drive the entire
  fragment-exchange/session/PIN/projection flow after mount.

  Per-page `robots` metadata is redundant-by-design defense in depth
  alongside app/robots.ts's own `/share/` disallow entry and proxy.ts's
  X-Robots-Tag header on this route -- matching the repository's existing
  belt-and-suspenders precedent for its one other sensitive page
  (/homepage-demo/review).
*/

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{ publicId: string }>;
};

export default async function SharePage({ params }: SharePageProps) {
  const { publicId } = await params;

  return <ShareView publicId={publicId} />;
}
