import App from "@/components/App";

// Shareable, searchable topic pages: /topic/AI, /topic/Federal%20Reserve
export async function generateMetadata({ params }) {
  const { q } = await params;
  const topic = decodeURIComponent(q).slice(0, 60);
  const title = `${topic} podcasts: the latest episodes | yappr`;
  const description = `What podcasts are saying about ${topic} right now. Listen free on yappr.`;
  return { title, description, alternates: { canonical: `/topic/${encodeURIComponent(topic)}` }, openGraph: { title, description, type: "website", siteName: "yappr" } };
}

export default async function TopicPage({ params }) {
  const { q } = await params;
  return <App initialTopic={decodeURIComponent(q).slice(0, 60)} />;
}
