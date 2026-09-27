import App from "@/components/App";
import { publicProfile } from "@/lib/publicData";

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const p = await publicProfile(handle);
  if (!p) return { title: `@${handle} | yappr` };
  const title = `${p.display_name} (@${p.handle}) | yappr`;
  const description = p.bio || `${p.display_name} on yappr.`;
  return { title, description, alternates: { canonical: `/u/${p.handle}` }, openGraph: { title, description, images: p.avatar_url ? [{ url: p.avatar_url }] : [], siteName: "yappr" } };
}

export default async function ProfilePage({ params }) {
  const { handle } = await params;
  return <App initialProfile={/^[a-z0-9_]{3,20}$/i.test(handle) ? handle.toLowerCase() : null} />;
}
