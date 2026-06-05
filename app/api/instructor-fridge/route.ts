import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export const runtime = "edge";

async function sendTelegram(message: string) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: "HTML" }),
    });
  } catch { /* ignore */ }
}

interface Badge {
  uid: string;
  name: string;
  active: boolean;
}

interface AccessLog {
  uid: string;
  name: string;
  date: string;
}

interface InstructorSettings {
  badges: Badge[];
  stock: number;
  accessLog: AccessLog[];
}

const DEFAULT_SETTINGS: InstructorSettings = {
  badges: [],
  stock: 0,
  accessLog: [],
};

async function getSettings(): Promise<InstructorSettings> {
  const s = (await kv.get("aeroclub-instructor")) as InstructorSettings | null;
  return s || { ...DEFAULT_SETTINGS };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    // === ESP32 : vérifier un badge ===
    if (action === "check") {
      const uid = searchParams.get("uid");
      if (!uid) {
        return NextResponse.json({ authorized: false, reason: "no_uid" });
      }

      const settings = await getSettings();
      const normalizedUid = uid.toUpperCase().trim();
      const badge = settings.badges.find(
        (b) => b.uid.toUpperCase().trim() === normalizedUid
      );

      if (!badge) {
        return NextResponse.json({ authorized: false, reason: "unknown_badge" });
      }
      if (!badge.active) {
        return NextResponse.json({ authorized: false, reason: "badge_disabled", name: badge.name });
      }
      if (settings.stock <= 0) {
        return NextResponse.json({ authorized: false, reason: "no_stock", name: badge.name });
      }

      // Autorisé — décrémenter stock + logger
      settings.stock = Math.max(0, settings.stock - 1);
      settings.accessLog.unshift({
        uid: normalizedUid,
        name: badge.name,
        date: new Date().toISOString(),
      });
      // Garder max 200 derniers accès
      if (settings.accessLog.length > 200) {
        settings.accessLog = settings.accessLog.slice(0, 200);
      }
      await kv.set("aeroclub-instructor", settings);

      // Alerte Telegram si stock bas
      if (settings.stock === 5) {
        sendTelegram("⚠️ <b>Frigo Instructeurs</b>\n\n💧 Stock bas : <b>5 bouteilles</b> restantes\n\nPensez à réapprovisionner !");
      } else if (settings.stock === 0) {
        sendTelegram("🚨 <b>Frigo Instructeurs</b>\n\n💧 Stock ÉPUISÉ : <b>0 bouteille</b>\n\nLe frigo est vide !");
      }

      return NextResponse.json({
        authorized: true,
        name: badge.name,
        stock: settings.stock,
      });
    }

    // === Admin : lire les settings ===
    if (action === "settings") {
      const settings = await getSettings();
      return NextResponse.json(settings);
    }

    return NextResponse.json({ error: "Action required" }, { status: 400 });
  } catch (e) {
    console.error("Instructor fridge API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// === Admin : sauvegarder les settings ===
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "save_settings") {
      const settings = await getSettings();
      if (body.badges !== undefined) settings.badges = body.badges;
      if (body.stock !== undefined) settings.stock = body.stock;
      await kv.set("aeroclub-instructor", settings);
      return NextResponse.json({ ok: true });
    }

    if (action === "add_badge") {
      const settings = await getSettings();
      const uid = (body.uid || "").toUpperCase().trim();
      const name = (body.name || "").trim();
      if (!uid || !name) {
        return NextResponse.json({ error: "UID et nom requis" }, { status: 400 });
      }
      // Vérifier doublon
      if (settings.badges.some((b) => b.uid.toUpperCase().trim() === uid)) {
        return NextResponse.json({ error: "Badge déjà enregistré" }, { status: 400 });
      }
      settings.badges.push({ uid, name, active: true });
      await kv.set("aeroclub-instructor", settings);
      return NextResponse.json({ ok: true, badges: settings.badges });
    }

    if (action === "remove_badge") {
      const settings = await getSettings();
      const uid = (body.uid || "").toUpperCase().trim();
      settings.badges = settings.badges.filter(
        (b) => b.uid.toUpperCase().trim() !== uid
      );
      await kv.set("aeroclub-instructor", settings);
      return NextResponse.json({ ok: true, badges: settings.badges });
    }

    if (action === "toggle_badge") {
      const settings = await getSettings();
      const uid = (body.uid || "").toUpperCase().trim();
      const badge = settings.badges.find(
        (b) => b.uid.toUpperCase().trim() === uid
      );
      if (badge) {
        badge.active = !badge.active;
        await kv.set("aeroclub-instructor", settings);
      }
      return NextResponse.json({ ok: true, badges: settings.badges });
    }

    if (action === "update_stock") {
      const settings = await getSettings();
      settings.stock = Math.max(0, body.stock || 0);
      await kv.set("aeroclub-instructor", settings);
      return NextResponse.json({ ok: true, stock: settings.stock });
    }

    if (action === "clear_log") {
      const settings = await getSettings();
      settings.accessLog = [];
      await kv.set("aeroclub-instructor", settings);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (e) {
    console.error("Instructor fridge POST error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
