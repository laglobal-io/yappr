// Finds what podcasts are talking about: names and phrases that several different shows use in
// recent episode titles. No AI needed: capitalized phrases, filtered hard for filler words,
// counted once per show, with longer phrases ("Taylor Swift") preferred over their parts ("Swift").

const FILLER = new Set(`a an the and or but nor so yet of in on at to for from by with about into over after before under
between through during without within against among per via vs v versus is are was were be been being am do does did done
has have had having will would can could should may might must shall it its it's this that these those there here what
why how when where who whom which whose i i'm me my we we're us our you you're your he him his she her they them their
not no yes all any some more most much many every each other another just only also even still really very too than
then now best top big little good great bad real true full first last next one two three four five six seven eight
nine ten part pt ep episode episodes ch chapter season s podcast pod show shows live special bonus extra edition
interview interviews conversation convo chat talk talks talking guest guests ft feat featuring with qa q a ama mailbag
update updates recap recaps review reviews preview reaction reactions reacts highlights breakdown explained analysis
news daily weekly monthly today tonight tomorrow yesterday morning evening night day days week weeks year years month
months time times hour minute minutes monday tuesday wednesday thursday friday saturday sunday january february march april
may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec
why's let's don't can't won't isn't aren't what's here's there's that's it'll you'll we'll i'll ever never always
make makes made get gets got go goes going gone come comes coming take takes know knows need needs want wants
like love hate say says said tell tells think thinks thought way ways thing things stuff people person man men woman women
life world story stories part1 part2 vol volume no ep. pt. w w/ re trailer intro introduction outro finale premiere
official hour full uncut unedited clip clips`.split(/\s+/));

const ACRONYM = /^[A-Z][A-Z0-9&]{1,5}$/; // AI, NFL, NBA, UFC, S&P
const WORD = /^[A-Z][a-zA-Z'’.-]*[a-zA-Z]$|^[A-Z][A-Z0-9&]{1,5}$/;

function tokens(title) {
  return String(title || "")
    .replace(/[“”"()[\]{}|:;!?,#…—–/\\]/g, " | ")
    .split(/\s+/)
    .map((t) => t.replace(/^['’.-]+|['’.-]+$/g, "").replace(/['’]s$/i, ""))
    .filter(Boolean);
}

// Capitalized runs of up to 4 words, trimmed of filler at both ends
function candidates(title) {
  const out = new Set();
  const toks = tokens(title);
  let run = [];
  const flush = () => {
    for (let i = 0; i < run.length; i++) {
      for (let n = 1; n <= 4 && i + n <= run.length; n++) {
        let words = run.slice(i, i + n);
        if (FILLER.has(words[0].toLowerCase()) || FILLER.has(words[words.length - 1].toLowerCase())) continue;
        if (words.length === 1) {
          const w = words[0];
          if (!ACRONYM.test(w) && (w.length < 4 || FILLER.has(w.toLowerCase()))) continue;
        }
        if (words.some((w) => /^\d+$/.test(w))) continue;
        out.add(words.join(" "));
      }
    }
    run = [];
  };
  for (const t of toks) {
    if (t === "|") { flush(); continue; }
    if (WORD.test(t) || (run.length && /^(of|the|and|&|de|la|van|von)$/i.test(t) && run.length < 3)) run.push(t);
    else flush();
  }
  flush();
  return [...out];
}

/**
 * episodes: [{ title, feedId, published }]
 * returns [{ topic, shows, recentShows, rising }] sorted by how many shows mention it
 */
export function findTopics(episodes, { now = Date.now() / 1000, minShows = 3, recentHours = 12 } = {}) {
  const seen = new Map(); // phrase(lowercase) → { label counts, feeds:Set, recentFeeds:Set }
  for (const ep of episodes) {
    const recent = now - (ep.published || 0) < recentHours * 3600;
    for (const c of candidates(ep.title)) {
      const k = c.toLowerCase();
      const e = seen.get(k) || { labels: new Map(), feeds: new Set(), recent: new Set() };
      e.labels.set(c, (e.labels.get(c) || 0) + 1);
      e.feeds.add(String(ep.feedId));
      if (recent) e.recent.add(String(ep.feedId));
      seen.set(k, e);
    }
  }
  let list = [...seen.entries()]
    .filter(([, e]) => e.feeds.size >= minShows)
    .map(([k, e]) => ({
      key: k,
      topic: [...e.labels.entries()].sort((a, b) => b[1] - a[1])[0][0],
      shows: e.feeds.size,
      recentShows: e.recent.size,
      words: k.split(" ").length,
    }));
  // Prefer "Taylor Swift" over "Swift" when the shorter one mostly appears inside the longer one
  list = list.filter((t) => !list.some((o) => o.words > t.words && (` ${o.key} `).includes(` ${t.key} `) && o.shows >= t.shows * 0.6));
  // Rising: a bigger share of its mentions landed in the last recentHours than the overall average
  const total = episodes.length || 1;
  const recentTotal = episodes.filter((e) => now - (e.published || 0) < recentHours * 3600).length || 1;
  return list
    .map((t) => ({ topic: t.topic, shows: t.shows, recentShows: t.recentShows, rising: t.recentShows >= 2 && t.recentShows / t.shows > (recentTotal / total) * 1.4 }))
    .sort((a, b) => b.shows - a.shows || b.recentShows - a.recentShows)
    .slice(0, 40);
}
