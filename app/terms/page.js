import LegalPage from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata = { title: "Terms of use | yappr" };

export default function Terms() {
  const mail = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>;
  return (
    <LegalPage title="Terms of use" updated={SITE.updated}>
      <p>
        These terms cover your use of yappr, a free website for finding and listening to podcasts, run by {SITE.company} (&ldquo;we&rdquo;).
        By using yappr you agree to them. If you don&rsquo;t agree, please don&rsquo;t use the site.
      </p>

      <h2>What yappr is</h2>
      <p>
        yappr helps you discover and play podcasts that creators publish openly through RSS feeds, and listen to live radio stations
        that stream publicly online. We don&rsquo;t host any audio: episodes stream directly from each show&rsquo;s hosting provider, and
        radio plays directly from each station. Show listings come from the Podcast Index, charts come
        from Apple Podcasts, and live radio stations come from the Radio Browser directory. You don&rsquo;t need an account.
      </p>

      <h2>Podcasts belong to their creators</h2>
      <p>
        Every show, episode, title, image and description belongs to its creator or rights holder. Listing a show on yappr doesn&rsquo;t
        mean the creator endorses yappr, or that we endorse the show. Opinions in podcasts are the creators&rsquo; own.
      </p>

      <h2>Ads</h2>
      <p>
        yappr is free because it&rsquo;s supported by ads. We may play a short ad before an episode starts and after it ends, and we never
        insert ads into the middle of an episode or change a creator&rsquo;s audio. Ads are provided by advertisers and ad partners, who are
        responsible for their content. Showing an ad isn&rsquo;t an endorsement of the advertiser.
      </p>

      <h2>Using yappr fairly</h2>
      <p>Please don&rsquo;t:</p>
      <ul>
        <li>use yappr for anything unlawful, or to infringe anyone&rsquo;s rights;</li>
        <li>scrape, copy or resell the service or its data in bulk, or use bots to access it;</li>
        <li>block, skip, modify or tamper with ads or ad measurement through technical means;</li>
        <li>try to break, overload or gain unauthorized access to the site or its systems.</li>
      </ul>

      <h2>Creators, removals and copyright</h2>
      <p>
        If you own a show and want it removed from yappr, or want to talk about how ads run around it, email {mail} with the
        show&rsquo;s name and RSS feed link, and a way for us to confirm you control the feed. We&rsquo;ll act on verified requests promptly.
      </p>
      <p>
        If you believe something on yappr infringes your copyright, email {mail} with: your contact details, the work you believe is
        infringed, where it appears on yappr, a statement that you believe in good faith the use isn&rsquo;t authorized, a statement that
        your notice is accurate and that you are the owner or authorized to act for the owner, and your physical or electronic signature.
      </p>

      <h2>No warranties</h2>
      <p>
        yappr is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; Shows and episodes can disappear, change or fail to play because
        they depend on creators and third-party services we don&rsquo;t control. To the fullest extent allowed by law, we make no
        warranties of any kind, express or implied.
      </p>

      <h2>Limits on liability</h2>
      <p>
        To the fullest extent allowed by law, we aren&rsquo;t liable for any indirect, incidental, special, consequential or punitive
        damages, or for lost profits or data, arising from your use of yappr. Our total liability for any claim relating to yappr is
        limited to $50.
      </p>

      <h2>Changes</h2>
      <p>
        We may update yappr or these terms. When we change the terms we&rsquo;ll update the date above, and continuing to use yappr means
        you accept the new version. We may suspend or end access to yappr at any time.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of {SITE.governingState}, USA, without regard to conflict-of-law rules, except where the
        law of your home country or state requires otherwise.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms? Email {mail}.</p>
    </LegalPage>
  );
}
