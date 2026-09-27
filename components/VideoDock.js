"use client";

import { useState } from "react";
import Icon from "./Icon";

// Holds the one media element for the whole app. Audio episodes play through it invisibly;
// video episodes appear in a floating window above the play bar (or a big theater view).
export default function VideoDock({ mediaRef, state, open, onHide }) {
  const [theater, setTheater] = useState(false);
  const ad = state.phase === "preroll" || state.phase === "postroll";
  const showing = open && state.ep && (state.phase === "content" || (ad && state.ad && state.ad.isVideo));
  const canPip = typeof document !== "undefined" && document.pictureInPictureEnabled;

  const pip = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await mediaRef.current.requestPictureInPicture();
    } catch { /* not supported for this media */ }
  };

  const cls = ["video-dock", showing && "show", showing && theater && "theater"].filter(Boolean).join(" ");
  return (
    <>
      {showing && theater ? <div className="video-scrim" onClick={() => setTheater(false)} /> : null}
      <div className={cls} aria-hidden={!showing} role={showing ? "region" : undefined} aria-label={showing ? "Video player" : undefined}>
        <video ref={mediaRef} playsInline preload="auto" x-webkit-airplay="allow" onClick={() => showing && setTheater((t) => !t)} />
        {showing ? (
          <div className="vd-bar">
            {ad ? <span className="live-pill ad-pill">Ad</span> : null}
            <span className="vd-title">{ad ? `Sponsored by ${state.ad.advertiser}` : state.ep.title}</span>
            {canPip ? (
              <button className="vd-btn" onClick={pip} aria-label="Picture in picture"><Icon name="pip" /></button>
            ) : null}
            <button className="vd-btn" onClick={() => setTheater((t) => !t)} aria-label={theater ? "Smaller video" : "Bigger video"}>
              <Icon name={theater ? "shrink" : "expand"} />
            </button>
            <button className="vd-btn" onClick={() => { setTheater(false); onHide(); }} aria-label="Hide video, keep listening">
              <Icon name="close" />
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
