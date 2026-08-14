import { NextResponse } from "next/server";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

// Google requires ads.txt at the site root once AdSense is live, declaring
// the publisher ID so ad exchanges can verify this site is an authorized
// seller. 404s until the env var is set -- an empty/placeholder ads.txt
// would otherwise get flagged by AdSense's own ads.txt checker as invalid.
export async function GET() {
  if (!ADSENSE_CLIENT_ID) {
    return new NextResponse("Not found", { status: 404 });
  }

  const pubId = ADSENSE_CLIENT_ID.replace(/^ca-/, "");
  const body = `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`;

  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain" },
  });
}
