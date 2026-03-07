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

    const valueInCents = Math.round(amount * 100);

    // Envoie au terminal Solo et récupère le checkout ID
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
          description: buyer ? `${buyer} — ${description}` : description,
          affiliate: {
            app_id: APP_ID,
            key: AFFILIATE_KEY,
          },
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

    const data = await res.json();
    console.log("SumUp reader response:", JSON.stringify(data));
    // On retourne le checkout ID pour pouvoir poller son statut
    return NextResponse.json({
      ok: true,
      checkoutId:
        data.id || data.checkout_id || data.client_transaction_id || null,
    });
  } catch (e) {
    console.error("SumUp checkout error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
