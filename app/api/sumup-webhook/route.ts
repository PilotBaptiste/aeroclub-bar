import { NextResponse } from "next/server";

// GET : polling — interroge directement l'API SumUp pour le statut du reader
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const checkoutId = searchParams.get("checkoutId");

    const API_KEY = process.env.SUMUP_API_KEY;
    const MERCHANT_CODE = process.env.SUMUP_MERCHANT_CODE;
    const READER_ID = process.env.SUMUP_READER_ID;

    if (!API_KEY || !MERCHANT_CODE || !READER_ID) {
      return NextResponse.json({ status: "pending" });
    }

    // Récupère le statut du reader (dernière transaction)
    const res = await fetch(
      `https://api.sumup.com/v0.1/merchants/${MERCHANT_CODE}/readers/${READER_ID}/status`,
      {
        headers: { Authorization: "Bearer " + API_KEY },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return NextResponse.json({ status: "pending" });
    }

    const data = await res.json();
    console.log("Reader status:", JSON.stringify(data));

    const readerState = (data?.data?.state || data?.state || "").toUpperCase();
    console.log("Reader state:", readerState);

    // Terminal occupé = paiement en cours → on continue à poller
    if (
      readerState === "WAITING_FOR_CARD" ||
      readerState === "PROCESSING" ||
      readerState === "WAITING_FOR_PIN" ||
      readerState === "BUSY" ||
      readerState === ""
    ) {
      return NextResponse.json({ status: "pending" });
    }

    // IDLE = terminal libre = paiement terminé avec succès
    // (en cas d'échec le terminal affiche une erreur et reste busy)
    if (readerState === "IDLE") {
      return NextResponse.json({ status: "success" });
    }

    return NextResponse.json({ status: "pending" });
  } catch (e) {
    console.error("Polling error:", e);
    return NextResponse.json({ status: "pending" });
  }
}

// POST : webhook SumUp (garde au cas où)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("SumUp webhook received:", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
