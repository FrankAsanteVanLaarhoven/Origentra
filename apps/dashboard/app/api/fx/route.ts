export const revalidate = 300;

/** Live FX rates via Frankfurter (keyless, ECB data). Fails soft to empty. */
export async function GET() {
  try {
    const from = "USD";
    const to = "EUR,GBP,JPY,CHF,CAD,AUD,CNY,INR";
    const r = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`, { next: { revalidate: 300 } });
    if (!r.ok) throw new Error(`frankfurter ${r.status}`);
    const j = (await r.json()) as { base: string; date: string; rates: Record<string, number> };
    const rates = Object.entries(j.rates ?? {}).map(([sym, rate]) => ({ sym, rate }));
    return Response.json({ base: j.base, date: j.date, rates });
  } catch (e) {
    return Response.json({ base: "USD", date: "", rates: [], error: String(e) });
  }
}
