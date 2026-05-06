"use client";
import { useState } from "react";

const DEMO_PRODUCTS = [
  { id: "cafe", name: "Cafe", emoji: "☕", price: 0.5, stock: 50, category: "chaud" },
  { id: "eau", name: "Eau", emoji: "💧", price: 0.5, stock: 30, category: "soft" },
  { id: "coca", name: "Coca-Cola", emoji: "🥤", price: 1.0, stock: 24, category: "soft" },
  { id: "orangina", name: "Orangina", emoji: "🍊", price: 1.0, stock: 24, category: "soft" },
  { id: "icetea", name: "Ice Tea", emoji: "🧋", price: 1.0, stock: 18, category: "soft" },
  { id: "biere", name: "Biere", emoji: "🍺", price: 1.5, stock: 20, category: "alcool" },
  { id: "snack", name: "Snack", emoji: "🍫", price: 1.0, stock: 15, category: "food" },
  { id: "chips", name: "Chips", emoji: "🍟", price: 1.0, stock: 12, category: "food" },
  { id: "glace", name: "Glace", emoji: "🍦", price: 1.5, stock: 8, category: "food" },
  { id: "2xcafe", name: "2x Cafes", emoji: "☕☕", price: 0.8, stock: 25, category: "chaud" },
];

const CATEGORIES = [
  { id: null as string | null, label: "Tout", icon: "✨" },
  { id: "soft", label: "Softs", icon: "🥤" },
  { id: "chaud", label: "Chaud", icon: "☕" },
  { id: "alcool", label: "Alcool", icon: "🍺" },
  { id: "food", label: "Snacks", icon: "🍫" },
];

interface CartItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  qty: number;
}

export default function DevPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [buyerName, setBuyerName] = useState("");

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = (p: (typeof DEMO_PRODUCTS)[0]) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === p.id);
      if (ex) return prev.map((c) => (c.id === p.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { id: p.id, name: p.name, emoji: p.emoji, price: p.price, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === id);
      if (ex && ex.qty > 1) return prev.map((c) => (c.id === id ? { ...c, qty: c.qty - 1 } : c));
      return prev.filter((c) => c.id !== id);
    });
  };

  const filtered = DEMO_PRODUCTS.filter((p) => !activeCategory || p.category === activeCategory);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0c1220] via-[#0a0f1c] to-[#0c1220] text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0f1c]/80 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-lg shadow-lg shadow-amber-500/20">
              {"✈"}
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">{"Aero-Club Bar"}</h1>
              <p className="text-[10px] text-slate-500 font-medium">{"Libre-service"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 px-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-semibold">{"Ouvert"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Categories ── */}
      <div className="sticky top-[53px] z-20 bg-[#0a0f1c]/90 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-3 py-2 flex gap-1.5 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id ?? "all"}
              onClick={() => setActiveCategory(cat.id)}
              className={
                "shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer " +
                (activeCategory === cat.id
                  ? "bg-white text-black shadow-lg shadow-white/10"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white")
              }
            >
              {cat.icon + " " + cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product Grid ── */}
      <main className="max-w-2xl mx-auto px-3 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const inCart = cart.find((c) => c.id === p.id);
            const out = p.stock <= 0;
            return (
              <button
                key={p.id}
                onClick={() => !out && addToCart(p)}
                disabled={out}
                className={
                  "group relative rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer " +
                  (out
                    ? "opacity-30 cursor-not-allowed"
                    : inCart
                      ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#0a0f1c] scale-[0.98]"
                      : "hover:scale-[1.02] active:scale-95")
                }
              >
                {/* Card background */}
                <div
                  className={
                    "relative p-4 pb-3 flex flex-col items-center gap-2 " +
                    (out
                      ? "bg-slate-900/50"
                      : "bg-gradient-to-b from-white/[0.07] to-white/[0.02] backdrop-blur-sm border border-white/[0.06]")
                  }
                >
                  {/* Qty badge */}
                  {inCart && (
                    <div className="absolute top-2 right-2 min-w-[24px] h-6 px-1.5 rounded-full bg-amber-400 text-black text-xs font-black flex items-center justify-center shadow-lg animate-[fadeIn_0.2s_ease-out]">
                      {String(inCart.qty)}
                    </div>
                  )}

                  {/* Emoji */}
                  <span className="text-5xl drop-shadow-lg group-hover:scale-110 transition-transform duration-200">
                    {p.emoji}
                  </span>

                  {/* Info */}
                  <div className="text-center">
                    <span className="text-sm font-semibold block leading-tight">{p.name}</span>
                    <span className="text-base font-black text-amber-400 block mt-0.5">
                      {p.price.toFixed(2).replace(".", ",") + " €"}
                    </span>
                  </div>

                  {/* Stock indicator */}
                  {!out && (
                    <div className="w-full mt-1">
                      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={
                            "h-full rounded-full transition-all duration-500 " +
                            (p.stock <= 5 ? "bg-orange-500" : p.stock <= 10 ? "bg-amber-500/60" : "bg-emerald-500/40")
                          }
                          style={{ width: Math.min(100, (p.stock / 30) * 100) + "%" }}
                        />
                      </div>
                      {p.stock <= 5 && (
                        <span className="text-[9px] text-orange-400 font-semibold block text-center mt-0.5">
                          {"Plus que " + p.stock}
                        </span>
                      )}
                    </div>
                  )}

                  {out && (
                    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                      {"Epuise"}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* ── Cart Bar (fixed bottom) ── */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 pb-safe">
          <div className="max-w-2xl mx-auto px-3 pb-3">
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full flex items-center justify-between bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black rounded-2xl px-5 py-4 shadow-2xl shadow-amber-500/30 transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center text-sm font-black">
                  {String(cartCount)}
                </div>
                <span className="font-bold text-sm">{"Voir le panier"}</span>
              </div>
              <span className="text-lg font-black">
                {cartTotal.toFixed(2).replace(".", ",") + " €"}
              </span>
            </button>

            {/* Quick cart preview */}
            <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
              {cart.map((item) => (
                <button
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                  className="shrink-0 flex items-center gap-1 bg-white/5 backdrop-blur border border-white/10 rounded-full px-2.5 py-1 cursor-pointer hover:bg-red-500/10 hover:border-red-500/20 transition-colors group"
                >
                  <span className="text-sm">{item.emoji}</span>
                  {item.qty > 1 && <span className="text-[10px] font-bold text-slate-400">{item.qty + "x"}</span>}
                  <span className="text-[10px] text-slate-500 group-hover:text-red-400">{"✕"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Checkout Sheet ── */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowCheckout(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-[#111827] rounded-t-3xl max-h-[85vh] overflow-y-auto animate-[slideUp_0.3s_ease-out]"
            onClick={(e) => e.stopPropagation()}
            style={{ animationFillMode: "both" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="px-5 pb-8">
              <h2 className="text-xl font-bold mb-4">{"Votre commande"}</h2>

              {/* Items */}
              <div className="flex flex-col gap-2 mb-5">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/5">
                    <span className="text-2xl">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold block truncate">{item.name}</span>
                      <span className="text-xs text-slate-500">{item.price.toFixed(2).replace(".", ",") + " € / unité"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(item.id)}
                        className="w-9 h-9 rounded-xl bg-white/5 text-red-400 font-bold flex items-center justify-center cursor-pointer active:scale-90 hover:bg-red-500/10 transition-colors text-sm"
                      >{"−"}</button>
                      <span className="w-8 text-center font-bold text-lg">{String(item.qty)}</span>
                      <button onClick={() => addToCart(DEMO_PRODUCTS.find((p) => p.id === item.id)!)}
                        className="w-9 h-9 rounded-xl bg-white/5 text-emerald-400 font-bold flex items-center justify-center cursor-pointer active:scale-90 hover:bg-emerald-500/10 transition-colors text-sm"
                      >{"+"}</button>
                    </div>
                    <span className="text-sm font-bold text-amber-400 w-14 text-right">
                      {(item.price * item.qty).toFixed(2).replace(".", ",") + "€"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-5">
                <span className="text-sm font-semibold text-slate-400">{"Total"}</span>
                <span className="text-2xl font-black text-amber-400">
                  {cartTotal.toFixed(2).replace(".", ",") + " €"}
                </span>
              </div>

              {/* Name input */}
              <div className="mb-5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">{"Votre nom"}</label>
                <input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Prénom Nom"
                  className="w-full h-12 rounded-xl bg-white/5 border border-white/10 text-white text-sm px-4 outline-none focus:border-amber-500/50 focus:bg-white/[0.07] transition-colors placeholder:text-slate-600"
                />
              </div>

              {/* Payment buttons */}
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{"Paiement"}</span>
                <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-base shadow-lg shadow-emerald-600/20 active:scale-[0.98] cursor-pointer transition-transform flex items-center justify-center gap-2">
                  <span className="text-lg">{"💵"}</span>
                  <span>{"Especes"}</span>
                </button>
                <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-bold text-base shadow-lg shadow-blue-600/20 active:scale-[0.98] cursor-pointer transition-transform flex items-center justify-center gap-2">
                  <span className="text-lg">{"💳"}</span>
                  <span>{"Carte bancaire"}</span>
                </button>
                <button className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-semibold text-sm cursor-pointer active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                  <span>{"🎁"}</span>
                  <span>{"Offert"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 12px); }
      `}</style>

      {/* Dev badge */}
      <div className="fixed top-2 left-2 z-50 px-2 py-1 rounded-full bg-red-500/80 text-[9px] font-bold text-white uppercase tracking-wider">
        {"DEV — Design V2"}
      </div>
    </div>
  );
}
