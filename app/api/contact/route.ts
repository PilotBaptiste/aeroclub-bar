import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { name, email, club, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const recipients = ["baptistesutterpro@gmail.com", "damien.granereau@gmail.com"];
    const subject = `[BarManager] Contact de ${name}${club ? ` (${club})` : ""}`;
    const body = [
      `Nom: ${name}`,
      `Email: ${email}`,
      club ? `Club: ${club}` : null,
      `\nMessage:\n${message}`,
    ].filter(Boolean).join("\n");

    // Store in Supabase for now (no email service configured yet)
    // When ready, integrate with Resend, SendGrid, or similar
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    await supabase.from("contact_messages").insert({
      name,
      email,
      club: club || null,
      message,
      recipients,
    }).then(() => {});

    // Log for now
    console.log("=== CONTACT FORM ===");
    console.log("To:", recipients.join(", "));
    console.log("Subject:", subject);
    console.log(body);
    console.log("====================");

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Contact form error:", e);
    return NextResponse.json({ ok: true });
  }
}
