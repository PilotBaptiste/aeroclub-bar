// POST /api/sumup-checkout
// Crée un checkout SumUp et retourne l'URL de paiement
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { amount, description, buyer, productId } = await request.json();

    // Validation
    if (!amount || !description || !buyer) {
      return NextResponse.json(
        { error: "Champs manquants: amount, description, buyer" },
        { status: 400 }
      );
    }

    const SUMUP_API_KEY = process.env.SUMUP_API_KEY;
    const SUMUP_MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!SUMUP_API_KEY || !SUMUP_MERCHANT_CODE) {
      return NextResponse.json(
        { error: "SumUp non configuré. Ajoutez SUMUP_API_KEY et SUMUP_MERCHANT_CODE dans .env.local" },
        { status: 500 }
      );
    }

    // Identifiant unique pour ce checkout
    const checkoutRef = `aerobar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Appel API SumUp pour créer un checkout
    const sumupResponse = await fetch("https://api.sumup.com/v0.1/checkouts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUMUP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checkout_reference: checkoutRef,
        amount: amount,
        currency: "EUR",
        merchant_code: SUMUP_MERCHANT_CODE,
        description: `${description} — ${buyer}`,
        return_url: `${APP_URL}?payment=success&ref=${checkoutRef}&product=${productId}&buyer=${encodeURIComponent(buyer)}`,
      }),
    });

    if (!sumupResponse.ok) {
      const errorData = await sumupResponse.text();
      console.error("SumUp API error:", errorData);
      return NextResponse.json(
        { error: "Erreur SumUp", details: errorData },
        { status: 502 }
      );
    }

    const checkout = await sumupResponse.json();

    // L'URL de paiement SumUp
    const paymentUrl = `https://pay.sumup.com/b2c/Q${SUMUP_MERCHANT_CODE}?id=${checkout.id}`;

    return NextResponse.json({
      checkoutId: checkout.id,
      checkoutRef: checkoutRef,
      paymentUrl: paymentUrl,
      // URL alternative directe SumUp
      sumupPayUrl: `https://pay.sumup.com/b2c/Q${SUMUP_MERCHANT_CODE}`,
    });

  } catch (error) {
    console.error("Checkout creation error:", error);
    return NextResponse.json(
      { error: "Erreur serveur", details: error.message },
      { status: 500 }
    );
  }
}
