import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const limit = parseInt(searchParams.get("limit") ?? "100", 10);

  const dbUrl = process.env.DATABASE_URL;

  // If no DATABASE_URL, return static data as fallback
  if (!dbUrl) {
    return NextResponse.json({
      pages: [
        { url: "code.claude.com", domain: "code.claude.com", page_type: null, pages: 71, avg_quality: 0.819 },
        { url: "platform.claude.com", domain: "platform.claude.com", page_type: null, pages: 768, avg_quality: 0.706 },
        { url: "neon.com", domain: "neon.com", page_type: null, pages: 414, avg_quality: 0.816 },
        { url: "vercel.com", domain: "vercel.com", page_type: null, pages: 1224, avg_quality: 0.792 },
      ],
      total: 2477,
      source: "static_fallback",
    });
  }

  try {
    const sql = neon(dbUrl);

    if (source) {
      const rows = await sql`
        SELECT url, domain, page_type, first_seen, last_seen
        FROM reporting.dim_page
        WHERE is_current = true AND domain ILIKE ${"%" + source + "%"}
        ORDER BY last_seen DESC NULLS LAST
        LIMIT ${limit}
      `;
      return NextResponse.json({ pages: rows, total: rows.length, source });
    }

    // Aggregate by domain
    const rows = await sql`
      SELECT domain, count(*) as pages,
        round(avg(ce.quality_score)::numeric, 3) as avg_quality
      FROM reporting.dim_page dp
      LEFT JOIN runtime.crawl_events ce ON ce.url = dp.url
      WHERE dp.is_current = true
      GROUP BY domain
      ORDER BY pages DESC
    `;

    const total = rows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.pages ?? 0), 0);
    return NextResponse.json({ pages: rows, total, source: "neon_live" });
  } catch (err) {
    return NextResponse.json(
      { error: "Database query failed", detail: String(err) },
      { status: 500 }
    );
  }
}
