import { NextResponse } from "next/server";
import { getSumUpCredentials } from "@/lib/sumup";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const org = searchParams.get("org");
    const { amount, description, buyer } = await request.json();

    const creds = await getSumUpCredentials(org);
    if (!creds) {
      return NextResponse.json(
        { error: "SumUp non configure" },
        { status: 500 },
      );
    }

    const valueInCents = Math.round(amount * 100);

    const body: Record<string, unknown> = {
      total_amount: {
        currency: "EUR",
        minor_unit: 2,
        value: valueInCents,
      },
      description: buyer ? `${buyer} — ${description}` : description,
    };

    if (creds.affiliateKey) {
      body.affiliate = {
        app_id: creds.appId || "aeroclub-bar.vercel.app",
        key: creds.affiliateKey,
      };
    }

    const res = await fetch(
      `https://api.sumup.com/v0.1/merchants/${creds.merchantCode}/readers/${creds.readerId}/checkout`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + creds.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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
    const clientTxId =
      data?.data?.client_transaction_id || data?.client_transaction_id || null;
    return NextResponse.json({ ok: true, checkoutId: clientTxId });
  } catch (e) {
    console.error("SumUp checkout error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
