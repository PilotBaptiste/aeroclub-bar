"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Organization } from "@/lib/types";

export default function ClientsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadOrgs();
  }, []);

  async function loadOrgs() {
    const { data } = await supabase.from("organizations").select("*").order("created_at");
    setOrgs(data || []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.slug) return;
    setCreating(true);
    const slug = form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    const { error } = await supabase.from("organizations").insert({
      name: form.name,
      slug,
      settings: { barName: form.name, adminPin: "1234", bureauPin: "1234" },
      theme: {},
    });
    if (error) {
      alert("Erreur : " + error.message);
      setCreating(false);
      return;
    }
    setForm({ name: "", slug: "" });
    setShowCreate(false);
    setCreating(false);
    loadOrgs();
  }

  async function handleDelete(org: Organization) {
    if (!confirm("Supprimer " + org.name + " et toutes ses données ? Cette action est irréversible.")) return;
    await supabase.from("organizations").delete().eq("id", org.id);
    loadOrgs();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">Gérez vos bars et établissements</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition cursor-pointer">
          {showCreate ? "Annuler" : "+ Nouveau client"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-[#131b2e] border border-blue-500/30 rounded-xl p-5 mb-6">
          <h3 className="font-bold mb-4">Créer un nouveau client</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Nom du bar</label>
              <input type="text" value={form.name} placeholder="Ex: Bar du Club Nautique"
                onChange={(e) => {
                  const name = e.target.value;
                  const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/-+$/g, "");
                  setForm({ name, slug });
                }}
                className="w-full h-10 rounded-lg bg-[#0B1120] border border-[#1e2d4a] px-3 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Slug (URL)</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-600">/client/</span>
                <input type="text" value={form.slug} placeholder="bar-nautique"
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="flex-1 h-10 rounded-lg bg-[#0B1120] border border-[#1e2d4a] px-3 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>
          <button type="submit" disabled={creating || !form.name || !form.slug}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-sm font-semibold cursor-pointer transition">
            {creating ? "Création..." : "Créer le client"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement...</div>
      ) : (
        <div className="space-y-3">
          {orgs.map((org) => (
            <div key={org.id} className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center text-xl font-bold text-blue-400 shrink-0">
                {org.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold">{org.name}</h3>
                <p className="text-xs text-slate-500 truncate">
                  {"Slug : " + org.slug + " · Créé le " + new Date(org.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={"/client/" + org.slug} target="_blank" rel="noopener"
                  className="px-3 py-1.5 bg-[#0B1120] border border-[#1e2d4a] rounded-lg text-xs text-slate-400 hover:text-white transition cursor-pointer">
                  Voir le bar
                </a>
                <button onClick={() => router.push("/admin/clients/" + org.slug)}
                  className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-lg text-xs text-blue-400 hover:bg-blue-600/30 transition cursor-pointer">
                  Gérer
                </button>
                <button onClick={() => handleDelete(org)}
                  className="px-3 py-1.5 bg-red-600/10 border border-red-500/20 rounded-lg text-xs text-red-400 hover:bg-red-600/20 transition cursor-pointer">
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
