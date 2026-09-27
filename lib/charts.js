// Apple Podcasts top charts. Apple has no public per-genre charts, so for a genre we pull the country's
// top 100 and keep the shows Apple files under that genre, re-ranked 1, 2, 3…
const GENRES = new Set([
  "Comedy", "True Crime", "Technology", "Society & Culture", "Health & Fitness", "Sports", "History",
  "Business", "Science", "News", "Fiction", "Education", "Arts", "Kids & Family", "TV & Film", "Music",
  "Religion & Spirituality", "Leisure", "Government",
]);

export async function topCharts(countryIn, genreIn) {
  const country = /^[a-z]{2}$/.test(String(countryIn || "").toLowerCase()) ? String(countryIn).toLowerCase() : "us";
  const genre = GENRES.has(genreIn) ? genreIn : "";
  const res = await fetch(`https://rss.marketingtools.apple.com/api/v2/${country}/podcasts/top/${genre ? 100 : 50}/podcasts.json`, {
    cache: "no-store",
    headers: { "User-Agent": "Yappr/1.0" },
  });
  const type = res.headers.get("content-type") || "";
  if (!res.ok || !type.includes("json")) {
    const err = new Error(res.status === 404 || res.status === 500 ? "Charts aren't available for that country." : `The charts service returned ${res.status}. Try again in a bit.`);
    err.status = 502;
    throw err;
  }
  const data = await res.json();
  let rows = (data.feed && data.feed.results) || [];
  if (genre) rows = rows.filter((r) => (r.genres || []).some((g) => g && g.name === genre));
  const shows = rows.map((r, i) => ({
    rank: i + 1,
    itunesId: String(r.id),
    title: r.name || "Untitled show",
    author: r.artistName || "",
    image: (r.artworkUrl100 || "").replace(/\/\d+x\d+bb\./, "/600x600bb."),
  }));
  return { country, genre, shows };
}
