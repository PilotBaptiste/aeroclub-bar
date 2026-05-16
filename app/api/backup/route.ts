import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const DATA_KEYS = [
  "aeroclub-products",
  "aeroclub-transactions",
  "aeroclub-settings",
  "aeroclub-suggestions",
  "aeroclub-members",
  "aeroclub-procurements",
  "aeroclub-coffee-credits",
  "aeroclub-batches",
];

// GET — Récupérer le backup depuis Redis
export async function GET() {
  try {
    const backup = await kv.get("aeroclub-backup-snapshot");
    if (!backup) {
      return NextResponse.json({ error: "Aucun backup trouvé" }, { status: 404 });
    }
    return NextResponse.json(backup);
  } catch (e) {
    console.error("Backup read error:", e);
    return NextResponse.json({ error: "Erreur lecture backup" }, { status: 500 });
  }
}

// POST — Créer un backup OU restaurer depuis un backup
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action; // "save" or "restore"

    if (action === "save") {
      // Sauvegarder un snapshot de toutes les données dans une clé séparée
      const snapshot: Record<string, unknown> = {};
      for (const key of DATA_KEYS) {
        const val = await kv.get(key);
        snapshot[key] = val;
      }
      snapshot["_backupDate"] = new Date().toISOString();
      snapshot["_version"] = 1;
      await kv.set("aeroclub-backup-snapshot", snapshot);
      return NextResponse.json({ ok: true, date: snapshot["_backupDate"] });
    }

    if (action === "restore") {
      // Restaurer depuis le backup stocké dans Redis
      const backup = (await kv.get("aeroclub-backup-snapshot")) as Record<string, unknown> | null;
      if (!backup) {
        return NextResponse.json({ error: "Aucun backup à restaurer" }, { status: 404 });
      }
      // Écrire chaque clé du backup dans Redis
      for (const key of DATA_KEYS) {
        if (backup[key] !== undefined && backup[key] !== null) {
          await kv.set(key, backup[key]);
        }
      }
      return NextResponse.json({ ok: true, restoredFrom: backup["_backupDate"] });
    }

    if (action === "restore-upload") {
      // Restaurer depuis un JSON uploadé par l'utilisateur
      const data = body.data;
      if (!data || !data.products) {
        return NextResponse.json({ error: "Données invalides" }, { status: 400 });
      }
      // Map les clés du backup JSON vers les clés Redis
      const keyMap: Record<string, string> = {
        products: "aeroclub-products",
        transactions: "aeroclub-transactions",
        settings: "aeroclub-settings",
        suggestions: "aeroclub-suggestions",
        members: "aeroclub-members",
        procurements: "aeroclub-procurements",
        coffeeCredits: "aeroclub-coffee-credits",
        batches: "aeroclub-batches",
      };
      for (const [jsonKey, redisKey] of Object.entries(keyMap)) {
        if (data[jsonKey] !== undefined && data[jsonKey] !== null) {
          await kv.set(redisKey, data[jsonKey]);
        }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Action invalide (save/restore/restore-upload)" }, { status: 400 });
  } catch (e) {
    console.error("Backup error:", e);
    return NextResponse.json({ error: "Erreur backup" }, { status: 500 });
  }
}
