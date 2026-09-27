import Link from "next/link";
import Footer from "./Footer";
import LogoMark from "./Logo";

export default function LegalPage({ title, updated, children }) {
  return (
    <>
      <header className="top">
        <Link className="logo" href="/" aria-label="yappr home">
          <LogoMark />
          <span>yappr</span>
        </Link>
        <Link className="back-link" href="/">Back to listening</Link>
      </header>
      <main className="wrap">
        <article className="legal">
          <h1>{title}</h1>
          {updated ? <p className="updated">Last updated {updated}</p> : null}
          {children}
        </article>
        <Footer />
      </main>
    </>
  );
}
