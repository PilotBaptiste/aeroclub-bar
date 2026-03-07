import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { amount, description, buyer } = await request.json();

    const API_KEY = process.env.SUMUP_API_KEY;
    const MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE;
    const READER_ID = process.env.SUMUP_READER_ID;
    const AFFILIATE_KEY = process.env.SUMUP_AFFILIATE_KEY;
    const APP_ID = process.env.SUMUP_APP_ID || "aeroclub-bar.vercel.app";

    if (!API_KEY || !MERCHANT_CODE || !READER_ID || !AFFILIATE_KEY) {
      return NextResponse.json(
        { error: "SumUp non configure" },
        { status: 500 },
      );
    }

    // Montant en centimes (minor unit = 2)
    const valueInCents = Math.round(amount * 100);

    // Génère un ID de session unique pour le polling
    const sessionId =
      Date.now().toString(36) + Math.random().toString(36).slice(2);
    const returnUrl =
      process.env.NEXT_PUBLIC_APP_URL +
      "/api/sumup-webhook?session=" +
      sessionId;

    // Stocke la session en KV avec statut "pending"
    await kv.set(
      "sumup-session:" + sessionId,
      {
        status: "pending",
        amount,
        buyer,
        description,
      },
      { ex: 300 },
    ); // expire après 5 min

    // Envoie au terminal Solo
    const res = await fetch(
      `https://api.sumup.com/v0.1/merchants/${MERCHANT_CODE}/readers/${READER_ID}/checkout`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          total_amount: {
            currency: "EUR",
            minor_unit: 2,
            value: valueInCents,
          },
          description,
          affiliate: {
            app_id: APP_ID,
            key: AFFILIATE_KEY,
          },
          return_url: returnUrl,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("SumUp reader error:", err);
      return NextResponse.json(
        { error: "Erreur terminal SumUp" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, sessionId });
  } catch (e) {
    console.error("SumUp checkout error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
