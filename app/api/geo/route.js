import { isCountry } from "@/lib/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best guess at the visitor's country (Vercel adds this header). Used as the default for Charts and Radio.
export async function GET(request) {
  const detected = (request.headers.get("x-vercel-ip-country") || "").toLowerCase();
  return Response.json(
    { country: isCountry(detected) ? detected : "us" },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
