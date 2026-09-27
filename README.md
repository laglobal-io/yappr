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

### How alerts work
- `vercel.json` schedules `/api/cron/new-episodes` once a day (14:00 UTC), which is the most Vercel's free plan allows. It checks every favorited show for a new episode and notifies fans who turned alerts on.
- For hourly checks, upgrade to Vercel Pro and change the schedule to `0 * * * *`, or use a free service like cron-job.org to call `https://yourdomain/api/cron/new-episodes` with the header `Authorization: Bearer <your CRON_SECRET>`.
- The first check for a show only records its latest episode, so nobody gets alerts for old episodes.
- **iPhone:** web alerts only work after adding yappr to the Home Screen (Share → Add to Home Screen, iOS 16.4 or later). yappr explains this when someone tries to turn alerts on in Safari.
- Supabase pauses free projects after about a week with no activity. Real traffic prevents this; otherwise upgrade or visit the dashboard occasionally.

## Ads

The player runs **pre-roll → episode → post-roll**. Ads can't be skipped or scrubbed, and nothing plays mid-episode. If an ad is slow (over 2.5 seconds) or fails, the episode starts anyway.

There are two ways to serve ads:

**House ads (works today).** Put MP3 files in `public/ads/` and list them in `public/ads/house-ads.json`:

```json
[
  {
    "advertiser": "Crumb Coffee",
    "line": "Small-batch beans, delivered.",
    "src": "/ads/crumb-15s.mp3",
    "clickThrough": "https://example.com",
    "slots": ["preroll", "postroll"]
  }
]
```

If the list is empty (`[]`), episodes play with no ads.

**AdsWizz or any VAST ad server.** Once your ad partner gives you VAST tag URLs, add them in Vercel as environment variables, then redeploy:
- `NEXT_PUBLIC_VAST_PREROLL_URL`
- `NEXT_PUBLIC_VAST_POSTROLL_URL`

When these are set they replace house ads. The player follows wrapper redirects, picks the audio file, and fires impression, start, quartile, complete, pause, resume and click tracking automatically. Your ad partner may also need your site's domain to allow browser requests to their tag.

**Checking ads are firing:** visit your site with `?debug=1` on the end (for example `https://your-site.vercel.app/?debug=1`) and tap the waveform button. It shows every ad request and tracking event live.

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
| `components/App.js` | Home page: search, Trending, Charts, For You and Favorites tabs. Shows expand inline below their row. |
| `components/ShowPanel.js` | The expanded show view: host, categories, episode count, website, support link, and the episode list with play, favorite and share. |
| `components/Player.js` | The now-playing bar at the bottom of the screen, plus the ad debug panel. |
| `app/show/[id]` | Shareable links for shows and episodes (`/show/123` or `/show/123?ep=456`), with previews for iMessage, WhatsApp, X and Slack. |
| `app/api/charts`, `app/api/rising` | Top: Apple's top 50 for any of 24 countries. With a genre picked, it filters Apple's top 100 to that genre (Apple has no public per-genre charts). Rising: fastest-climbing shows by language and genre, from Podcast Index. |
| `app/api/radio`, `lib/radio.js` | Live radio from the free Radio Browser directory, by country, genre, popular or rising. Only https streams that browsers can play are listed. |
| `app/api/video` | The video catalog (shows tagged as video in Podcast Index) ranked for Watch mode: fresh, top and rising. |
| `components/VideoDock.js` | The floating video window, with a bigger theater view and picture-in-picture. |
| `components/AuthProvider.js`, `components/Account.js` | Sign-in (email link or Google), the account menu, and the alerts switch. |
| `app/api/cron/new-episodes`, `public/sw.js` | The scheduled new-episode check and the service worker that shows alerts. |
| `supabase/schema.sql` | Database tables and security rules for favorites and alerts. |
| `app/api/geo`, `lib/countries.js` | Picks each visitor's country automatically (from Vercel's location header) as the default for Charts and Radio. |
| `app/terms`, `app/privacy`, `app/submit` | Terms of use, privacy policy, and the "Get your podcast on yappr" page. |
| `lib/site.js` | Your business name, state, contact email and "last updated" date used on the legal pages. |
| `app/globals.css` | All styling, including light and dark themes. |

Listening progress, "Keep listening" and For You picks are saved in each visitor's browser. Favorites are too, and they also sync to the visitor's account when they sign in. For You combines the vibes a listener picks with the categories of shows they've played.

## Before you go big

- **Legal pages are drafts.** Fill in your business name and state in `lib/site.js`, and have a lawyer review Terms and Privacy before running paid ads.
- **Copyright agent.** To rely on DMCA safe-harbor protection in the US, register a designated agent with the US Copyright Office (copyright.gov/dmca-directory) and list it on the Terms page.
- **Charts source.** Charts use Apple's public marketing feed. Confirm its terms fit your use, or swap in another source later.

- **Rights and creators.** Placing your ads around other people's shows can raise copyright and creator-relations issues. Get legal advice, and consider a revenue share or opt-in program for creators.
- **Privacy.** Ad servers use consent signals. Add a cookie/consent banner and a "Do Not Sell or Share" link (required in several US states) before running real ad campaigns.
- **Attribution.** The footer credits Podcast Index, which they ask apps to do. Keep it in.
