import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { amount, description, buyer } = await request.json();

    if (!amount || !description || !buyer) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    const SUMUP_API_KEY = process.env.SUMUP_API_KEY;
    const SUMUP_MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!SUMUP_API_KEY || !SUMUP_MERCHANT_CODE) {
      return NextResponse.json(
        { error: "SumUp non configure" },
        { status: 500 },
      );
    }

    const checkoutRef =
      "aerobar-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

    const sumupResponse = await fetch("https://api.sumup.com/v0.1/checkouts", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + SUMUP_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checkout_reference: checkoutRef,
        amount: amount,
        currency: "EUR",
        merchant_code: SUMUP_MERCHANT_CODE,
        description: description + " - " + buyer,
        redirect_url: APP_URL,
        hosted_checkout: {
          enabled: true,
        },
      }),
    });

    const checkout = await sumupResponse.json();
    console.log("SumUp response:", JSON.stringify(checkout));

    if (!sumupResponse.ok) {
      return NextResponse.json(
        { error: "Erreur SumUp", details: JSON.stringify(checkout) },
        { status: 502 },
      );
    }

    // Use the hosted checkout URL returned by SumUp
    const paymentUrl = checkout.hosted_checkout_url;

    console.log("Payment URL:", paymentUrl);

    return NextResponse.json({
      checkoutId: checkout.id,
      checkoutRef: checkoutRef,
      paymentUrl: paymentUrl,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
