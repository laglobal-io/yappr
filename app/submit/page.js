import LegalPage from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata = { title: "Submit a podcast | yappr" };

export default function Submit() {
  const mail = (subject) => (
    <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(subject)}`}>{SITE.email}</a>
  );
  return (
    <LegalPage title="Get your podcast on yappr">
      <p className="lede">
        yappr lists shows from the Podcast Index, the open directory behind many independent podcast apps. If your show is on
        the Podcast Index, it&rsquo;s already on yappr.
      </p>

      <h2>Check if you&rsquo;re already here</h2>
      <p>
        Search for your show&rsquo;s name on the <a href="/">yappr home page</a>. Most shows listed on Apple Podcasts are already in the
        Podcast Index, so there&rsquo;s a good chance you&rsquo;ll find it.
      </p>

      <h2>Add a new show</h2>
      <ol>
        <li>Copy your podcast&rsquo;s RSS feed link from your hosting provider&rsquo;s dashboard.</li>
        <li>
          Go to <a href="https://podcastindex.org" target="_blank" rel="noopener noreferrer">podcastindex.org</a> and use its
          &ldquo;Add a podcast&rdquo; option to submit your feed. It&rsquo;s free.
        </li>
        <li>Once the Podcast Index picks it up, your show appears in yappr search automatically.</li>
      </ol>
      <p>New episodes show up on their own whenever you publish. There&rsquo;s nothing else to update.</p>

      <h2>Look your best</h2>
      <ul>
        <li>Square cover art, ideally 3000 × 3000 pixels, that still reads well when small.</li>
        <li>A clear show title and a description that says what listeners will get.</li>
        <li>MP3 or AAC audio, so episodes play in every browser.</li>
      </ul>

      <h2>For creators: how ads work here</h2>
      <p>
        yappr may play one short ad before your episode starts and one after it ends. We never insert ads inside your episode or change
        your audio, and your own host&rsquo;s ads and stats keep working as usual. Want to talk about revenue sharing, being featured, or
        opting your show out? Email {mail("Creator: my show")}.
      </p>

      <h2>Remove a show</h2>
      <p>
        If you own a show and want it removed from yappr, email {mail("Removal request")} with the show name and RSS feed link, plus
        a way for us to confirm you control the feed.
      </p>

      <h2>Advertise on yappr</h2>
      <p>Interested in reaching listeners? Email {mail("Advertising")}.</p>
    </LegalPage>
  );
}
