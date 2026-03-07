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

    // Le statut du reader indique l'état de la transaction en cours
    // "ready" = terminal libre = paiement terminé (succès ou échec)
    // "busy" / "processing" = paiement en cours
    const readerStatus = data.status || data.reader_status || "";

    if (readerStatus === "busy" || readerStatus === "processing") {
      return NextResponse.json({ status: "pending" });
    }

    // Si on a un checkoutId, on vérifie le statut de la transaction
    if (checkoutId) {
      const txRes = await fetch(
        `https://api.sumup.com/v0.1/checkouts/${checkoutId}`,
        {
          headers: { Authorization: "Bearer " + API_KEY },
          cache: "no-store",
        },
      );
      if (txRes.ok) {
        const tx = await txRes.json();
        console.log("Checkout status:", JSON.stringify(tx));
        const txStatus = (tx.status || "").toUpperCase();
        if (
          txStatus === "PAID" ||
          txStatus === "SUCCESSFUL" ||
          txStatus === "COMPLETE"
        ) {
          return NextResponse.json({ status: "success" });
        }
        if (
          txStatus === "FAILED" ||
          txStatus === "CANCELLED" ||
          txStatus === "EXPIRED"
        ) {
          return NextResponse.json({ status: "failed" });
        }
      }
    }

    // Fallback : regarde les transactions récentes du reader
    const txRes = await fetch(
      `https://api.sumup.com/v0.1/merchants/${MERCHANT_CODE}/readers/${READER_ID}/transactions?limit=1`,
      {
        headers: { Authorization: "Bearer " + API_KEY },
        cache: "no-store",
      },
    );

    if (txRes.ok) {
      const txData = await txRes.json();
      const lastTx = Array.isArray(txData) ? txData[0] : txData?.items?.[0];
      if (lastTx) {
        const txStatus = (lastTx.status || "").toUpperCase();
        if (
          txStatus === "SUCCESSFUL" ||
          txStatus === "PAID" ||
          txStatus === "COMPLETE"
        ) {
          return NextResponse.json({ status: "success" });
        }
        if (txStatus === "FAILED" || txStatus === "CANCELLED") {
          return NextResponse.json({ status: "failed" });
        }
      }
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
