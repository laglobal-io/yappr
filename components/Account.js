"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { usePlayer } from "./PlayerProvider";
import Icon from "./Icon";
import LogoMark from "./Logo";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.4-.2-2H12v3.8h6c-.3 1.4-1.1 2.6-2.4 3.4v2.8h3.8c2.2-2 3.2-5 3.2-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.6-1 7.4-2.7l-3.8-2.8c-1 .7-2.3 1.1-3.6 1.1-2.8 0-5.2-1.9-6-4.4H2.1v2.9C4 20.8 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M6 14.2c-.2-.7-.3-1.4-.3-2.2s.1-1.5.3-2.2V6.9H2.1C1.4 8.4 1 10.1 1 12s.4 3.6 1.1 5.1L6 14.2z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1C17.6 2.1 15 1 12 1 7.7 1 4 3.2 2.1 6.9L6 9.8c.8-2.5 3.2-4.4 6-4.4z" />
    </svg>
  );
}

const ALERT_TEXT = {
  on: "On. We'll ping you when a show you follow posts a new episode.",
  off: "Get a ping when a show you follow posts a new episode.",
  blocked: "Blocked in your browser settings. Allow notifications for this site to turn them on.",
  unsupported: "Not available in this browser. On iPhone, add yappr to your Home Screen first.",
  working: "One sec…",
};

export function Avatar({ user, size = 44 }) {
  const name = (user.user_metadata && user.user_metadata.full_name) || user.email || "?";
  const pic = user.user_metadata && user.user_metadata.avatar_url;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {pic ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pic} alt="" referrerPolicy="no-referrer" />
      ) : name.trim()[0].toUpperCase()}
    </span>
  );
}

// Header button: your avatar when signed in, "Sign in" otherwise. Both open the Library.
export function HeaderAccount({ onOpen }) {
  const auth = useAuth();
  if (!auth.enabled) return null;
  if (auth.user) {
    return (
      <button className="avatar-btn" onClick={onOpen} aria-label="Your library and account">
        <Avatar user={auth.user} />
      </button>
    );
  }
  return <button className="signin-btn" onClick={onOpen}>Sign in</button>;
}

export function SignInForm() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ state: "idle" });

  const sendLink = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setStatus({ state: "error", msg: "Enter a valid email address." }); return; }
    setStatus({ state: "sending" });
    try {
      await auth.signInWithEmail(email.trim());
      setStatus({ state: "sent" });
    } catch (err) {
      setStatus({ state: "error", msg: err.message });
    }
  };
  const google = async () => {
    try { await auth.signInWithGoogle(); } catch (err) { setStatus({ state: "error", msg: err.message }); }
  };

  if (status.state === "sent") {
    return (
      <div className="acct-sent" role="status">
        <b>Check your inbox</b>
        <p>We sent a sign-in link to {email.trim()}. Open it on this device to finish signing in.</p>
        <button className="text-btn" onClick={() => setStatus({ state: "idle" })}>Use a different email</button>
      </div>
    );
  }
  return (
    <div className="signin-form">
      <button className="google-btn" onClick={google}><GoogleMark /> Continue with Google</button>
      <div className="acct-or"><span>or</span></div>
      <form onSubmit={sendLink} noValidate>
        <label className="sr-only" htmlFor="acct-email">Email address</label>
        <input
          id="acct-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status.state === "error") setStatus({ state: "idle" }); }}
          aria-invalid={status.state === "error"} aria-describedby={status.state === "error" ? "acct-err" : undefined}
        />
        {status.state === "error" ? <p id="acct-err" className="acct-err">{status.msg}</p> : null}
        <button className="cta wide" type="submit" disabled={status.state === "sending"}>
          <Icon name="mail" />
          {status.state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
    </div>
  );
}

// The top of the Library: sign in, or your profile, alerts and sign out.
export function AccountCard() {
  const auth = useAuth();
  const player = usePlayer();
  if (!auth.enabled) return null;

  if (!auth.user) {
    return (
      <section className="account-card signed-out" aria-labelledby="acct-h">
        <div className="acct-intro">
          <span className="acct-mark"><LogoMark /></span>
          <div>
            <h2 id="acct-h">Sign in to yappr</h2>
            <ul className="perks">
              <li><Icon name="heart" />Your favorites on every device</li>
              <li><Icon name="bell" />Alerts when shows you follow post</li>
              <li><Icon name="library" />Your history, saved and synced</li>
            </ul>
          </div>
        </div>
        <SignInForm />
      </section>
    );
  }

  const u = auth.user;
  const toggleAlerts = async () => {
    try {
      if (auth.alerts === "on") await auth.turnOffAlerts();
      else { await auth.turnOnAlerts(); player.notify("Alerts on. We'll ping you about new episodes."); }
    } catch (err) {
      player.notify(err.message);
    }
  };
  return (
    <section className="account-card" aria-label="Your account">
      <div className="acct-profile">
        <Avatar user={u} size={64} />
        <div className="acct-who">
          <b>{(u.user_metadata && u.user_metadata.full_name) || "Welcome back"}</b>
          <span>{u.email}</span>
        </div>
        <button className="pill-btn ghost" onClick={auth.signOut}>Sign out</button>
      </div>
      <div className="acct-row">
        <Icon name="bell" />
        <div>
          <b>New-episode alerts</b>
          <span>{ALERT_TEXT[auth.alerts] || ALERT_TEXT.off}</span>
        </div>
        {auth.alerts !== "unsupported" && auth.alerts !== "blocked" ? (
          <button className={`toggle${auth.alerts === "on" ? " on" : ""}`} role="switch" aria-checked={auth.alerts === "on"} aria-label="New-episode alerts" onClick={toggleAlerts} disabled={auth.alerts === "working"} />
        ) : null}
      </div>
    </section>
  );
}
