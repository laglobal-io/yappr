"use client";

import { useState } from "react";
import { colorsFor, initials } from "@/lib/format";

// Artwork with a colorful initials fallback. fit="contain" suits station logos, which are rarely square photos.
export default function Art({ id, src, title, className = "", fit = "cover" }) {
  const [broken, setBroken] = useState(false);
  const [c1, c2] = colorsFor(id);
  const showImg = src && !broken;
  const contain = fit === "contain" && showImg;
  return (
    <span className={`art ${contain ? "contain " : ""}${className}`} style={{ "--c1": c1, "--c2": c2 }} aria-hidden="true">
      {initials(title)}
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : null}
    </span>
  );
}
