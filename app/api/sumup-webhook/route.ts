import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

// SumUp appelle cette URL quand le paiement est confirmé ou refusé
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session");

    if (!sessionId) {
      return NextResponse.json({ error: "Session manquante" }, { status: 400 });
    }

    const body = await request.json();
    // body.status : "SUCCESSFUL", "FAILED", "CANCELLED"
    const status = body.status === "SUCCESSFUL" ? "success" : "failed";

    await kv.set(
      "sumup-session:" + sessionId,
      {
        status,
        transactionCode: body.transaction_code || null,
        transactionId: body.id || null,
      },
      { ex: 300 },
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json({ error: "Erreur webhook" }, { status: 500 });
  }
}

// GET : polling depuis le frontend pour connaître le statut
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session");

    if (!sessionId) {
      return NextResponse.json({ error: "Session manquante" }, { status: 400 });
    }

    const data = await kv.get<{ status: string }>("sumup-session:" + sessionId);
    return NextResponse.json({ status: data?.status || "pending" });
  } catch (e) {
    console.error("Polling error:", e);
    return NextResponse.json({ status: "pending" });
  }
}
