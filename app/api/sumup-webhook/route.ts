import { NextResponse } from "next/server";
import { getSumUpCredentials } from "@/lib/sumup";

// GET : polling — interroge directement l'API SumUp pour le statut du reader
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const checkoutId = searchParams.get("checkoutId");
    const org = searchParams.get("org");

    const creds = await getSumUpCredentials(org);
    if (!creds) {
      return NextResponse.json({ status: "pending" });
    }

    const res = await fetch(
      `https://api.sumup.com/v0.1/merchants/${creds.merchantCode}/readers/${creds.readerId}/status`,
      {
        headers: { Authorization: "Bearer " + creds.apiKey },
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

    if (
      readerState === "WAITING_FOR_CARD" ||
      readerState === "PROCESSING" ||
      readerState === "WAITING_FOR_PIN" ||
      readerState === "BUSY" ||
      readerState === ""
    ) {
      return NextResponse.json({ status: "pending" });
    }

    const since = new Date(Date.now() - 60000).toISOString();
    const txRes = await fetch(
      `https://api.sumup.com/v0.1/me/transactions/history?limit=10&newest_time=${new Date().toISOString()}&oldest_time=${since}`,
      {
        headers: { Authorization: "Bearer " + creds.apiKey },
        cache: "no-store",
      },
    );

    if (txRes.ok) {
      const txData = await txRes.json();
      console.log("Transactions history:", JSON.stringify(txData));
      const items = txData?.items || (Array.isArray(txData) ? txData : []);

      let matchedTx = checkoutId
        ? items.find(
            (t: { client_transaction_id?: string }) =>
              t.client_transaction_id === checkoutId,
          )
        : items[0];

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
