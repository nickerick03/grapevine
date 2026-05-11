import { useState, useEffect, useCallback } from "react";

/**
 * Detects ad blockers using two complementary techniques:
 *
 * 1. Bait element — inserts a tiny off-screen div whose class names and
 *    inline styles mirror real ad slots (adsbygoogle, adsense, pub_300x250…).
 *    Ad blockers hide or collapse these elements; we check computed dimensions.
 *
 * 2. Bait fetch — HEAD-requests a URL that every major ad-block list blocks.
 *    A network error or an empty / opaque response signals blocking.
 *
 * Both checks must agree before we declare "blocked" to minimise false
 * positives (e.g. strict Content-Security-Policy environments).
 */

async function runBaitElementCheck(): Promise<boolean> {
  return new Promise((resolve) => {
    const bait = document.createElement("div");

    // Class names and an id that every mainstream block-list targets
    bait.id = "adsense-bait";
    bait.className =
      "adsense adsbygoogle ad-unit ad-banner pub_300x250 pub_300x250m text-ad textAd text_ad text_ads";

    Object.assign(bait.style, {
      position: "absolute",
      left: "-9999px",
      top: "-9999px",
      width: "300px",
      height: "250px",
      pointerEvents: "none",
      zIndex: "-1",
    });

    document.body.appendChild(bait);

    // Give the blocker time to process the DOM mutation
    requestAnimationFrame(() => {
      setTimeout(() => {
        const cs = window.getComputedStyle(bait);
        const blocked =
          !document.body.contains(bait) || // removed from DOM
          bait.offsetHeight === 0 ||
          bait.offsetWidth === 0 ||
          cs.display === "none" ||
          cs.visibility === "hidden" ||
          cs.opacity === "0";

        if (document.body.contains(bait)) {
          document.body.removeChild(bait);
        }

        resolve(blocked);
      }, 150);
    });
  });
}

async function runBaitFetchCheck(): Promise<boolean> {
  // This URL is on virtually every ad-block filter list
  const BAIT_URL =
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
  try {
    const res = await fetch(BAIT_URL, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
    });
    // no-cors returns an opaque response (type === "opaque") on success.
    // If the blocker intercepts it the fetch rejects or returns type "error".
    return res.type === "error";
  } catch {
    return true; // network error → blocked
  }
}

export type AdBlockStatus = "checking" | "blocked" | "allowed";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useAdBlockDetection() {
  const [status, setStatus] = useState<AdBlockStatus>("checking");

  const check = useCallback(async (options?: { attempts?: number; delayMs?: number }) => {
    const attempts = Math.max(1, options?.attempts ?? 1);
    const delayMs = Math.max(0, options?.delayMs ?? 250);

    setStatus("checking");

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const [elementBlocked, fetchBlocked] = await Promise.all([
        runBaitElementCheck(),
        runBaitFetchCheck(),
      ]);

      const blocked = elementBlocked && fetchBlocked;

      // As soon as one fresh pass detects "allowed", unblock immediately.
      if (!blocked) {
        setStatus("allowed");
        return "allowed" as const;
      }

      if (attempt < attempts - 1) {
        await sleep(delayMs);
      }
    }

    setStatus("blocked");
    return "blocked" as const;
  }, []);

  useEffect(() => {
    check({ attempts: 1 }).catch(() => {
      setStatus("blocked");
    });
  }, [check]);

  return { status, recheck: check };
}
