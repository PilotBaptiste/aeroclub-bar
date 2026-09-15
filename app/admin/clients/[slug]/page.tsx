"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Organization, Product, Member, Category } from "@/lib/types";

type Tab = "products" | "members" | "categories" | "settings";

export default function ClientManagePage() {
  const { slug } = useParams<{ slug: string }>();
  const supabase = createClient();
  const [org, setOrg] = useState<Organization | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<Tab>("products");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [slug]);

  async function load() {
    setLoading(true);
    const { data: orgData } = await supabase.from("organizations").select("*").eq("slug", slug).single();
    if (!orgData) { setLoading(false); return; }
    setOrg(orgData);
    const [prods, mems, cats] = await Promise.all([
      supabase.from("products").select("*").eq("org_id", orgData.id).order("position"),
      supabase.from("members").select("*").eq("org_id", orgData.id).order("name"),
      supabase.from("categories").select("*").eq("org_id", orgData.id).order("position"),
    ]);
    setProducts(prods.data || []);
    setMembers(mems.data || []);
    setCategories(cats.data || []);
    setLoading(false);
  }

  async function updateProduct(id: string, updates: Partial<Product>) {
    await supabase.from("products").update(updates).eq("id", id);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }

  async function deleteProduct(id: string) {
    await supabase.from("products").delete().eq("id", id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  async function addProduct() {
    if (!org) return;
    const { data } = await supabase.from("products").insert({
      org_id: org.id, name: "Nouveau produit", emoji: "📦", price: 1, cost: 0,
      stock: 0, stock_reserve: 0, location: "frigo" as const, position: products.length,
    }).select().single();
    if (data) setProducts(prev => [...prev, data]);
  }

  async function addMember() {
    if (!org) return;
    const { data } = await supabase.from("members").insert({
      org_id: org.id, name: "Nouveau membre", balance: 0,
    }).select().single();
    if (data) setMembers(prev => [...prev, data]);
  }

  async function addCategory() {
    if (!org) return;
    const { data } = await supabase.from("categories").insert({
      org_id: org.id, name: "Nouvelle catégorie", emoji: "📂", position: categories.length,
    }).select().single();
    if (data) setCategories(prev => [...prev, data]);
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Chargement...</div>;
  if (!org) return <div className="flex items-center justify-center h-full text-slate-500">Client introuvable</div>;

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "products", label: "Produits", icon: "📦" },
    { id: "members", label: "Membres", icon: "👥" },
    { id: "categories", label: "Catégories", icon: "🏷️" },
    { id: "settings", label: "Paramètres", icon: "⚙️" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/clients" className="text-slate-500 hover:text-white transition text-sm">{"← Clients"}</Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            <a href={"/client/" + org.slug} target="_blank" rel="noopener" className="text-blue-400 hover:underline">
              {"/client/" + org.slug}
            </a>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#0f172a] rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={"px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition " + (tab === t.id ? "bg-[#131b2e] text-white" : "text-slate-500 hover:text-white")}>
            {t.icon + " " + t.label}
          </button>
        ))}
      </div>

      {/* Products tab */}
      {tab === "products" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">{"Produits (" + products.filter(p => !p.archived).length + ")"}</h2>
            <button onClick={addProduct}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-semibold cursor-pointer transition">
              + Ajouter
            </button>
          </div>
          {(["frigo", "cafe", "congelateur"] as const).map(loc => {
            const locProducts = products.filter(p => !p.archived && p.location === loc);
            if (locProducts.length === 0) return null;
            const label = loc === "frigo" ? "🧊 Frigo" : loc === "cafe" ? "☕ Café" : "❄️ Congélateur";
            return (
              <div key={loc} className="mb-6">
                <h3 className="text-sm font-semibold text-slate-400 mb-2">{label + " (" + locProducts.length + ")"}</h3>
                <div className="space-y-1">
                  {locProducts.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 py-2 group">
                      <span className="text-lg shrink-0">{p.emoji}</span>
                      <input value={p.name}
                        onChange={e => setProducts(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                        onBlur={() => updateProduct(p.id, { name: p.name })}
                        className="flex-1 bg-transparent text-sm font-medium outline-none min-w-0" />
                      <div className="flex items-center gap-2 shrink-0">
                        <input type="number" value={p.price} step="0.1" min="0"
                          onChange={e => { const v = parseFloat(e.target.value) || 0; setProducts(prev => prev.map(x => x.id === p.id ? { ...x, price: v } : x)); }}
                          onBlur={() => updateProduct(p.id, { price: p.price })}
                          className="w-16 bg-[#0B1120] border border-[#1e2d4a] rounded px-2 py-1 text-xs text-right outline-none focus:border-blue-500" />
                        <span className="text-[10px] text-slate-500">{"€"}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => updateProduct(p.id, { stock: Math.max(0, p.stock - 1) })}
                          className="w-6 h-6 rounded bg-[#0B1120] border border-[#1e2d4a] text-xs font-bold text-slate-400 cursor-pointer hover:text-white">-</button>
                        <span className={"text-sm font-bold w-8 text-center tabular-nums " + (p.stock <= 0 ? "text-red-500" : p.stock <= 3 ? "text-orange-400" : "text-emerald-400")}>
                          {p.stock}
                        </span>
                        <button onClick={() => updateProduct(p.id, { stock: p.stock + 1 })}
                          className="w-6 h-6 rounded bg-[#0B1120] border border-[#1e2d4a] text-xs font-bold text-slate-400 cursor-pointer hover:text-white">+</button>
                      </div>
                      <select value={p.location}
                        onChange={e => updateProduct(p.id, { location: e.target.value as Product["location"] })}
                        className="bg-[#0B1120] border border-[#1e2d4a] rounded px-1.5 py-1 text-[10px] text-slate-400 outline-none cursor-pointer">
                        <option value="frigo">Frigo</option>
                        <option value="cafe">Café</option>
                        <option value="congelateur">Congél.</option>
                      </select>
                      <button onClick={() => deleteProduct(p.id)}
                        className="text-red-500/50 hover:text-red-400 text-sm cursor-pointer opacity-0 group-hover:opacity-100 transition">{"🗑"}</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {products.filter(p => p.archived).length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-slate-500 cursor-pointer">
                {"Archivés (" + products.filter(p => p.archived).length + ")"}
              </summary>
              <div className="mt-2 space-y-1">
                {products.filter(p => p.archived).map(p => (
                  <div key={p.id} className="flex items-center gap-3 bg-[#0f172a] border border-[#1e2d4a] rounded-lg px-3 py-2 opacity-50">
                    <span>{p.emoji + " " + p.name}</span>
                    <button onClick={() => updateProduct(p.id, { archived: false })}
                      className="ml-auto text-xs text-amber-400 cursor-pointer">Réactiver</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === "members" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">{"Membres (" + members.length + ")"}</h2>
            <button onClick={addMember}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-semibold cursor-pointer transition">
              + Ajouter
            </button>
          </div>
          <div className="space-y-1">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-xs font-bold text-blue-400">
                  {m.name.charAt(0)}
                </div>
                <input value={m.name}
                  onChange={e => setMembers(prev => prev.map(x => x.id === m.id ? { ...x, name: e.target.value } : x))}
                  onBlur={() => supabase.from("members").update({ name: m.name }).eq("id", m.id)}
                  className="flex-1 bg-transparent text-sm font-medium outline-none" />
                <span className={"text-sm font-bold " + (m.balance < 0 ? "text-red-400" : "text-emerald-400")}>
                  {m.balance.toFixed(2) + " €"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categories tab */}
      {tab === "categories" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">{"Catégories (" + categories.length + ")"}</h2>
            <button onClick={addCategory}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-semibold cursor-pointer transition">
              + Ajouter
            </button>
          </div>
          <div className="space-y-1">
            {categories.map(c => (
              <div key={c.id} className="flex items-center gap-3 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 py-2">
                <input value={c.emoji}
                  onChange={e => setCategories(prev => prev.map(x => x.id === c.id ? { ...x, emoji: e.target.value } : x))}
                  onBlur={() => supabase.from("categories").update({ emoji: c.emoji }).eq("id", c.id)}
                  className="w-10 bg-transparent text-center text-lg outline-none" />
                <input value={c.name}
                  onChange={e => setCategories(prev => prev.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))}
                  onBlur={() => supabase.from("categories").update({ name: c.name }).eq("id", c.id)}
                  className="flex-1 bg-transparent text-sm font-medium outline-none" />
                <button onClick={async () => { await supabase.from("categories").delete().eq("id", c.id); setCategories(prev => prev.filter(x => x.id !== c.id)); }}
                  className="text-red-500/50 hover:text-red-400 text-sm cursor-pointer">{"🗑"}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <div className="max-w-lg">
          <h2 className="font-bold mb-4">Paramètres du bar</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Nom du bar</label>
              <input value={org.name}
                onChange={e => setOrg({ ...org, name: e.target.value })}
                onBlur={() => supabase.from("organizations").update({ name: org.name }).eq("id", org.id)}
                className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Slug (URL)</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">/client/</span>
                <input value={org.slug} disabled
                  className="flex-1 h-10 bg-[#0B1120] border border-[#1e2d4a] rounded-lg px-3 text-sm text-slate-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">URL du logo</label>
              <input value={org.logo_url || ""}
                onChange={e => setOrg({ ...org, logo_url: e.target.value })}
                onBlur={() => supabase.from("organizations").update({ logo_url: org.logo_url }).eq("id", org.id)}
                placeholder="https://..."
                className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
