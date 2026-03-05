import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { productName, stock } = await request.json();

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
      return NextResponse.json(
        { error: "Telegram non configure" },
        { status: 500 },
      );
    }

    const message =
      "\u26A0\uFE0F STOCK BAS - Aero-Club Bar\n\n" +
      "\uD83D\uDCE6 " +
      productName +
      " : " +
      stock +
      " restant" +
      (stock > 1 ? "s" : "") +
      "\n\n" +
      "Pensez a reapprovisionner !";

    const res = await fetch(
      "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Telegram error:", err);
      return NextResponse.json({ error: "Erreur Telegram" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Alert error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
