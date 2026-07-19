"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/** Synthesized UI sound — no audio assets. Short filtered blips per interaction. */
export type SoundKind = "click" | "nav" | "scroll" | "toggle" | "alert";
const KEY = "origentra-sound";

const SPEC: Record<SoundKind, [freq: number, dur: number, type: OscillatorType]> = {
  click: [520, 0.05, "square"],
  nav: [760, 0.06, "triangle"],
  scroll: [300, 0.028, "sine"],
  toggle: [440, 0.07, "sawtooth"],
  alert: [900, 0.12, "square"],
};

interface SoundCtx {
  enabled: boolean;
  toggle: () => void;
  play: (k: SoundKind) => void;
}
const Ctx = createContext<SoundCtx>(null!);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const acRef = useRef<AudioContext | null>(null);

  useEffect(() => setEnabled(localStorage.getItem(KEY) === "1"), []);

  const ac = () => {
    if (!acRef.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      acRef.current = new AC();
    }
    return acRef.current;
  };

  const play = useCallback(
    (k: SoundKind) => {
      if (!enabled) return;
      try {
        const c = ac();
        const t = c.currentTime;
        const [f, d, type] = SPEC[k];
        const o = c.createOscillator();
        const g = c.createGain();
        const hp = c.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 160;
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(60, f * 0.6), t + d);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.07, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(hp);
        hp.connect(g);
        g.connect(c.destination);
        o.start(t);
        o.stop(t + d + 0.02);
      } catch {
        /* audio unavailable — ignore */
      }
    },
    [enabled],
  );

  const toggle = useCallback(() => {
    setEnabled((e) => {
      const n = !e;
      localStorage.setItem(KEY, n ? "1" : "0");
      if (n) {
        try {
          void ac().resume();
        } catch {
          /* ignore */
        }
      }
      return n;
    });
  }, []);

  // Global click + scroll feedback.
  useEffect(() => {
    if (!enabled) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest("button, a, [role='button'], .neon, .nav");
      if (el) play(el.classList.contains("nav") ? "nav" : "click");
    };
    let last = 0;
    const onWheel = () => {
      const now = Date.now();
      if (now - last > 170) {
        last = now;
        play("scroll");
      }
    };
    window.addEventListener("click", onClick, true);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("wheel", onWheel);
    };
  }, [enabled, play]);

  return <Ctx.Provider value={{ enabled, toggle, play }}>{children}</Ctx.Provider>;
}

export const useSound = () => useContext(Ctx);
