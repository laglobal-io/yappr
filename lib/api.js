export async function getJSON(url, signal) {
  const res = await fetch(url, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function showUrl(showId, epId) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/show/${showId}${epId ? `?ep=${encodeURIComponent(epId)}` : ""}`;
}
