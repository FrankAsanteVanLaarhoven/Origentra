"use client";

/** In-app window. External destinations render here rather than leaving the app.
 *  (Some sites set X-Frame-Options and will refuse to embed — a real constraint.) */
export function EmbedModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div className="panel flex h-[82vh] w-full max-w-5xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="hairline flex items-center gap-3 px-4 py-2" style={{ borderColor: "var(--border)" }}>
          <span className="dot" style={{ color: "var(--neon)" }} />
          <span className="mono flex-1 truncate text-xs" style={{ color: "var(--muted)" }}>{url}</span>
          <button className="neon px-3 py-1 text-sm" onClick={onClose}>✕</button>
        </div>
        <iframe
          src={url}
          title="embedded"
          className="w-full flex-1"
          style={{ border: 0, background: "#fff" }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
