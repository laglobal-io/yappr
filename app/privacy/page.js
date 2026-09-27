import LegalPage from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata = { title: "Privacy | yappr" };

export default function Privacy() {
  const mail = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>;
  return (
    <LegalPage title="Privacy" updated={SITE.updated}>
      <p>
        yappr is built to need as little of your information as possible. You can listen without an account, and we only ask for your
        email if you choose to sign in. This page explains what data is involved when you use yappr and who handles it.
      </p>

      <h2>Stored only on your device</h2>
      <p>
        Your listening progress, recently played episodes and stations, your For You picks, and your theme are saved in your own
        browser&rsquo;s storage and aren&rsquo;t sent to us. Favorites are saved here too, and also to your account if you sign in. Clearing your browser&rsquo;s site data for yappr erases them.
      </p>

      <h2>If you sign in</h2>
      <p>
        Signing in is optional. If you do, we store your email address (and your name and profile photo if you use Google), plus the
        shows, episodes and stations you favorite, so they&rsquo;re available on every device. Accounts are run by our database and
        authentication provider, Supabase, on our behalf.
      </p>
      <p>
        If you turn on new-episode alerts, we also store a push notification address for your browser. We use it only to tell you when
        a show you favorited posts a new episode. Turning alerts off or signing out removes it from this device.
      </p>
      <p>To delete your account and everything linked to it, email {mail} from the address you signed in with.</p>

      <h2>What reaches our servers</h2>
      <p>
        When you browse or search, your request (including what you searched for) goes to our servers and is passed to the Podcast Index
        to fetch results. Our hosting provider automatically processes standard technical information, such as your IP address, browser
        type and the pages you request, to deliver and secure the site. We don&rsquo;t use this to build a profile of you.
      </p>

      <h2>Podcast hosts and radio stations</h2>
      <p>
        Episodes stream directly from each show&rsquo;s hosting provider, and radio streams directly from each station, not from yappr.
        Like any podcast or radio app, this means they receive your IP address and device information, and may use it for download statistics and their own advertising. Their
        privacy policies apply to that data.
      </p>

      <h2>Advertising</h2>
      <p>
        The ads before and after episodes are delivered by ad partners. To choose, deliver and measure ads (for example, confirming an
        ad played and limiting how often you hear the same one), they may receive your IP address, approximate location, device and
        browser information, and may use cookies or similar identifiers. Under some US state privacy laws this may count as
        &ldquo;selling&rdquo; or &ldquo;sharing&rdquo; personal information for targeted advertising. You can opt out by emailing {mail} with
        the subject &ldquo;Do not sell or share.&rdquo;
      </p>

      <h2>Emailing us</h2>
      <p>If you email us, we&rsquo;ll use your message and address only to reply and handle your request.</p>

      <h2>Your choices and rights</h2>
      <p>
        Depending on where you live, you may have rights to know, access, correct or delete personal information, and to opt out of
        targeted advertising. Because we keep so little, most of your data lives in your browser, which you control. For anything else,
        email {mail} and we&rsquo;ll respond within the time the law requires. We won&rsquo;t treat you differently for using these rights.
      </p>

      <h2>Children</h2>
      <p>
        yappr isn&rsquo;t directed to children under 13, and we don&rsquo;t knowingly collect their personal information. If you think a
        child has shared information with us, email {mail} and we&rsquo;ll delete it.
      </p>

      <h2>Changes</h2>
      <p>If we change how yappr handles data, we&rsquo;ll update this page and the date above.</p>

      <h2>Contact</h2>
      <p>Privacy questions or requests: {mail}.</p>
    </LegalPage>
  );
}
