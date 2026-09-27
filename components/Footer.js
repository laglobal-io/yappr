import Link from "next/link";

export const CONTACT_EMAIL = "hello@yappr.fm";

export default function Footer() {
  return (
    <footer className="foot">
      <nav className="foot-links" aria-label="Site links">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/submit">Submit a podcast</Link>
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </nav>
      <p>
        Podcast data from{" "}
        <a href="https://podcastindex.org" target="_blank" rel="noopener noreferrer">Podcast Index</a>. Charts from Apple Podcasts. Stations from{" "}
        <a href="https://www.radio-browser.info" target="_blank" rel="noopener noreferrer">Radio Browser</a>.
      </p>
      <p>© {new Date().getFullYear()} yappr</p>
    </footer>
  );
}
