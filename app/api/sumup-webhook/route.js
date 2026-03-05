// POST /api/sumup-webhook
// Webhook appelé par SumUp quand un paiement est confirmé
// (Optionnel — pour une confirmation automatique côté serveur)
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const payload = await request.json();

    console.log("SumUp webhook received:", JSON.stringify(payload));

    // SumUp envoie le statut du checkout
    // payload.event_type === "CHECKOUT_COMPLETED" quand le paiement est réussi
    if (payload.event_type === "CHECKOUT_COMPLETED") {
      const checkoutId = payload.id;
      // Ici vous pourriez enregistrer en base de données
      // Pour l'instant on log simplement
      console.log(`Payment confirmed for checkout: ${checkoutId}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
