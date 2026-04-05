import { NextResponse } from "next/server";

export const runtime = "edge";

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
    // via les transactions récentes filtrées par client_transaction_id
    const since = new Date(Date.now() - 60000).toISOString();
    const txRes = await fetch(
      `https://api.sumup.com/v0.1/me/transactions/history?limit=10&newest_time=${new Date().toISOString()}&oldest_time=${since}`,
      {
        headers: { Authorization: "Bearer " + API_KEY },
        cache: "no-store",
      },
    );

    if (txRes.ok) {
      const txData = await txRes.json();
      console.log("Transactions history:", JSON.stringify(txData));
      const items = txData?.items || (Array.isArray(txData) ? txData : []);

      // Cherche la transaction correspondant au checkoutId
      let matchedTx = checkoutId
        ? items.find(
            (t: { client_transaction_id?: string }) =>
              t.client_transaction_id === checkoutId,
          )
        : items[0];

      // Fallback sur la plus récente si pas trouvée
      if (!matchedTx) matchedTx = items[0];

      if (matchedTx) {
        const txStatus = (matchedTx.status || "").toUpperCase();
        console.log(
          "Matched tx status:",
          txStatus,
          "client_tx_id:",
          matchedTx.client_transaction_id,
        );
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
