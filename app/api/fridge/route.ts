import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    if (action === "check") {
      // ESP32 polls this to know if it should unlock
      const unlock = await kv.get("aeroclub-fridge-unlock");
      return NextResponse.json({ unlock: unlock === true });
    }

    if (action === "done") {
      // ESP32 confirms unlock is done
      await kv.set("aeroclub-fridge-unlock", false);
      return NextResponse.json({ ok: true });
    }

    if (action === "trigger") {
      // Called by the app after payment to trigger unlock
      await kv.set("aeroclub-fridge-unlock", true);
      return NextResponse.json({ ok: true, message: "Frigo deverrouille !" });
    }

    return NextResponse.json(
      { error: "Action required: check, done, or trigger" },
      { status: 400 },
    );
  } catch (e) {
    console.error("Fridge API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
