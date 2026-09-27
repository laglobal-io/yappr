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
| `app/api/charts`, `app/api/rising` | Charts: Apple's top 50 for any of 24 countries, and "Rising" (fastest-climbing shows by language, from Podcast Index). |
| `app/api/radio`, `lib/radio.js` | Live radio from the free Radio Browser directory, by country, genre, popular or rising. Only https streams that browsers can play are listed. |
| `app/api/geo`, `lib/countries.js` | Picks each visitor's country automatically (from Vercel's location header) as the default for Charts and Radio. |
| `app/terms`, `app/privacy`, `app/submit` | Terms of use, privacy policy, and the "Get your podcast on yappr" page. |
| `lib/site.js` | Your business name, state, contact email and "last updated" date used on the legal pages. |
| `app/globals.css` | All styling, including light and dark themes. |

Listening progress, favorites, "Keep listening" and For You picks are saved in each visitor's browser; there are no accounts yet. For You combines the vibes a listener picks with the categories of shows they've played.

## Before you go big

- **Legal pages are drafts.** Fill in your business name and state in `lib/site.js`, and have a lawyer review Terms and Privacy before running paid ads.
- **Copyright agent.** To rely on DMCA safe-harbor protection in the US, register a designated agent with the US Copyright Office (copyright.gov/dmca-directory) and list it on the Terms page.
- **Charts source.** Charts use Apple's public marketing feed. Confirm its terms fit your use, or swap in another source later.

- **Rights and creators.** Placing your ads around other people's shows can raise copyright and creator-relations issues. Get legal advice, and consider a revenue share or opt-in program for creators.
- **Privacy.** Ad servers use consent signals. Add a cookie/consent banner and a "Do Not Sell or Share" link (required in several US states) before running real ad campaigns.
- **Attribution.** The footer credits Podcast Index, which they ask apps to do. Keep it in.
