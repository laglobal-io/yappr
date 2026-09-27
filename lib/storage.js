// Per-browser memory: resume positions, finished episodes and recently played.
const KEY = "yappr:store:v2";
const empty = () => ({ resume: {}, played: {}, recent: [] });

export function loadStore() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "null");
    if (data && typeof data === "object") return { ...empty(), ...data };
  } catch {
    /* storage unavailable or corrupted */
  }
  return empty();
}

export function saveStore(store) {
  if (!store) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked */
  }
}
