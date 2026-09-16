import { NextResponse } from "next/server";
import { getSumUpCredentials } from "@/lib/sumup";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const org = searchParams.get("org");

    const creds = await getSumUpCredentials(org);
    if (!creds) {
      return NextResponse.json(
        { error: "SumUp non configure" },
        { status: 500 },
      );
    }

    const res = await fetch(
      `https://api.sumup.com/v0.1/merchants/${creds.merchantCode}/readers/${creds.readerId}/terminate`,
      {
        method: "POST",
        headers: { Authorization: "Bearer " + creds.apiKey },
      },
    );

    console.log("SumUp terminate status:", res.status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Terminate error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
