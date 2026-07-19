"use client";

import { useEffect, useRef, useState } from "react";
import { useSound } from "@/lib/sound";

/** Pops a live monitor into a Document Picture-in-Picture window (Chromium).
 *  Feature-detected — the button only renders where PiP is supported. */
export function PiPButton() {
  const { play } = useSound();
  const [supported, setSupported] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "documentPictureInPicture" in window);
  }, []);

  const open = async () => {
    play("toggle");
    try {
      const dpip = (window as unknown as { documentPictureInPicture?: { requestWindow: (o: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
      if (!dpip) return;
      const w = await dpip.requestWindow({ width: 360, height: 200 });
      const style = w.document.createElement("style");
      style.textContent =
        "*{margin:0;box-sizing:border-box;font-family:ui-monospace,SFMono-Regular,monospace}" +
        "body{background:#05070a;color:#e6f1f7;height:100vh;display:flex;flex-direction:column;justify-content:center;padding:18px;gap:10px}" +
        ".b{letter-spacing:.3em;font-size:11px;color:#7f97a6}.t{font-size:42px;letter-spacing:-.02em}.n{color:#22d3ee}" +
        ".r{display:flex;gap:8px;align-items:center}.d{width:8px;height:8px;border-radius:50%;background:#22d3ee;box-shadow:0 0 10px #22d3ee}";
      w.document.head.appendChild(style);
      w.document.body.innerHTML =
        '<div class="r"><span class="d"></span><span class="b">ORIGENTRA MONITOR</span></div>' +
        '<div class="t" id="clk">--:--:--</div>' +
        '<div class="b">throughput <span class="n" id="tp">--</span> ev/s</div>';
      const clk = w.document.getElementById("clk")!;
      const tp = w.document.getElementById("tp")!;
      const tick = () => {
        clk.textContent = new Date().toLocaleTimeString("en-GB", { hour12: false });
        tp.textContent = String(28 + Math.floor(Math.random() * 44));
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
      w.addEventListener("pagehide", () => {
        if (timerRef.current) clearInterval(timerRef.current);
      });
    } catch {
      /* PiP denied / unavailable */
    }
  };

  if (!supported) return null;
  return (
    <button className="neon px-3 py-2 text-sm" title="Pop-out monitor (Picture-in-Picture)" onClick={open}>
      ⧉
    </button>
  );
}
