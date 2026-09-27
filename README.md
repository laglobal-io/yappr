# yappr

Every podcast, free. One short ad before and after, never in the middle.

A Next.js web app that searches and plays any podcast using the free [Podcast Index API](https://podcastindex.org), with pre-roll and post-roll audio ads served over VAST (AdsWizz-compatible).

## Launch it (about 15 minutes)

### 1. Get your free Podcast Index keys
Sign up at https://api.podcastindex.org/signup. You'll get an **API Key** and an **API Secret** by email.

### 2. Put the code on GitHub
1. Create a new repository at https://github.com/new (for example `yappr`). Keep it private if you like.
2. On the new repo's page, click **uploading an existing file**.
3. Drag in **everything inside this folder** (not the folder itself), then click **Commit changes**.

Files starting with a dot (`.gitignore`, `.env.example`) can be hidden on Mac and Windows. On a Mac, press `Cmd + Shift + .` in Finder to show them. They're helpful but not required to launch.

### 3. Deploy on Vercel (free tier works)
1. Go to https://vercel.com/new and sign in with GitHub.
2. Import your `yappr` repository. Vercel detects Next.js automatically.
3. Open **Environment Variables** and add:
   - `PODCASTINDEX_KEY` = your API key
   - `PODCASTINDEX_SECRET` = your API secret
4. Click **Deploy**. In a minute or two you'll get a live URL.

To use your own domain (like yappr.fm), open the project in Vercel, then **Settings → Domains**.

## Accounts and new-episode alerts (optional, about 20 minutes)

Everything works without this. Once set up, a **Sign in** button appears: people can sign in with email or Google, their favorites sync across devices, and they can turn on alerts for new episodes from shows they've favorited.

### 1. Create the database (Supabase, free)
1. Sign up at https://supabase.com and create a new project. Save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and click **Run**.
3. Open **Authentication → URL Configuration**. Set **Site URL** to your live address (for example `https://yappr.fm`). Under **Redirect URLs**, add `https://yappr.fm/**` and your Vercel address (for example `https://yappr.vercel.app/**`).
4. Supabase's built-in email sender only allows a few emails per hour. Before launch, connect your own email service under **Authentication → Emails → SMTP settings** (Resend, Postmark and SendGrid all work).
5. For **Continue with Google**: open **Authentication → Sign In / Providers → Google**, turn it on, and follow the link there to create a Google OAuth client. Paste the Client ID and Secret back into Supabase. You can skip this at first; email sign-in works on its own.

### 2. Create the alert keys
On a computer with Node.js installed, run this in the project folder:

```bash
node scripts/generate-vapid-keys.mjs
```

It prints two lines. Keep the private one secret.

### 3. Add the settings to Vercel
In Vercel → your project → **Settings → Environment Variables**, add these for **Production** (and Preview):

| Name | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page: the **anon** (or **publishable**) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page: the **service_role** (or **secret**) key. Mark it as a Secret. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | First line from the key generator |
| `VAPID_PRIVATE_KEY` | Second line from the key generator |
| `CRON_SECRET` | Any long random string (at least 16 characters) |

Then **Redeploy**.

### Already set up Supabase before?
Run `supabase/schema.sql` again in the SQL Editor. It's safe to re-run, and it adds the `playback` table that lets people pick up where they left off on any device.

### How alerts work
- `vercel.json` schedules `/api/cron/new-episodes` once a day (14:00 UTC), which is the most Vercel's free plan allows. It checks every favorited show for a new episode and notifies fans who turned alerts on.
- For hourly checks, upgrade to Vercel Pro and change the schedule to `0 * * * *`, or use a free service like cron-job.org to call `https://yourdomain/api/cron/new-episodes` with the header `Authorization: Bearer <your CRON_SECRET>`.
- The first check for a show only records its latest episode, so nobody gets alerts for old episodes.
- **iPhone:** web alerts only work after adding yappr to the Home Screen (Share → Add to Home Screen, iOS 16.4 or later). yappr explains this when someone tries to turn alerts on in Safari.
- Supabase pauses free projects after about a week with no activity. Real traffic prevents this; otherwise upgrade or visit the dashboard occasionally.

## Ads

The player runs **pre-roll → episode → post-roll** (live radio gets a pre-roll only). Ads can't be skipped or scrubbed, and nothing plays mid-episode.

### Where ads come from, in order
1. **Your ad server (VAST tags).** Set the tag URLs your ad partner gives you (AdsWizz, Triton, Google Ad Manager, SpringServe and others all speak VAST):
   - `NEXT_PUBLIC_VAST_PREROLL_URL`: before podcast and video episodes
   - `NEXT_PUBLIC_VAST_POSTROLL_URL`: after episodes
   - `NEXT_PUBLIC_VAST_LIVE_PREROLL_URL`: before live radio (optional; uses the preroll tag if blank)
2. **House ads** from `public/ads/house-ads.json`, used when no tag is set *or* the ad server has nothing to serve ("no fill"). Add `"slots": ["preroll", "postroll", "live"]` to control where each plays, and an optional `"image"` for a banner.
3. **Nothing.** If there's no ad, or the ad server takes more than 2.5 seconds, the episode starts anyway.

### Try it with the built-in test ad
1. In Vercel, set `NEXT_PUBLIC_VAST_PREROLL_URL` to `/ads/sample-vast.xml` and redeploy.
2. Open your site with `?debug=1`, tap the waveform button, and play an episode. You'll hear a short chime, see a banner in the play bar, and watch every tracking event appear in the panel.
3. Swap in your real tag when your ad partner sends it.

### Targeting: tell the ad server what's playing
Put any of these in your tag URL and yappr fills them in for each request, for example
`https://ads.example.com/vast?genre=[YAPPR_GENRE]&content=[YAPPR_CONTENT]&cc=[YAPPR_COUNTRY]&cb=[CACHEBUSTING]`

| Macro | Becomes |
| --- | --- |
| `[YAPPR_CONTENT]` | `podcast`, `video` or `live` |
| `[YAPPR_GENRE]` | The show's or station's main category, e.g. `Comedy` |
| `[YAPPR_COUNTRY]` | The listener's country, e.g. `us` |
| `[YAPPR_SLOT]` | `preroll` or `postroll` |
| `[YAPPR_SHOW_ID]`, `[YAPPR_SHOW]`, `[YAPPR_EPISODE_ID]` | What's about to play |
| `[US_PRIVACY]`, `[GPC]` | Privacy signals: `1YYN` / `1` when the browser sends Global Privacy Control |
| `[CACHEBUSTING]`, `[TIMESTAMP]` | Standard VAST macros |

Ask your ad partner which parameter names their system expects, then map these macros to them.

### Other ad settings
- **Banners (companion ads):** if the VAST response includes an image companion, it replaces the artwork in the play bar during the ad and is clickable. Its view pixels fire automatically.
- **Frequency cap:** `NEXT_PUBLIC_AD_MIN_GAP_SECONDS` (default `90`) skips an ad if the listener heard one that recently, so hopping between stations doesn't mean ad after ad. Set `0` to turn it off.
- **Tracking:** impression, start, 25/50/75%, complete, pause, resume, click and error pixels all fire automatically, with the same macros filled in.
- **Before running paid campaigns:** add a consent banner (a CMP such as Google's, Cookiebot or OneTrust) and pass its consent string to your tag. `[US_PRIVACY]` covers the basic US opt-out signal, but most ad partners will ask for a proper consent tool.

## Run it on your computer (optional)

Requires Node.js 18.18 or newer.

```bash
npm install
cp .env.example .env.local   # then paste your keys into .env.local
npm run dev                  # open http://localhost:3000
```

## How it's built

| Path | What it does |
| --- | --- |
| `app/api/trending`, `app/api/search`, `app/api/podcast/[id]` | Server routes that call Podcast Index. Your secret never reaches the browser, and results are cached at the edge for 10–15 minutes to keep you well within API limits. |
| `components/PlayerProvider.js` | The audio engine: one audio element, the ad → episode → ad sequence, resume positions, lock-screen controls. |
| `lib/vast.js` | VAST ad fetching, parsing and tracking pixels. |
| `components/App.js` | The app shell: Home (Podcasts, Video and Live, each as rows of shows with "See all"), Search, Library, and the bottom navigation on phones. Shows expand inline below their row. |
| `components/Account.js` | The header sign-in button and the account card at the top of the Library (sign in, profile, alerts, sign out). |
| `app/api/latest` | New episodes from the shows someone follows, in one request (powers "New from shows you follow"). |
| `components/ShowPanel.js` | The expanded show view: host, categories, episode count, website, support link, and the episode list with play, favorite and share. |
| `components/Player.js` | The now-playing bar at the bottom of the screen, plus the ad debug panel. |
| `app/show/[id]` | Shareable links for shows and episodes (`/show/123` or `/show/123?ep=456`), with previews for iMessage, WhatsApp, X and Slack. |
| `app/api/charts`, `app/api/rising` | Top: Apple's top 50 for any of 24 countries. With a genre picked, it filters Apple's top 100 to that genre (Apple has no public per-genre charts). Rising: fastest-climbing shows by language and genre, from Podcast Index. |
| `app/api/radio`, `lib/radio.js` | Live radio from the free Radio Browser directory, by country, genre, popular or rising. Only https streams that browsers can play are listed. |
| `app/api/video` | Video rankings. Podcast Index's video catalog is unranked, so Top and Rising cross it with Podcast Index's trending list and rank by trend score (all-time and last 3 days). New to watch is sorted by newest episode. When too few video shows are trending in a genre, the row says so and shows the most active ones without rank numbers. |
| `components/VideoDock.js` | The floating video window, with a bigger theater view and picture-in-picture. |
| `components/AuthProvider.js`, `components/Account.js` | Sign-in (email link or Google), the account menu, and the alerts switch. |
| `app/api/cron/new-episodes`, `public/sw.js` | The scheduled new-episode check and the service worker that shows alerts. |
| `supabase/schema.sql` | Database tables and security rules for favorites and alerts. |
| `app/api/radio/local` | "Near you": popular stations within about 120 km, using Vercel's approximate city-level location for the visitor (never GPS). Only shown when browsing your own country. |
| `app/api/radio/now` | The song or show a station is playing right now, read from the station's stream information. Not every station sends it. |
| `app/api/extras` | An episode's chapters and transcript (JSON, WebVTT, SRT, HTML or text), fetched on the server because podcast hosts usually block browsers from loading them. |
| `app/api/geo`, `lib/countries.js` | Picks each visitor's country automatically (from Vercel's location header) as the default for Charts and Radio. |
| `app/terms`, `app/privacy`, `app/submit` | Terms of use, privacy policy, and the "Get your podcast on yappr" page. |
| `lib/site.js` | Your business name, state, contact email and "last updated" date used on the legal pages. |
| `app/globals.css` | All styling, including light and dark themes. |

Listening progress, "Keep listening", Up next and For You picks are saved in each visitor's browser. Favorites and listening progress also sync to the visitor's account when they sign in, so they can pick up on any device.

## Listening features
- **Up next and autoplay:** add any episode to Up next from its row. When an episode ends, yappr plays the next queued episode, or (with Autoplay on) the show's next episode.
- **Sleep timer:** 15, 30, 45 or 60 minutes, or the end of the episode, with a gentle fade-out.
- **Chapters and transcripts:** when a show publishes them, the Up next panel gets Chapters and Transcript tabs. Tap a line to jump there; the transcript follows along as you listen.
- **Cast:** send audio to Chromecast speakers and TVs (Chrome) or AirPlay (Safari).
- **Live radio extras:** "Near you" stations, and the current song or show in the play bar and on the lock screen. For You combines the vibes a listener picks with the categories of shows they've played.

## Before you go big

- **Legal pages are drafts.** Fill in your business name and state in `lib/site.js`, and have a lawyer review Terms and Privacy before running paid ads.
- **Copyright agent.** To rely on DMCA safe-harbor protection in the US, register a designated agent with the US Copyright Office (copyright.gov/dmca-directory) and list it on the Terms page.
- **Charts source.** Charts use Apple's public marketing feed. Confirm its terms fit your use, or swap in another source later.

- **Rights and creators.** Placing your ads around other people's shows can raise copyright and creator-relations issues. Get legal advice, and consider a revenue share or opt-in program for creators.
- **Privacy.** Ad servers use consent signals. Add a cookie/consent banner and a "Do Not Sell or Share" link (required in several US states) before running real ad campaigns.
- **Attribution.** The footer credits Podcast Index, which they ask apps to do. Keep it in.
