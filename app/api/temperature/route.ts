import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export const runtime = "edge";

interface TemperatureData {
  frigo: number | null;
  congelateur: number | null;
  lastUpdate: string;
}

interface TempAlertState {
  frigoLastAlert?: string;       // ISO timestamp du dernier envoi
  congelateurLastAlert?: string;
  frigoAlerted?: boolean;        // actuellement en alerte (pour envoyer le retour OK)
  congelateurAlerted?: boolean;
}

const KV_KEY = "aeroclub-temperatures";
const ALERT_STATE_KEY = "aeroclub-temp-alert-state";

// ── Seuils ──
const FRIGO_MAX = 8;         // °C — au-dessus = alerte
const CONGELATEUR_MAX = -15; // °C — au-dessus = alerte (congélateur doit être < -15)
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min entre deux alertes du même capteur

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
    const alertState = ((await kv.get(ALERT_STATE_KEY)) as TempAlertState | null) || {};
    const now = Date.now();
    let stateChanged = false;

    // ── FRIGO ──
    if (data.frigo !== null) {
      if (data.frigo > FRIGO_MAX) {
        // Température trop haute
        const lastAlert = alertState.frigoLastAlert ? new Date(alertState.frigoLastAlert).getTime() : 0;
        if (now - lastAlert > ALERT_COOLDOWN_MS) {
          await sendTelegram(
            "🌡️🔴 <b>ALERTE TEMPERATURE FRIGO</b>\n\n" +
            "📈 Température : <b>" + data.frigo.toFixed(1) + "°C</b>\n" +
            "⚠️ Seuil max : " + FRIGO_MAX + "°C\n\n" +
            "Vérifiez que la porte est bien fermée !\n" +
            "🔕 <i>Prochaine alerte dans 15 min max si le problème persiste</i>"
          );
          alertState.frigoLastAlert = data.lastUpdate;
          alertState.frigoAlerted = true;
          stateChanged = true;
        }
      } else if (alertState.frigoAlerted) {
        // Retour à la normale
        await sendTelegram(
          "🌡️✅ <b>FRIGO OK</b>\n\n" +
          "📉 Température revenue à <b>" + data.frigo.toFixed(1) + "°C</b> (seuil : " + FRIGO_MAX + "°C)"
        );
        alertState.frigoAlerted = false;
        alertState.frigoLastAlert = undefined;
        stateChanged = true;
      }
    }

    // ── CONGÉLATEUR ──
    if (data.congelateur !== null) {
      if (data.congelateur > CONGELATEUR_MAX) {
        const lastAlert = alertState.congelateurLastAlert ? new Date(alertState.congelateurLastAlert).getTime() : 0;
        if (now - lastAlert > ALERT_COOLDOWN_MS) {
          await sendTelegram(
            "🌡️🔴 <b>ALERTE TEMPERATURE CONGELATEUR</b>\n\n" +
            "📈 Température : <b>" + data.congelateur.toFixed(1) + "°C</b>\n" +
            "⚠️ Seuil max : " + CONGELATEUR_MAX + "°C\n\n" +
            "Vérifiez que la porte est bien fermée !\n" +
            "🔕 <i>Prochaine alerte dans 15 min max si le problème persiste</i>"
          );
          alertState.congelateurLastAlert = data.lastUpdate;
          alertState.congelateurAlerted = true;
          stateChanged = true;
        }
      } else if (alertState.congelateurAlerted) {
        await sendTelegram(
          "🌡️✅ <b>CONGELATEUR OK</b>\n\n" +
          "📉 Température revenue à <b>" + data.congelateur.toFixed(1) + "°C</b> (seuil : " + CONGELATEUR_MAX + "°C)"
        );
        alertState.congelateurAlerted = false;
        alertState.congelateurLastAlert = undefined;
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
