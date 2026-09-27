"use client";

import { useState } from "react";
import { colorsFor, initials } from "@/lib/format";

// Show artwork with a colorful initials fallback when there's no image or it fails to load.
export default function Art({ id, src, title, className = "" }) {
  const [broken, setBroken] = useState(false);
  const [c1, c2] = colorsFor(id);
  return (
    <span className={`art ${className}`} style={{ "--c1": c1, "--c2": c2 }} aria-hidden="true">
      {initials(title)}
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : null}
    </span>
  );
}
