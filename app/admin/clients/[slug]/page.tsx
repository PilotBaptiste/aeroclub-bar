"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Organization, Product, Member, Category } from "@/lib/types";

type Tab = "products" | "members" | "categories" | "settings";

function isUrl(s: string | null | undefined): boolean {
  return !!s && (s.startsWith("http://") || s.startsWith("https://"));
}

function ProductIcon({ emoji }: { emoji: string | null }) {
  if (!emoji) return <span className="text-lg">{"📦"}</span>;
  if (isUrl(emoji)) return <img src={emoji} alt="" className="w-8 h-8 rounded object-cover" />;
  return <span className="text-lg">{emoji}</span>;
}

async function adminFetch(path: string, init?: RequestInit) {
  return fetch("/api/admin/client-data" + path, init);
}

export default function ClientManagePage() {
  const { slug } = useParams<{ slug: string }>();
  const [org, setOrg] = useState<Organization | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<Tab>("products");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  useEffect(() => { load(); }, [slug]);

  async function load() {
    setLoading(true);
    const res = await adminFetch("?slug=" + slug);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setOrg(data.org);
    setSettings((data.org?.settings as Record<string, unknown>) || {});
    setProducts(data.products || []);
    setMembers(data.members || []);
    setCategories(data.categories || []);
    setLoading(false);
  }

  async function updateProduct(id: string, updates: Partial<Product>) {
    await adminFetch("?action=update-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, updates }),
    });
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }

  async function deleteProduct(id: string) {
    await adminFetch("?action=delete-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  async function addProduct() {
    if (!org) return;
    const res = await adminFetch("?action=add-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: org.id, name: "Nouveau produit", emoji: "📦", price: 1, cost: 0,
        stock: 0, stock_reserve: 0, location: "frigo", position: products.length,
      }),
    });
    const data = await res.json();
    if (data.product) setProducts(prev => [...prev, data.product]);
  }

  async function addMember() {
    if (!org) return;
    const res = await adminFetch("?action=add-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: org.id, name: "Nouveau membre", balance: 0 }),
    });
    const data = await res.json();
    if (data.member) setMembers(prev => [...prev, data.member]);
  }

  async function addCategory() {
    if (!org) return;
    const res = await adminFetch("?action=add-category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: org.id, name: "Nouvelle categorie", emoji: "📂", position: categories.length }),
    });
    const data = await res.json();
    if (data.category) setCategories(prev => [...prev, data.category]);
  }

  async function saveSettings(newSettings: Record<string, unknown>) {
    if (!org) return;
    setSettings(newSettings);
    await adminFetch("?action=save-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: org.id, settings: newSettings }),
    });
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-500">Chargement...</div>;
  if (!org) return <div className="flex items-center justify-center h-full text-slate-500">Client introuvable</div>;

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "products", label: "Produits", icon: "📦" },
    { id: "members", label: "Membres", icon: "👥" },
    { id: "categories", label: "Catégories", icon: "🏷️" },
    { id: "settings", label: "Paramètres", icon: "⚙️" },
  ];

  const activeProducts = products.filter(p => !p.archived);

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
            <h2 className="font-bold">{"Produits (" + activeProducts.length + ")"}</h2>
            <button onClick={addProduct}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-semibold cursor-pointer transition">
              + Ajouter
            </button>
          </div>
          {(["frigo", "cafe", "congelateur"] as const).map(loc => {
            const locProducts = activeProducts.filter(p => p.location === loc);
            if (locProducts.length === 0) return null;
            const label = loc === "frigo" ? "🧊 Frigo" : loc === "cafe" ? "☕ Café" : "❄️ Congélateur";
            return (
              <div key={loc} className="mb-6">
                <h3 className="text-sm font-semibold text-slate-400 mb-2">{label + " (" + locProducts.length + ")"}</h3>
                <div className="space-y-1">
                  {locProducts.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 py-2 group">
                      <div className="w-8 h-8 flex items-center justify-center shrink-0">
                        <ProductIcon emoji={p.emoji} />
                      </div>
                      <input value={p.name}
                        onChange={e => setProducts(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                        onBlur={() => updateProduct(p.id, { name: p.name })}
                        className="flex-1 bg-transparent text-sm font-medium outline-none min-w-0" />
                      <div className="flex items-center gap-1 shrink-0">
                        <input type="number" value={p.price} step="0.1" min="0"
                          onChange={e => { const v = parseFloat(e.target.value) || 0; setProducts(prev => prev.map(x => x.id === p.id ? { ...x, price: v } : x)); }}
                          onBlur={() => updateProduct(p.id, { price: p.price })}
                          className="w-14 bg-[#0B1120] border border-[#1e2d4a] rounded px-2 py-1 text-xs text-right outline-none focus:border-blue-500" />
                        <span className="text-[10px] text-slate-500">€</span>
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
                        className="text-red-500/50 hover:text-red-400 text-sm cursor-pointer opacity-0 group-hover:opacity-100 transition">🗑</button>
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
                    <ProductIcon emoji={p.emoji} />
                    <span className="text-sm">{p.name}</span>
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
            <h2 className="font-bold">{"Membres (" + members.filter(m => !m.archived).length + ")"}</h2>
            <button onClick={addMember}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-semibold cursor-pointer transition">
              + Ajouter
            </button>
          </div>
          <div className="space-y-1">
            {members.filter(m => !m.archived).map(m => (
              <div key={m.id} className="flex items-center gap-3 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
                  {m.name.charAt(0)}
                </div>
                <input value={m.name}
                  onChange={e => setMembers(prev => prev.map(x => x.id === m.id ? { ...x, name: e.target.value } : x))}
                  onBlur={() => adminFetch("?action=update-member", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id, updates: { name: m.name } }) })}
                  className="flex-1 bg-transparent text-sm font-medium outline-none" />
                <span className={"text-sm font-bold tabular-nums " + (Number(m.balance) < 0 ? "text-red-400" : "text-emerald-400")}>
                  {Number(m.balance).toFixed(2) + " €"}
                </span>
              </div>
            ))}
          </div>
          {members.filter(m => m.archived).length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-slate-500 cursor-pointer">
                {"Archivés (" + members.filter(m => m.archived).length + ")"}
              </summary>
              <div className="mt-2 space-y-1">
                {members.filter(m => m.archived).map(m => (
                  <div key={m.id} className="flex items-center gap-3 bg-[#0f172a] border border-[#1e2d4a] rounded-lg px-3 py-2 opacity-50">
                    <span className="text-sm">{m.name}</span>
                    <span className="ml-auto text-sm">{Number(m.balance).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            </details>
          )}
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
          {categories.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              <p>Aucune catégorie. Les catégories de l'ancien système sont dans les paramètres (settings).</p>
              <p className="mt-1">Cliquez sur "+ Ajouter" pour en créer, ou relancez la migration.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {categories.map(c => (
                <div key={c.id} className="flex items-center gap-3 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 py-2 group">
                  <input value={c.emoji || ""}
                    onChange={e => setCategories(prev => prev.map(x => x.id === c.id ? { ...x, emoji: e.target.value } : x))}
                    onBlur={() => adminFetch("?action=update-category", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, updates: { emoji: c.emoji } }) })}
                    className="w-10 bg-transparent text-center text-lg outline-none" />
                  <input value={c.name}
                    onChange={e => setCategories(prev => prev.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))}
                    onBlur={() => adminFetch("?action=update-category", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, updates: { name: c.name } }) })}
                    className="flex-1 bg-transparent text-sm font-medium outline-none" />
                  <button onClick={async () => { await adminFetch("?action=delete-category", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) }); setCategories(prev => prev.filter(x => x.id !== c.id)); }}
                    className="text-red-500/50 hover:text-red-400 text-sm cursor-pointer opacity-0 group-hover:opacity-100 transition">🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <div className="max-w-2xl">
          <h2 className="font-bold mb-4">Paramètres du bar</h2>
          <div className="space-y-4">
            {/* Identity */}
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Nom du club</label>
              <input value={org.name}
                onChange={e => setOrg({ ...org, name: e.target.value })}
                onBlur={() => adminFetch("?action=update-org", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: org.id, updates: { name: org.name } }) })}
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
              <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Nom affiché sur le bar (en-tete)</label>
              <input value={String(settings.clubName || "")}
                onChange={e => setSettings({ ...settings, clubName: e.target.value })}
                onBlur={() => saveSettings({ ...settings })}
                placeholder={org.name}
                className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Sous-titre (sous le nom du bar)</label>
              <input value={String(settings.subtitle || "")}
                onChange={e => setSettings({ ...settings, subtitle: e.target.value })}
                onBlur={() => saveSettings({ ...settings })}
                placeholder="Ex: Bassin d'Arcachon"
                className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">URL du logo</label>
              <div className="flex items-center gap-3">
                <input value={String(settings.logoUrl || org.logo_url || "")}
                  onChange={e => setSettings({ ...settings, logoUrl: e.target.value })}
                  onBlur={() => {
                    saveSettings({ ...settings });
                    adminFetch("?action=update-org", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: org.id, updates: { logo_url: settings.logoUrl || null } }) });
                  }}
                  placeholder="https://..."
                  className="flex-1 h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
                {(settings.logoUrl || org.logo_url) && (
                  <img src={String(settings.logoUrl || org.logo_url)} alt="" className="w-10 h-10 rounded-lg object-contain bg-white/5" />
                )}
              </div>
            </div>

            <hr className="border-[#1e2d4a]" />
            <h3 className="font-semibold text-sm">Codes d'acces</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">PIN Admin</label>
                <input value={String(settings.adminPin || "")}
                  onChange={e => setSettings({ ...settings, adminPin: e.target.value })}
                  onBlur={() => saveSettings({ ...settings })}
                  placeholder="1234"
                  className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500 font-mono tracking-widest" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">PIN Bureau</label>
                <input value={String(settings.bureauPin || "")}
                  onChange={e => setSettings({ ...settings, bureauPin: e.target.value })}
                  onBlur={() => saveSettings({ ...settings })}
                  placeholder="0000"
                  className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500 font-mono tracking-widest" />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Horaires d'ouverture</label>
              <input value={String(settings.openingHours || "")}
                onChange={e => setSettings({ ...settings, openingHours: e.target.value })}
                onBlur={() => saveSettings({ ...settings })}
                placeholder="Mer 18h-20h, Sam 10h-12h"
                className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
            </div>

            <hr className="border-[#1e2d4a]" />
            <h3 className="font-semibold text-sm">Infos pratiques (affichees sur la page d'accueil)</h3>
            <div className="space-y-2">
              {(((settings.homepage as Record<string, unknown>)?.infos as Array<{ emoji: string; title: string; subtitle: string }>) || []).map((info, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#0f172a] border border-[#1e2d4a] rounded-lg px-3 py-2">
                  <input value={info.emoji}
                    onChange={e => {
                      const hp = (settings.homepage || {}) as Record<string, unknown>;
                      const infos = [...((hp.infos as Array<Record<string, string>>) || [])];
                      infos[i] = { ...infos[i], emoji: e.target.value };
                      setSettings({ ...settings, homepage: { ...hp, infos } });
                    }}
                    onBlur={() => saveSettings({ ...settings })}
                    className="w-10 bg-transparent text-center text-lg outline-none" />
                  <input value={info.title} placeholder="Titre"
                    onChange={e => {
                      const hp = (settings.homepage || {}) as Record<string, unknown>;
                      const infos = [...((hp.infos as Array<Record<string, string>>) || [])];
                      infos[i] = { ...infos[i], title: e.target.value };
                      setSettings({ ...settings, homepage: { ...hp, infos } });
                    }}
                    onBlur={() => saveSettings({ ...settings })}
                    className="flex-1 bg-transparent text-sm font-medium outline-none" />
                  <input value={info.subtitle} placeholder="Description"
                    onChange={e => {
                      const hp = (settings.homepage || {}) as Record<string, unknown>;
                      const infos = [...((hp.infos as Array<Record<string, string>>) || [])];
                      infos[i] = { ...infos[i], subtitle: e.target.value };
                      setSettings({ ...settings, homepage: { ...hp, infos } });
                    }}
                    onBlur={() => saveSettings({ ...settings })}
                    className="flex-1 bg-transparent text-sm text-slate-400 outline-none" />
                  <button onClick={() => {
                    const hp = (settings.homepage || {}) as Record<string, unknown>;
                    const infos = [...((hp.infos as Array<Record<string, string>>) || [])];
                    infos.splice(i, 1);
                    const next = { ...settings, homepage: { ...hp, infos } };
                    setSettings(next); saveSettings(next);
                  }} className="text-red-500/50 hover:text-red-400 text-sm cursor-pointer">{"x"}</button>
                </div>
              ))}
              <button onClick={() => {
                const hp = (settings.homepage || {}) as Record<string, unknown>;
                const infos = [...((hp.infos as Array<Record<string, string>>) || []), { emoji: "📌", title: "Titre", subtitle: "Description" }];
                const next = { ...settings, homepage: { ...hp, infos } };
                setSettings(next); saveSettings(next);
              }} className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-lg text-xs text-blue-400 cursor-pointer hover:bg-blue-600/30 transition">
                + Ajouter une info
              </button>
            </div>

            <hr className="border-[#1e2d4a]" />
            <h3 className="font-semibold text-sm">Fidelite</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Cafes pour 1 gratuit</label>
                <input type="number" min="1"
                  value={String((settings.loyaltyThresholds as Record<string, number> | undefined)?.coffee || 10)}
                  onChange={e => {
                    const lt = { ...((settings.loyaltyThresholds as Record<string, number>) || {}), coffee: parseInt(e.target.value) || 10 };
                    setSettings({ ...settings, loyaltyThresholds: lt });
                  }}
                  onBlur={() => saveSettings({ ...settings })}
                  className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Madeleines pour 1 gratuite</label>
                <input type="number" min="1"
                  value={String((settings.loyaltyThresholds as Record<string, number> | undefined)?.madeleine || 10)}
                  onChange={e => {
                    const lt = { ...((settings.loyaltyThresholds as Record<string, number>) || {}), madeleine: parseInt(e.target.value) || 10 };
                    setSettings({ ...settings, loyaltyThresholds: lt });
                  }}
                  onBlur={() => saveSettings({ ...settings })}
                  className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>

            <hr className="border-[#1e2d4a]" />
            <h3 className="font-semibold text-sm">SumUp (paiement par carte)</h3>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Taux de commission SumUp (%)</label>
              <input type="number" step="0.1" min="0" max="10"
                value={String(settings.sumupFeeRate ?? 2.5)}
                onChange={e => setSettings({ ...settings, sumupFeeRate: parseFloat(e.target.value) || 2.5 })}
                onBlur={() => saveSettings({ ...settings })}
                className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Cle API SumUp (Merchant Code)</label>
              <input value={String(settings.sumupMerchantCode || "")}
                onChange={e => setSettings({ ...settings, sumupMerchantCode: e.target.value })}
                onBlur={() => saveSettings({ ...settings })}
                placeholder="MC..."
                className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500 font-mono" />
            </div>

            <hr className="border-[#1e2d4a]" />
            <h3 className="font-semibold text-sm">ESP32 / LED Frigo</h3>
            <p className="text-xs text-slate-500 mb-2">{"L'ESP32 doit etre connecte au meme reseau ou accessible via une IP publique/VPN pour le controle a distance."}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">IP de l'ESP32</label>
                <input value={String(settings.esp32Ip || "")}
                  onChange={e => setSettings({ ...settings, esp32Ip: e.target.value })}
                  onBlur={() => saveSettings({ ...settings })}
                  placeholder="192.168.1.100"
                  className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500 font-mono" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Port</label>
                <input type="number" value={String(settings.esp32Port || 80)}
                  onChange={e => setSettings({ ...settings, esp32Port: parseInt(e.target.value) || 80 })}
                  onBlur={() => saveSettings({ ...settings })}
                  className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500 font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">LED activees</label>
                <select value={settings.ledEnabled ? "true" : "false"}
                  onChange={e => {
                    const next = { ...settings, ledEnabled: e.target.value === "true" };
                    setSettings(next); saveSettings(next);
                  }}
                  className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500 cursor-pointer">
                  <option value="true">Oui</option>
                  <option value="false">Non</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">LED par etagere</label>
                <input type="number" min="1"
                  value={String(settings.ledsPerShelf || 30)}
                  onChange={e => setSettings({ ...settings, ledsPerShelf: parseInt(e.target.value) || 30 })}
                  onBlur={() => saveSettings({ ...settings })}
                  className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Luminosite (0-255)</label>
                <input type="number" min="0" max="255"
                  value={String(settings.ledBrightness ?? 100)}
                  onChange={e => setSettings({ ...settings, ledBrightness: parseInt(e.target.value) || 100 })}
                  onBlur={() => saveSettings({ ...settings })}
                  className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Animation produit</label>
                <select value={String(settings.ledAnimation || "none")}
                  onChange={e => {
                    const next = { ...settings, ledAnimation: e.target.value };
                    setSettings(next); saveSettings(next);
                  }}
                  className="w-full h-10 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500 cursor-pointer">
                  <option value="none">Aucune</option>
                  <option value="chase">Chase</option>
                  <option value="flash">Flash</option>
                  <option value="snake">Snake</option>
                  <option value="edges">Edges</option>
                  <option value="serpentin">Serpentin</option>
                  <option value="converge">Converge</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
