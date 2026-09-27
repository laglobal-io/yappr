// Read-only lookups for page titles and link previews (runs on the server, public data only)
async function rest(path) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 300 } });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}
export const publicPost = (id) => rest(`posts?id=eq.${Number(id)}&select=body,attachment,author:profiles!posts_user_id_fkey(handle,display_name)`);
export const publicProfile = (handle) => rest(`profiles?handle=eq.${encodeURIComponent(String(handle).toLowerCase())}&select=handle,display_name,bio,avatar_url,verified`);
