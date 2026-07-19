export const revalidate = 1800;

/** Real 7-day forecast via Open-Meteo (keyless, no API key required).
 *  Defaults to London; a location picker / geolocation is a follow-up.
 *  Fails soft to an empty forecast if the upstream is unreachable. */
export async function GET() {
  try {
    const lat = 51.5074;
    const lon = -0.1278;
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=7`;
    const r = await fetch(url, { next: { revalidate: 1800 } });
    if (!r.ok) throw new Error(`open-meteo ${r.status}`);
    const j = (await r.json()) as {
      daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weathercode: number[] };
    };
    const days = j.daily.time.map((date, i) => ({
      date,
      max: j.daily.temperature_2m_max[i],
      min: j.daily.temperature_2m_min[i],
      code: j.daily.weathercode[i],
    }));
    return Response.json({ place: "London", days });
  } catch (e) {
    return Response.json({ place: "", days: [], error: String(e) });
  }
}
