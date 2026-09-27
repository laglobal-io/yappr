"use client";

import { useEffect } from "react";

// Keeps keyboard focus inside an open dialog (Tab and Shift+Tab loop within it), and puts focus back
// where it was when the dialog closes. Standard for accessible pop-ups.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(ref, active = true) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const before = document.activeElement;
    const items = () => [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!root.contains(document.activeElement)) { const first = items()[0]; if (first) first.focus(); }
    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (before && typeof before.focus === "function" && document.contains(before)) before.focus();
    };
  }, [ref, active]);
}
