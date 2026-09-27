import App from "@/components/App";
import { publicPost } from "@/lib/publicData";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const p = /^\d+$/.test(id) ? await publicPost(id) : null;
  if (!p) return { title: "Post | yappr" };
  const who = p.author ? `${p.author.display_name} (@${p.author.handle})` : "Someone";
  const about = p.attachment && p.attachment.ep ? ` on "${p.attachment.ep.title}"` : "";
  const title = `${who}${about} | yappr`;
  const description = (p.body || "Listen on yappr").slice(0, 180);
  const image = p.attachment && p.attachment.show && p.attachment.show.image;
  return { title, description, openGraph: { title, description, images: image ? [{ url: image }] : [], siteName: "yappr" } };
}

export default async function PostPage({ params }) {
  const { id } = await params;
  return <App initialPost={/^\d+$/.test(id) ? id : null} />;
}
