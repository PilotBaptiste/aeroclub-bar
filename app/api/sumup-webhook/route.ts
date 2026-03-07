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

    // IDLE = terminal libre = paiement terminé → vérifie si succès ou échec
    // via les transactions récentes (dernière minute)
    const since = new Date(Date.now() - 60000).toISOString();
    const txRes = await fetch(
      `https://api.sumup.com/v0.1/me/transactions/history?limit=1&newest_time=${new Date().toISOString()}&oldest_time=${since}`,
      {
        headers: { Authorization: "Bearer " + API_KEY },
        cache: "no-store",
      },
    );

    if (txRes.ok) {
      const txData = await txRes.json();
      console.log("Transactions history:", JSON.stringify(txData));
      const lastTx =
        txData?.items?.[0] || (Array.isArray(txData) ? txData[0] : null);
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
        if (
          txStatus === "FAILED" ||
          txStatus === "CANCELLED" ||
          txStatus === "DECLINED"
        ) {
          return NextResponse.json({ status: "failed" });
        }
      }
    } else {
      console.log(
        "Transactions history error:",
        txRes.status,
        await txRes.text(),
      );
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
