import App from "@/components/App";
import { pi, feedOut, showWithEpisodes } from "@/lib/podcastindex";
import { withTimeout } from "@/lib/lists";

// Shareable show and episode links: /show/920666 or /show/920666?ep=123456
async function loadFeed(id) {
  if (!/^\d+$/.test(String(id))) return null;
  try {
    const data = await pi("/podcasts/byfeedid", { id });
    return data && data.feed && !Array.isArray(data.feed) ? feedOut(data.feed) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const feed = await loadFeed(id);
  if (!feed) return { title: "yappr: every podcast, free" };
  const title = `${feed.title} | yappr`;
  const description = feed.description ? feed.description.slice(0, 180) : `Listen to ${feed.title} free on yappr.`;
  const images = feed.image ? [{ url: feed.image }] : [];
  return {
    title,
    description,
    alternates: { canonical: `/show/${id}` },
    openGraph: { title, description, images, type: "website", siteName: "yappr" },
    twitter: { card: "summary", title, description, images: feed.image ? [feed.image] : [] },
  };
}

// Show pages render with their episodes already in the page, plus structured data so search engines
// understand it's a podcast (and which episode, for episode links).
export default async function ShowPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const valid = /^\d+$/.test(String(id));
  const ep = sp && typeof sp.ep === "string" ? sp.ep : null;
  let initialData = {};
  let ld = null;
  if (valid) {
    const full = await withTimeout(pi("/podcasts/byfeedid", { id }).then((d) => (d && d.feed && d.feed.id ? showWithEpisodes(d.feed) : null)), 3000);
    if (full) {
      initialData = { [`/api/podcast/${id}`]: full };
      const site = process.env.NEXT_PUBLIC_SITE_URL || "https://yappr.fm";
      const series = {
        "@context": "https://schema.org", "@type": "PodcastSeries", name: full.feed.title,
        description: (full.feed.description || "").slice(0, 300), url: `${site}/show/${id}`,
        image: full.feed.image || undefined, author: full.feed.author ? { "@type": "Person", name: full.feed.author } : undefined,
      };
      const one = ep && full.episodes.find((e) => String(e.id) === ep);
      ld = one ? {
        "@context": "https://schema.org", "@type": "PodcastEpisode", name: one.title, url: `${site}/show/${id}?ep=${one.id}`,
        datePublished: one.published ? new Date(one.published * 1000).toISOString() : undefined,
        description: (one.description || "").slice(0, 300), timeRequired: one.duration ? `PT${Math.round(one.duration / 60)}M` : undefined,
        associatedMedia: { "@type": "MediaObject", contentUrl: one.audio }, partOfSeries: series,
      } : series;
    }
  }
  return (
    <>
      {ld ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} /> : null}
      <App initialShow={valid ? id : null} initialEp={ep} initialData={initialData} />
    </>
  );
}
