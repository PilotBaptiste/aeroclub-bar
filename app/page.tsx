"use client";
import { useState } from "react";
import Link from "next/link";

export default function LandingPage() {
  const [formData, setFormData] = useState({ name: "", email: "", club: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setSent(true);
    } catch {
      alert("Erreur lors de l'envoi. Contactez-nous directement par email.");
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-xl bg-[#0B1120]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm font-black">B</div>
            <span className="font-bold text-lg tracking-tight">BarManager</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-sm text-slate-400 hover:text-white transition hidden sm:block">Fonctionnalites</a>
            <a href="#contact" className="text-sm text-slate-400 hover:text-white transition hidden sm:block">Contact</a>
            <Link href="/admin" className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-semibold transition">
              Admin
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-semibold mb-6">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            {"Deja utilise par 2 aero-clubs"}
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight mb-6">
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">{"Gerez votre bar"}</span>
            <br />{"en libre-service, a distance."}
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {"BarManager est la plateforme SaaS qui permet aux associations et clubs de gerer leur bar en autonomie : ventes, stock, tresorerie, fidelite — tout depuis une tablette."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#contact"
              className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-xl text-sm font-bold transition shadow-lg shadow-orange-500/20">
              Demander une demo
            </a>
            <Link href="/client/acba"
              className="px-8 py-3.5 bg-white/5 border border-white/10 hover:border-amber-500/30 rounded-xl text-sm font-bold transition">
              {"Voir la demo ACBA"}
            </Link>
          </div>
        </div>
      </section>

      {/* Clients */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">Ils nous font confiance</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16">
            <div className="flex items-center gap-3 opacity-60 hover:opacity-100 transition">
              <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center text-xl font-bold text-blue-400">A</div>
              <div>
                <p className="font-bold text-sm">ACBA</p>
                <p className="text-xs text-slate-500">{"Aero-Club du Bassin d'Arcachon"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 opacity-60 hover:opacity-100 transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/20 flex items-center justify-center text-xl font-bold text-emerald-400">A</div>
              <div>
                <p className="font-bold text-sm">ACA</p>
                <p className="text-xs text-slate-500">{"Aero-Club d'Andernos"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">{"Tout ce qu'il faut pour gerer un bar"}</h2>
            <p className="text-slate-400 max-w-xl mx-auto">{"Un outil complet, concu pour les bars associatifs en libre-service."}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "🛒", title: "Point de vente", desc: "Interface tactile optimisee iPad. Vente rapide, combos, gestion des portions." },
              { icon: "📊", title: "Tresorerie temps reel", desc: "CA, marge, couts, commissions SumUp — tout est calcule automatiquement." },
              { icon: "📦", title: "Gestion de stock", desc: "Suivi par lot, alertes stock bas, fournisseurs, dates de peremption." },
              { icon: "👥", title: "Comptes membres", desc: "Solde prepaye, historique d'achats, avoirs fidelite par produit." },
              { icon: "💡", title: "LED Frigo connecte", desc: "Eclairage LED WS2812B pilote par ESP32. Le produit vendu clignote sur l'etagere." },
              { icon: "🌐", title: "Multi-sites", desc: "Gerez plusieurs bars depuis un seul admin. Chaque site a ses propres donnees." },
              { icon: "💳", title: "SumUp integre", desc: "Paiement par carte directement depuis l'interface. Commission tracee." },
              { icon: "📱", title: "Responsive", desc: "Fonctionne sur tablette, mobile et desktop. Interface pensee pour l'iPad." },
              { icon: "🔒", title: "Acces par PIN", desc: "PIN admin et bureau. Pas besoin de comptes complexes pour le personnel." },
            ].map((f, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:border-amber-500/20 transition group">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition">{f.icon}</div>
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">{"Comment ca marche ?"}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: "1", title: "On configure votre bar", desc: "Produits, prix, categories, logo, infos pratiques — tout est personnalisable." },
              { step: "2", title: "Vous posez une tablette", desc: "L'interface s'affiche sur un iPad (ou tout ecran). Les membres se servent seuls." },
              { step: "3", title: "Vous gerez a distance", desc: "Stock, tresorerie, parametres — tout est accessible depuis l'admin en ligne." },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xl font-black mx-auto mb-4">{s.step}</div>
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">{"Interesse ?"}</h2>
            <p className="text-slate-400">{"Contactez-nous pour une demo gratuite ou pour deployer BarManager dans votre club."}</p>
          </div>

          {sent ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4">{"✅"}</div>
              <h3 className="font-bold text-lg mb-2">{"Message envoye !"}</h3>
              <p className="text-slate-400 text-sm">{"Nous vous repondrons dans les plus brefs delais."}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Nom</label>
                  <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-11 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-4 text-sm outline-none focus:border-amber-500 transition" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Email</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full h-11 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-4 text-sm outline-none focus:border-amber-500 transition" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Nom du club / association</label>
                <input value={formData.club} onChange={e => setFormData({ ...formData, club: e.target.value })}
                  placeholder="Ex: Aero-Club de Bordeaux"
                  className="w-full h-11 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-4 text-sm outline-none focus:border-amber-500 transition" />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Message</label>
                <textarea required rows={4} value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Decrivez votre besoin..."
                  className="w-full bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-4 py-3 text-sm outline-none focus:border-amber-500 transition resize-none" />
              </div>
              <button type="submit" disabled={sending}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 rounded-xl text-sm font-bold transition shadow-lg shadow-orange-500/20 cursor-pointer">
                {sending ? "Envoi..." : "Envoyer le message"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-[10px] font-black">B</div>
            <span className="text-sm font-bold text-slate-400">BarManager</span>
          </div>
          <p className="text-xs text-slate-600">
            {"Concu avec "}{"❤️"}{" par Baptiste & Damien — "}
            <a href="mailto:baptistesutterpro@gmail.com" className="text-slate-400 hover:text-white transition">baptistesutterpro@gmail.com</a>
          </p>
          <div className="flex gap-4">
            <Link href="/admin" className="text-xs text-slate-500 hover:text-white transition">Admin</Link>
            <Link href="/client/acba" className="text-xs text-slate-500 hover:text-white transition">Demo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
