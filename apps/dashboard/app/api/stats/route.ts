export const dynamic = "force-dynamic";

/** Snapshot KPIs for the overview tiles. Reference values; wire to the real
 *  SocialTrust-Bench / audit metrics in production. */
export async function GET() {
  return Response.json({
    validity: "99.9",
    throughput: (28 + Math.floor(Math.random() * 44)).toString(),
    latency: (4 + Math.floor(Math.random() * 6)).toString(),
    blocked: Math.floor(Math.random() * 3).toString(),
  });
}
