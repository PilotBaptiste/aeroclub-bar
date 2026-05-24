import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export const runtime = "edge";

interface Settings {
  ledEnabled?: boolean;
  ledOnTime?: string;        // "HH:MM"
  ledOffTime?: string;       // "HH:MM"
  ledForceState?: "on" | "off" | "auto";  // forçage manuel
}

// GET - L'ESP32 appelle cette route pour savoir si la LED doit etre allumee
export async function GET() {
  try {
    const settings = (await kv.get("aeroclub-settings")) as Settings | null;

    if (!settings || !settings.ledEnabled) {
      return NextResponse.json({ led: false, reason: "disabled" });
    }

    // Forçage manuel ON/OFF
    if (settings.ledForceState === "on") {
      return NextResponse.json({ led: true, reason: "force-on" });
    }
    if (settings.ledForceState === "off") {
      return NextResponse.json({ led: false, reason: "force-off" });
    }

    // Mode auto : planification horaire
    const onTime = settings.ledOnTime || "08:00";
    const offTime = settings.ledOffTime || "20:00";

    const now = new Date();
    const parisTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Europe/Paris" })
    );
    const currentMinutes = parisTime.getHours() * 60 + parisTime.getMinutes();

    const [onH, onM] = onTime.split(":").map(Number);
    const [offH, offM] = offTime.split(":").map(Number);
    const onMinutes = onH * 60 + onM;
    const offMinutes = offH * 60 + offM;

    let ledOn: boolean;
    if (onMinutes < offMinutes) {
      ledOn = currentMinutes >= onMinutes && currentMinutes < offMinutes;
    } else {
      ledOn = currentMinutes >= onMinutes || currentMinutes < offMinutes;
    }

    return NextResponse.json({
      led: ledOn,
      reason: "auto",
      onTime,
      offTime,
      currentTime: parisTime.getHours().toString().padStart(2, "0") + ":" +
                    parisTime.getMinutes().toString().padStart(2, "0"),
    });
  } catch (e) {
    console.error("Fridge LED error:", e);
    return NextResponse.json({ led: false, reason: "error" });
  }
}
