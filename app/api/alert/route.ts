import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

async function sendTelegram(message: string) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) throw new Error("Telegram non configure");
  const res = await fetch(
    "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    },
  );
  if (!res.ok) throw new Error("Telegram error: " + (await res.text()));
}

// ─── POST : alerte stock (appelé par le frontend) ───
export async function POST(request: Request) {
  try {
    const { productName, stock, level } = await request.json();
    let message: string;

    if (level === "critical" || stock === 0) {
      message =
        "🚨 <b>RUPTURE DE STOCK</b> - Aero-Club Bar\n\n" +
        "📦 <b>" + productName + "</b> : 0 restant !\n\n" +
        "⚠️ Réapprovisionnement urgent nécessaire !";
    } else if (level === "alert" || stock <= 2) {
      message =
        "⚠️ <b>STOCK BAS</b> - Aero-Club Bar\n\n" +
        "📦 <b>" + productName + "</b> : " + stock + " restant" + (stock > 1 ? "s" : "") + "\n\n" +
        "Pensez à réapprovisionner bientôt.";
    } else {
      // info — stock faible (≤5) mais pas critique
      message =
        "ℹ️ Stock faible - Aero-Club Bar\n\n" +
        "📦 " + productName + " : " + stock + " restant" + (stock > 1 ? "s" : "");
    }

    await sendTelegram(message);
    return NextResponse.json({ ok: true, level: level || "alert" });
  } catch (e) {
    console.error("Alert error:", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── GET : rapport financier journalier (appelé par un cron Vercel à 20h) ───
export async function GET() {
  try {
    const transactions =
      (await kv.get<
        Array<{
          date: string;
          total: number;
          totalCost?: number;
          method: string;
          buyer: string;
          items: string;
        }>
      >("aeroclub-transactions")) || [];

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTx = transactions.filter(
      (t) => t.date.slice(0, 10) === todayStr,
    );

    if (todayTx.length === 0) {
      await sendTelegram(
        "📊 <b>Rapport journalier - Aero-Club Bar</b>\n\n📅 " +
          todayStr +
          "\n\nAucune vente aujourd'hui.",
      );
      return NextResponse.json({ ok: true, sales: 0 });
    }

    const totalRevenue = todayTx.reduce((s, t) => s + t.total, 0);
    const totalCost = todayTx.reduce((s, t) => s + (t.totalCost || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const allRevenue = transactions.reduce((s, t) => s + t.total, 0);
    const allProfit = transactions.reduce(
      (s, t) => s + t.total - (t.totalCost || 0),
      0,
    );

    const byMethod: Record<string, number> = {};
    for (const t of todayTx)
      byMethod[t.method] = (byMethod[t.method] || 0) + t.total;
    const methodLabels: Record<string, string> = {
      especes: "💰 Espèces",
      carte: "💳 Carte",
      avoir: "🏦 Avoir",
      offert: "🎁 Offert",
      bureau: "🎖 Bureau",
    };
    const methodLines = Object.entries(byMethod)
      .map(
        ([k, v]) => "  " + (methodLabels[k] || k) + " : " + v.toFixed(2) + " €",
      )
      .join("\n");

    const productCount: Record<string, number> = {};
    for (const t of todayTx) {
      for (const part of t.items.split(", ")) {
        const match = part.match(/^(\d+)x (.+)$/);
        if (match)
          productCount[match[2]] =
            (productCount[match[2]] || 0) + parseInt(match[1], 10);
      }
    }
    const topProducts = Object.entries(productCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, qty]) => "  • " + name + " ×" + qty)
      .join("\n");

    const message =
      "📊 <b>Rapport journalier - Aero-Club Bar</b>\n📅 " +
      todayStr +
      "\n\n" +
      "─────────────────\n" +
      "🧾 <b>Aujourd'hui</b>\n" +
      "  Ventes : " +
      todayTx.length +
      "\n" +
      "  Recette : <b>" +
      totalRevenue.toFixed(2) +
      " €</b>\n" +
      "  Coût : " +
      totalCost.toFixed(2) +
      " €\n" +
      "  Bénéfice : <b>" +
      totalProfit.toFixed(2) +
      " €</b>\n\n" +
      "💳 <b>Par mode de paiement</b>\n" +
      methodLines +
      "\n\n" +
      "🏆 <b>Top produits</b>\n" +
      (topProducts || "  —") +
      "\n\n" +
      "─────────────────\n" +
      "📈 <b>Cumul total</b>\n" +
      "  Recette : " +
      allRevenue.toFixed(2) +
      " €\n" +
      "  Bénéfice : " +
      allProfit.toFixed(2) +
      " €";

    await sendTelegram(message);
    return NextResponse.json({
      ok: true,
      sales: todayTx.length,
      revenue: totalRevenue,
    });
  } catch (e) {
    console.error("Daily report error:", e);
    return NextResponse.json({ error: "Erreur rapport" }, { status: 500 });
  }
}
