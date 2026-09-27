// Stand-in tracking endpoint for the sample ad (public/ads/sample-vast.xml). Real ad servers host their own.
export const dynamic = "force-dynamic";
export async function GET() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
