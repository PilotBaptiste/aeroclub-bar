import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export const runtime = "edge";

interface TemperatureData {
  frigo: number | null;
  congelateur: number | null;
  lastUpdate: string;
}

interface TempAlertState {
  frigoAlerted?: boolean;        // true = on est actuellement hors plage (alerte envoyée)
  congelateurAlerted?: boolean;
}

const KV_KEY = "aeroclub-temperatures";
const ALERT_STATE_KEY = "aeroclub-temp-alert-state";

// ── Seuils ──
const FRIGO_MIN = 6;         // °C — en-dessous = alerte
const FRIGO_MAX = 8;         // °C — au-dessus = alerte
const CONGELATEUR_MIN = -18; // °C — en-dessous = alerte
const CONGELATEUR_MAX = -14; // °C — au-dessus = alerte

async function sendTelegram(message: string) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return; // pas configuré = silencieux
  await fetch(
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
  ).catch(() => {}); // on ne bloque pas l'ESP32 si Telegram fail
}

// GET - Lire les dernieres temperatures (appele par le frontend)
export async function GET() {
  try {
    const data = (await kv.get(KV_KEY)) as TemperatureData | null;

    if (!data) {
      return NextResponse.json({
        frigo: null,
        congelateur: null,
        lastUpdate: null,
      });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("Temperature GET error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST - Recevoir les temperatures de l'ESP32 + vérifier les seuils
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const data: TemperatureData = {
      frigo: typeof body.frigo === "number" ? body.frigo : null,
      congelateur: typeof body.congelateur === "number" ? body.congelateur : null,
      lastUpdate: new Date().toISOString(),
    };

    await kv.set(KV_KEY, data);

    // ── Vérification des seuils + alertes Telegram ──
    // Une seule alerte quand la température SORT de la plage,
    // puis une seule notification quand elle REVIENT dans la plage.
    const alertState = ((await kv.get(ALERT_STATE_KEY)) as TempAlertState | null) || {};
    let stateChanged = false;

    // ── FRIGO (plage 6°C – 8°C) ──
    if (data.frigo !== null) {
      const frigoHorsPlage = data.frigo < FRIGO_MIN || data.frigo > FRIGO_MAX;
      if (frigoHorsPlage && !alertState.frigoAlerted) {
        // Vient de sortir de la plage → 1 seule alerte
        const direction = data.frigo > FRIGO_MAX ? "trop haute 📈" : "trop basse 📉";
        await sendTelegram(
          "🌡️🔴 <b>ALERTE TEMPERATURE FRIGO</b>\n\n" +
          "Température " + direction + " : <b>" + data.frigo.toFixed(1) + "°C</b>\n" +
          "⚠️ Plage normale : " + FRIGO_MIN + "°C à " + FRIGO_MAX + "°C\n\n" +
          "Vérifiez que la porte est bien fermée !"
        );
        alertState.frigoAlerted = true;
        stateChanged = true;
      } else if (!frigoHorsPlage && alertState.frigoAlerted) {
        // Vient de revenir dans la plage → notification retour OK
        await sendTelegram(
          "🌡️✅ <b>FRIGO OK</b>\n\n" +
          "📉 Température revenue à <b>" + data.frigo.toFixed(1) + "°C</b> (plage : " + FRIGO_MIN + "–" + FRIGO_MAX + "°C)"
        );
        alertState.frigoAlerted = false;
        stateChanged = true;
      }
    }

    // ── CONGÉLATEUR (plage -18°C – -14°C) ──
    if (data.congelateur !== null) {
      const congelateurHorsPlage = data.congelateur < CONGELATEUR_MIN || data.congelateur > CONGELATEUR_MAX;
      if (congelateurHorsPlage && !alertState.congelateurAlerted) {
        // Vient de sortir de la plage → 1 seule alerte
        const direction = data.congelateur > CONGELATEUR_MAX ? "trop haute 📈" : "trop basse 📉";
        await sendTelegram(
          "🌡️🔴 <b>ALERTE TEMPERATURE CONGELATEUR</b>\n\n" +
          "Température " + direction + " : <b>" + data.congelateur.toFixed(1) + "°C</b>\n" +
          "⚠️ Plage normale : " + CONGELATEUR_MIN + "°C à " + CONGELATEUR_MAX + "°C\n\n" +
          "Vérifiez que la porte est bien fermée !"
        );
        alertState.congelateurAlerted = true;
        stateChanged = true;
      } else if (!congelateurHorsPlage && alertState.congelateurAlerted) {
        // Vient de revenir dans la plage → notification retour OK
        await sendTelegram(
          "🌡️✅ <b>CONGELATEUR OK</b>\n\n" +
          "📉 Température revenue à <b>" + data.congelateur.toFixed(1) + "°C</b> (plage : " + CONGELATEUR_MIN + "–" + CONGELATEUR_MAX + "°C)"
        );
        alertState.congelateurAlerted = false;
        stateChanged = true;
      }
    }

    if (stateChanged) {
      await kv.set(ALERT_STATE_KEY, alertState);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Temperature POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
