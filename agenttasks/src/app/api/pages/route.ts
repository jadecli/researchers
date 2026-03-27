import { NextResponse } from "next/server";

// Static data from our crawl results — would be replaced with Neon queries
const CRAWL_STATS = {
  sources: [
    { name: "code.claude.com", pages: 71, avgQuality: 0.819, chars: 1790205 },
    { name: "platform.claude.com", pages: 768, avgQuality: 0.706, chars: 24660594 },
    { name: "neon.com", pages: 414, avgQuality: 0.816, chars: 4328822 },
    { name: "vercel.com", pages: 1224, avgQuality: 0.792, chars: 10379903 },
  ],
  total: { pages: 2477, avgQuality: 0.77, chars: 41159524 },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const category = searchParams.get("category");

  let data = CRAWL_STATS.sources;
  if (source) {
    data = data.filter(s => s.name.includes(source));
  }

  return NextResponse.json({
    pages: data,
    total: CRAWL_STATS.total,
    filters: { source, category },
  });
}
