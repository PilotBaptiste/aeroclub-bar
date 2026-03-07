import { NextResponse } from "next/server";

export async function POST() {
  try {
    const API_KEY = process.env.SUMUP_API_KEY;
    const MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE;
    const READER_ID = process.env.SUMUP_READER_ID;

    if (!API_KEY || !MERCHANT_CODE || !READER_ID) {
      return NextResponse.json(
        { error: "SumUp non configure" },
        { status: 500 },
      );
    }

    const res = await fetch(
      `https://api.sumup.com/v0.1/merchants/${MERCHANT_CODE}/readers/${READER_ID}/terminate`,
      {
        method: "POST",
        headers: { Authorization: "Bearer " + API_KEY },
      },
    );

    console.log("SumUp terminate status:", res.status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Terminate error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
