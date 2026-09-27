import { headers, cookies } from "next/headers";
import App from "@/components/App";
import { findCountry, isCountry } from "@/lib/countries";
import { trendingFeeds, risingShows, withTimeout } from "@/lib/lists";
import { topCharts } from "@/lib/charts";

// Home. The server fetches the first shelves (Top, Trending, Climbing fast) while building the page, so
// shows appear immediately and search engines can see them. Anything slow is skipped and loads in the browser.
export default async function Home() {
  const h = await headers();
  const c = await cookies();
  const guess = (h.get("x-vercel-ip-country") || "us").toLowerCase();
  const country = isCountry(guess) ? guess : "us";
  const lang = findCountry(country).lang;
  const [trending, charts, rising] = await Promise.all([
    withTimeout(trendingFeeds("")),
    withTimeout(topCharts(country, "")),
    withTimeout(risingShows(lang, "")),
  ]);
  const initialData = {};
  if (trending) initialData["/api/trending"] = { feeds: trending };
  if (charts) initialData[`/api/charts?country=${country}`] = charts;
  if (rising) initialData[`/api/rising?lang=${lang}`] = { shows: rising };
  return <App initialData={initialData} initialCountry={country} returning={c.get("yr")?.value === "1"} />;
}
