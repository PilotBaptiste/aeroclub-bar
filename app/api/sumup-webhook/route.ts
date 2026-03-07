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

    // La réponse SumUp est { data: { state: "WAITING_FOR_CARD"|"IDLE"|..., status: "ONLINE" } }
    const readerState = (data?.data?.state || data?.state || "").toUpperCase();

    // Terminal occupé = paiement en cours → on continue à poller
    if (
      readerState === "WAITING_FOR_CARD" ||
      readerState === "PROCESSING" ||
      readerState === "WAITING_FOR_PIN" ||
      readerState === "BUSY"
    ) {
      return NextResponse.json({ status: "pending" });
    }

    // Terminal IDLE = paiement terminé → vérifie la transaction via client_transaction_id
    if (checkoutId) {
      const txRes = await fetch(
        `https://api.sumup.com/v0.1/merchants/${MERCHANT_CODE}/transactions?client_transaction_id=${checkoutId}`,
        {
          headers: { Authorization: "Bearer " + API_KEY },
          cache: "no-store",
        },
      );
      if (txRes.ok) {
        const tx = await txRes.json();
        console.log("Transaction by client_id:", JSON.stringify(tx));
        const lastTx = Array.isArray(tx) ? tx[0] : tx?.items?.[0] || tx;
        const txStatus = (
          lastTx?.status ||
          lastTx?.transaction_status ||
          ""
        ).toUpperCase();
        console.log("Transaction status:", txStatus);
        if (
          txStatus === "SUCCESSFUL" ||
          txStatus === "PAID" ||
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
      } else {
        console.log(
          "Transaction lookup error:",
          txRes.status,
          await txRes.text(),
        );
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
      console.log("Transactions response:", JSON.stringify(txData));
      const lastTx = Array.isArray(txData) ? txData[0] : txData?.items?.[0];
      if (lastTx) {
        const txStatus = (lastTx.status || "").toUpperCase();
        console.log("Last tx status:", txStatus);
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
    } else {
      const errText = await txRes.text();
      console.log("Transactions error:", txRes.status, errText);
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
