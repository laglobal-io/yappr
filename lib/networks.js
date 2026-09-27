// Major US radio groups, spotted from a station's name, website, tags or stream address.
// This is a best-effort match on public directory data, not an official ownership list.
// Upgrade path: match call letters against the FCC's public station ownership data.
export const NETWORKS = [
  { name: "iHeart", match: /iheart|ihrhls|revma\.ihrhls/i },
  { name: "Audacy", match: /audacy|amperwave|\bradio\.com\b/i },
  { name: "Cumulus", match: /cumulus/i },
  { name: "Beasley", match: /beasley|\bbbgi\b/i },
];

export function networkOf(s) {
  const hay = [s.name, s.homepage, s.url_resolved, s.url, s.tags].filter(Boolean).join(" ");
  const n = NETWORKS.find((x) => x.match.test(hay));
  return n ? n.name : "";
}
