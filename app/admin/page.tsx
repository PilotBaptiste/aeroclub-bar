"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Organization } from "@/lib/types";

export default function AdminDashboard() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("organizations").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setOrgs(data || []); setLoading(false); });
  }, []);

  const totalProducts = 0; // TODO: aggregate from all orgs

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Vue globale de tous vos clients</p>
        </div>
        <Link href="/admin/clients"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition cursor-pointer">
          + Nouveau client
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Clients actifs</p>
          <p className="text-3xl font-bold mt-2">{loading ? "..." : orgs.length}</p>
        </div>
        <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Produits totaux</p>
          <p className="text-3xl font-bold mt-2">{loading ? "..." : "—"}</p>
        </div>
        <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Ventes aujourd'hui</p>
          <p className="text-3xl font-bold mt-2">{loading ? "..." : "—"}</p>
        </div>
      </div>

      {/* Client list */}
      <h2 className="text-lg font-bold mb-4">Vos clients</h2>
      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement...</div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-[#1e2d4a] rounded-xl">
          <p className="text-slate-500 mb-4">Aucun client configuré</p>
          <Link href="/admin/clients"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition cursor-pointer">
            Créer votre premier client
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <Link key={org.id} href={"/admin/clients/" + org.slug}
              className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-5 hover:border-blue-500/50 transition group cursor-pointer block">
              <div className="flex items-center gap-3 mb-3">
                {org.logo_url ? (
                  <img src={org.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center text-lg font-bold text-blue-400">
                    {org.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="font-bold group-hover:text-blue-400 transition">{org.name}</h3>
                  <p className="text-xs text-slate-500">{"/client/" + org.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{"🟢 En ligne"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
