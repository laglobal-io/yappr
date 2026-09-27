const PAIRS = [
  ["#FF5FA2", "#7B3FF2"], ["#5B7CFF", "#141A46"], ["#00C2A8", "#0B5CAD"], ["#FF8A5B", "#E0306B"],
  ["#5BC0EB", "#2E4DA7"], ["#FFB020", "#D6451B"], ["#2BD17E", "#0E7A5F"], ["#B388FF", "#4527A0"],
  ["#FF6FD8", "#3813C2"], ["#FF4F4F", "#6A11CB"],
];

// Stable brand colors per show, used for fallback artwork and the player backdrop.
export function colorsFor(id) {
  const s = String(id ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return PAIRS[Math.abs(h) % PAIRS.length];
}

export function initials(title = "") {
  const words = String(title)
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(/\s+/)
    .filter((w) => w && !/^(the|a|an)$/i.test(w));
  if (!words.length) return "y";
  return (words[0][0] + (words[1] ? words[1][0] : words[0][1] || "")).toLowerCase();
}

export function clock(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
}

export function length(sec) {
  const m = Math.round((sec || 0) / 60);
  if (!m) return "";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}`;
}

export function ago(unixSeconds) {
  if (!unixSeconds) return "";
  const days = Math.floor((Date.now() / 1000 - unixSeconds) / 86400);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
