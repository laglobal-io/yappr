"use client";

import { useState } from "react";
import { colorsFor, initials } from "@/lib/format";
import { sized } from "@/lib/img";

// Artwork with a colorful initials fallback. fit="contain" suits station logos, which are rarely square photos.
// size = the displayed size in CSS pixels; we request double for sharp screens.
// If the resized copy fails we try the original, then fall back to initials.
export default function Art({ id, src, title, className = "", fit = "cover", size = 160 }) {
  const [stage, setStage] = useState(0); // 0 resized, 1 original, 2 give up
  const [c1, c2] = colorsFor(id);
  const px = Math.min(1200, Math.round(size * 2));
  const url = !src ? "" : stage === 0 ? sized(src, px, fit) : stage === 1 ? src : "";
  const showImg = !!url;
  const contain = fit === "contain" && showImg;
  return (
    <span className={`art ${contain ? "contain " : ""}${className}`} style={{ "--c1": c1, "--c2": c2 }} aria-hidden="true">
      {initials(title)}
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={url} src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
          width={px} height={px} onError={() => setStage((s) => (s === 0 && url !== src ? 1 : 2))} />
      ) : null}
    </span>
  );
}
