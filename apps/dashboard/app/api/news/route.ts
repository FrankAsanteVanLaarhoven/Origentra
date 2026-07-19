export const dynamic = "force-dynamic";

const KEY = "origentra:news";
const TTL = 300; // seconds

interface NewsItem { title: string; url: string; source: string; time: number; score: number }
let mem: { at: number; data: NewsItem[] } | null = null;

async function fetchNews(): Promise<NewsItem[]> {
  const idsR = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", { cache: "no-store" });
  const ids = ((await idsR.json()) as number[]).slice(0, 8);
  return Promise.all(
    ids.map(async (id) => {
      const s = (await (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { cache: "no-store" })).json()) as {
        title?: string; url?: string; time?: number; score?: number;
      };
      return {
        title: s.title ?? "(untitled)",
        url: s.url ?? `https://news.ycombinator.com/item?id=${id}`,
        source: "HN",
        time: (s.time ?? 0) * 1000,
        score: s.score ?? 0,
      };
    }),
  );
}

/** Live intelligence feed, cached in Redis when REDIS_URL is set (in-memory otherwise). */
export async function GET() {
  const url = process.env.REDIS_URL;
  try {
    if (url) {
      const { createClient } = await import("redis");
      const c = createClient({ url });
      await c.connect();
      try {
        const cached = await c.get(KEY);
        if (cached) return Response.json({ source: "redis", items: JSON.parse(cached) as NewsItem[] });
        const items = await fetchNews();
        await c.setEx(KEY, TTL, JSON.stringify(items));
        return Response.json({ source: "redis", items });
      } finally {
        await c.quit();
      }
    }
    if (mem && Date.now() - mem.at < TTL * 1000) return Response.json({ source: "memory", items: mem.data });
    const items = await fetchNews();
    mem = { at: Date.now(), data: items };
    return Response.json({ source: "memory", items });
  } catch (e) {
    return Response.json({ source: "error", items: mem?.data ?? [], error: String(e) });
  }
}
