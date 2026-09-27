import App from "@/components/App";
import { pi, feedOut } from "@/lib/podcastindex";

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
    openGraph: { title, description, images, type: "website", siteName: "yappr" },
    twitter: { card: "summary", title, description, images: feed.image ? [feed.image] : [] },
  };
}

export default async function ShowPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const valid = /^\d+$/.test(String(id));
  const ep = sp && typeof sp.ep === "string" ? sp.ep : null;
  return <App initialShow={valid ? id : null} initialEp={ep} />;
}
