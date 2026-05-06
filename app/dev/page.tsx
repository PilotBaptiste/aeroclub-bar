"use client";
import { useState } from "react";

/* ── ACBA Brand Colors ──
   Bleu ACBA : CMYK(99,82,0,0) → #032EFF
   Jaune avion : #FFD700
*/
const ACBA_BLUE = "#0A2FE0";
const ACBA_BLUE_DARK = "#071E96";
const ACBA_BLUE_LIGHT = "#1A40FF";
const ACBA_YELLOW = "#FFD700";

const DEMO_PRODUCTS = [
  { id: "cafe", name: "Cafe", emoji: "☕", price: 0.5, stock: 50, category: "chaud" },
  { id: "eau", name: "Eau", emoji: "💧", price: 0.5, stock: 30, category: "soft" },
  { id: "coca", name: "Coca-Cola", emoji: "🥤", price: 1.0, stock: 24, category: "soft" },
  { id: "orangina", name: "Orangina", emoji: "🍊", price: 1.0, stock: 24, category: "soft" },
  { id: "icetea", name: "Ice Tea", emoji: "🧋", price: 1.0, stock: 18, category: "soft" },
  { id: "perrier", name: "Perrier", emoji: "🧊", price: 1.0, stock: 20, category: "soft" },
  { id: "biere", name: "Biere", emoji: "🍺", price: 1.5, stock: 20, category: "alcool" },
  { id: "snack", name: "Snack", emoji: "🍫", price: 1.0, stock: 15, category: "food" },
  { id: "chips", name: "Chips", emoji: "🍟", price: 1.0, stock: 12, category: "food" },
  { id: "glace", name: "Glace", emoji: "🍦", price: 1.5, stock: 8, category: "food" },
  { id: "2xcafe", name: "2x Cafes", emoji: "☕☕", price: 0.8, stock: 25, category: "chaud" },
  { id: "jus", name: "Jus d'orange", emoji: "🧃", price: 1.0, stock: 16, category: "soft" },
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

function AcbaLogo({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} fill="none">
      {/* Mountain / wave shape */}
      <path
        d="M40 160 C40 160, 55 90, 75 110 C95 130, 90 70, 110 50 C130 30, 115 110, 130 110 C145 110, 160 160, 160 160"
        stroke={ACBA_BLUE}
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Plane */}
      <g transform="translate(108, 36) rotate(15)">
        <rect x="-18" y="-2" width="36" height="5" rx="2" fill={ACBA_YELLOW} />
        <rect x="-5" y="-10" width="10" height="20" rx="2" fill={ACBA_YELLOW} />
        <rect x="-12" y="-1" width="6" height="3" rx="1" fill={ACBA_YELLOW} opacity="0.7" />
      </g>
    </svg>
  );
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
    <div className="min-h-screen text-white" style={{ background: "linear-gradient(180deg, #040C24 0%, #06103A 50%, #040C24 100%)" }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b" style={{ background: "rgba(4,12,36,0.85)", backdropFilter: "blur(16px)", borderColor: ACBA_BLUE + "30" }}>
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AcbaLogo size={42} />
            <div>
              <h1 className="text-base font-extrabold tracking-tight" style={{ color: ACBA_YELLOW }}>{"ACBA"}</h1>
              <p className="text-[10px] font-medium" style={{ color: ACBA_BLUE_LIGHT + "90" }}>{"Aero-Club du Bassin d'Arcachon"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 px-2.5 rounded-full flex items-center gap-1.5" style={{ background: ACBA_BLUE + "20", border: "1px solid " + ACBA_BLUE + "40" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ACBA_YELLOW }} />
              <span className="text-[10px] font-semibold" style={{ color: ACBA_YELLOW }}>{"Bar ouvert"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Categories ── */}
      <div className="sticky top-[53px] z-20" style={{ background: "rgba(4,12,36,0.9)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-4xl mx-auto px-3 py-2.5 flex gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id ?? "all"}
              onClick={() => setActiveCategory(cat.id)}
              className="shrink-0 px-5 py-2 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer"
              style={
                activeCategory === cat.id
                  ? { background: ACBA_YELLOW, color: "#000", boxShadow: "0 4px 15px " + ACBA_YELLOW + "40" }
                  : { background: ACBA_BLUE + "15", color: ACBA_BLUE_LIGHT + "80", border: "1px solid " + ACBA_BLUE + "25" }
              }
            >
              {cat.icon + "  " + cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product Grid — 6 colonnes iPad portrait ── */}
      <main className="max-w-4xl mx-auto px-3 py-4">
        <div className="grid grid-cols-3 portrait-6-cols gap-2.5">
          {filtered.map((p) => {
            const inCart = cart.find((c) => c.id === p.id);
            const out = p.stock <= 0;
            return (
              <button
                key={p.id}
                onClick={() => !out && addToCart(p)}
                disabled={out}
                className={"group relative rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer active:scale-[0.96] " + (out ? "opacity-30 cursor-not-allowed" : "")}
              >
                <div
                  className="relative p-3 pb-2.5 flex flex-col items-center gap-1.5"
                  style={{
                    background: inCart
                      ? "linear-gradient(160deg, " + ACBA_BLUE + "30 0%, " + ACBA_BLUE + "15 100%)"
                      : "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
                    border: inCart ? "2px solid " + ACBA_YELLOW : "1px solid " + ACBA_BLUE + "20",
                    borderRadius: "16px",
                  }}
                >
                  {/* Qty badge */}
                  {inCart && (
                    <div
                      className="absolute top-1.5 right-1.5 min-w-[22px] h-[22px] px-1 rounded-full text-[11px] font-black flex items-center justify-center shadow-lg"
                      style={{ background: ACBA_YELLOW, color: "#000", boxShadow: "0 2px 8px " + ACBA_YELLOW + "60" }}
                    >
                      {String(inCart.qty)}
                    </div>
                  )}

                  {/* Emoji */}
                  <span className="text-4xl drop-shadow-md group-hover:scale-110 transition-transform duration-150">
                    {p.emoji}
                  </span>

                  {/* Info */}
                  <span className="text-[11px] font-semibold leading-tight text-center text-white/90">{p.name}</span>
                  <span className="text-sm font-black" style={{ color: ACBA_YELLOW }}>
                    {p.price.toFixed(2).replace(".", ",") + " €"}
                  </span>

                  {/* Stock bar */}
                  {!out && (
                    <div className="w-full mt-0.5">
                      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: ACBA_BLUE + "20" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: Math.min(100, (p.stock / 30) * 100) + "%",
                            background: p.stock <= 5 ? "#F97316" : p.stock <= 10 ? ACBA_YELLOW + "60" : ACBA_BLUE_LIGHT + "40",
                          }}
                        />
                      </div>
                      {p.stock <= 5 && (
                        <span className="text-[8px] text-orange-400 font-semibold block text-center mt-0.5">
                          {"Plus que " + p.stock}
                        </span>
                      )}
                    </div>
                  )}

                  {out && (
                    <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">{"Epuise"}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* ── Cart Bar ── */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 pb-safe">
          <div className="max-w-4xl mx-auto px-3 pb-3">
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full flex items-center justify-between rounded-2xl px-5 py-4 shadow-2xl transition-all duration-200 cursor-pointer active:scale-[0.98]"
              style={{ background: ACBA_YELLOW, color: "#000", boxShadow: "0 8px 30px " + ACBA_YELLOW + "40" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black" style={{ background: "rgba(0,0,0,0.15)" }}>
                  {String(cartCount)}
                </div>
                <span className="font-bold text-sm">{"Voir le panier"}</span>
              </div>
              <span className="text-lg font-black">
                {cartTotal.toFixed(2).replace(".", ",") + " €"}
              </span>
            </button>

            {/* Quick preview */}
            <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
              {cart.map((item) => (
                <button
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                  className="shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 cursor-pointer transition-colors group"
                  style={{ background: ACBA_BLUE + "30", border: "1px solid " + ACBA_BLUE + "40" }}
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
            className="relative w-full max-w-lg rounded-t-3xl max-h-[85vh] overflow-y-auto animate-slideUp"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#0A1228", border: "1px solid " + ACBA_BLUE + "30", borderBottom: "none" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: ACBA_BLUE + "40" }} />
            </div>

            <div className="px-5 pb-8">
              <div className="flex items-center gap-3 mb-4">
                <AcbaLogo size={32} />
                <h2 className="text-xl font-bold">{"Votre commande"}</h2>
              </div>

              {/* Items */}
              <div className="flex flex-col gap-2 mb-5">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: ACBA_BLUE + "10", border: "1px solid " + ACBA_BLUE + "20" }}>
                    <span className="text-2xl">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold block truncate">{item.name}</span>
                      <span className="text-xs" style={{ color: ACBA_BLUE_LIGHT + "70" }}>{item.price.toFixed(2).replace(".", ",") + " € / unité"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(item.id)}
                        className="w-9 h-9 rounded-xl font-bold flex items-center justify-center cursor-pointer active:scale-90 transition-colors text-sm text-red-400"
                        style={{ background: ACBA_BLUE + "20" }}
                      >{"−"}</button>
                      <span className="w-8 text-center font-bold text-lg">{String(item.qty)}</span>
                      <button onClick={() => addToCart(DEMO_PRODUCTS.find((p) => p.id === item.id)!)}
                        className="w-9 h-9 rounded-xl font-bold flex items-center justify-center cursor-pointer active:scale-90 transition-colors text-sm text-emerald-400"
                        style={{ background: ACBA_BLUE + "20" }}
                      >{"+"}</button>
                    </div>
                    <span className="text-sm font-bold w-14 text-right" style={{ color: ACBA_YELLOW }}>
                      {(item.price * item.qty).toFixed(2).replace(".", ",") + "€"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-5" style={{ background: ACBA_YELLOW + "10", border: "1px solid " + ACBA_YELLOW + "30" }}>
                <span className="text-sm font-semibold text-slate-400">{"Total"}</span>
                <span className="text-2xl font-black" style={{ color: ACBA_YELLOW }}>
                  {cartTotal.toFixed(2).replace(".", ",") + " €"}
                </span>
              </div>

              {/* Name */}
              <div className="mb-5">
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: ACBA_BLUE_LIGHT + "70" }}>{"Votre nom"}</label>
                <input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Prénom Nom"
                  className="w-full h-12 rounded-xl text-white text-sm px-4 outline-none transition-colors placeholder:text-slate-600"
                  style={{ background: ACBA_BLUE + "15", border: "1px solid " + ACBA_BLUE + "30" }}
                />
              </div>

              {/* Payment */}
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACBA_BLUE_LIGHT + "70" }}>{"Paiement"}</span>
                <button
                  className="w-full py-4 rounded-2xl text-black font-bold text-base shadow-lg active:scale-[0.98] cursor-pointer transition-transform flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", boxShadow: "0 6px 20px rgba(16,185,129,0.25)" }}
                >
                  <span className="text-lg">{"💵"}</span>
                  <span>{"Espèces"}</span>
                </button>
                <button
                  className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg active:scale-[0.98] cursor-pointer transition-transform flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, " + ACBA_BLUE_LIGHT + " 0%, " + ACBA_BLUE + " 100%)", boxShadow: "0 6px 20px " + ACBA_BLUE + "40" }}
                >
                  <span className="text-lg">{"💳"}</span>
                  <span>{"Carte bancaire"}</span>
                </button>
                <button
                  className="w-full py-3.5 rounded-2xl text-slate-400 font-semibold text-sm cursor-pointer active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  style={{ background: ACBA_BLUE + "10", border: "1px solid " + ACBA_BLUE + "25" }}
                >
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
          from { transform: translateY(100%); opacity: 0.8; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out both; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 12px); }

        /* 6 colonnes pour iPad portrait (768px+) */
        @media (min-width: 600px) {
          .portrait-6-cols { grid-template-columns: repeat(6, minmax(0, 1fr)); }
        }
      `}</style>

      {/* Dev badge */}
      <div className="fixed top-2 left-2 z-50 px-2 py-1 rounded-full text-[9px] font-bold text-black uppercase tracking-wider" style={{ background: ACBA_YELLOW }}>
        {"DEV — Design V2 ACBA"}
      </div>
    </div>
  );
}
