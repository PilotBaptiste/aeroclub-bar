"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

const ACBA_BLUE = "#0A2FE0";
const ACBA_BLUE_DARK = "#071E96";
const ACBA_BLUE_LIGHT = "#1A40FF";
const ACBA_YELLOW = "#FFD700";

const DEMO_PRODUCTS = [
  { id: "cafe", name: "Café", emoji: "☕", price: 0.5, stock: 50, maxStock: 60, category: "chaud" },
  { id: "eau", name: "Eau", emoji: "💧", price: 0.5, stock: 30, maxStock: 40, category: "soft" },
  { id: "coca", name: "Coca-Cola", emoji: "🥤", price: 1.0, stock: 24, maxStock: 30, category: "soft" },
  { id: "orangina", name: "Orangina", emoji: "🍊", price: 1.0, stock: 24, maxStock: 30, category: "soft" },
  { id: "icetea", name: "Ice Tea", emoji: "🧋", price: 1.0, stock: 18, maxStock: 24, category: "soft" },
  { id: "perrier", name: "Perrier", emoji: "🧊", price: 1.0, stock: 20, maxStock: 24, category: "soft" },
  { id: "biere", name: "Bière", emoji: "🍺", price: 1.5, stock: 20, maxStock: 24, category: "alcool" },
  { id: "snack", name: "Snack", emoji: "🍫", price: 1.0, stock: 15, maxStock: 20, category: "food" },
  { id: "chips", name: "Chips", emoji: "🍟", price: 1.0, stock: 12, maxStock: 20, category: "food" },
  { id: "glace", name: "Glace", emoji: "🍦", price: 1.5, stock: 3, maxStock: 12, category: "food" },
  { id: "2xcafe", name: "2x Cafés", emoji: "☕☕", price: 0.8, stock: 25, maxStock: 30, category: "chaud" },
  { id: "jus", name: "Jus d'orange", emoji: "🧃", price: 1.0, stock: 16, maxStock: 24, category: "soft" },
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
  const [mounted, setMounted] = useState(false);
  const [tappedId, setTappedId] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [cartBounce, setCartBounce] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = useCallback((p: (typeof DEMO_PRODUCTS)[0]) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === p.id);
      if (ex) return prev.map((c) => (c.id === p.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { id: p.id, name: p.name, emoji: p.emoji, price: p.price, qty: 1 }];
    });
    setTappedId(p.id);
    setJustAdded(p.id);
    setCartBounce(true);
    setTimeout(() => setTappedId(null), 300);
    setTimeout(() => setJustAdded(null), 600);
    setTimeout(() => setCartBounce(false), 400);
  }, []);

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
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="anim-float">
              <Image src="/logo-acba.png" alt="ACBA" width={44} height={62} className="object-contain drop-shadow-lg" priority />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight" style={{ color: ACBA_YELLOW }}>AÉRO-CLUB BAR</h1>
              <p className="text-[9px] font-medium" style={{ color: ACBA_BLUE_LIGHT + "80" }}>Bassin d&#39;Arcachon</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 px-2.5 rounded-full flex items-center gap-1.5 anim-glow" style={{ background: ACBA_BLUE + "20", border: "1px solid " + ACBA_BLUE + "40" }}>
              <span className="w-2 h-2 rounded-full anim-pulse-dot" style={{ background: "#22C55E" }} />
              <span className="text-[10px] font-semibold" style={{ color: "#22C55E" }}>Bar ouvert</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Categories ── */}
      <div className="sticky top-[54px] z-20" style={{ background: "rgba(4,12,36,0.9)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-4xl mx-auto px-3 py-2.5 flex gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id ?? "all"}
              onClick={() => setActiveCategory(cat.id)}
              className={"shrink-0 px-5 py-2 rounded-full text-xs font-bold cursor-pointer anim-pill " + (activeCategory === cat.id ? "anim-pill-active" : "")}
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

      {/* ── Product Grid ── */}
      <main className="max-w-4xl mx-auto px-3 py-4">
        <div className="grid grid-cols-3 portrait-6-cols gap-2.5">
          {filtered.map((p, i) => {
            const inCart = cart.find((c) => c.id === p.id);
            const out = p.stock <= 0;
            const pct = Math.min(100, (p.stock / p.maxStock) * 100);
            const isTapped = tappedId === p.id;
            const wasJustAdded = justAdded === p.id;
            return (
              <button
                key={p.id}
                onClick={() => !out && addToCart(p)}
                disabled={out}
                className={"group relative rounded-2xl overflow-hidden cursor-pointer " + (out ? "opacity-30 cursor-not-allowed" : "")}
                style={{
                  animation: mounted ? `fadeSlideUp 0.4s ease-out ${i * 0.05}s both` : "none",
                  transform: isTapped ? "scale(0.92)" : "scale(1)",
                  transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                <div
                  className="relative p-3 pb-2 flex flex-col items-center gap-1"
                  style={{
                    background: inCart
                      ? "linear-gradient(160deg, " + ACBA_BLUE + "35 0%, " + ACBA_BLUE + "15 100%)"
                      : "linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)",
                    border: inCart ? "2px solid " + ACBA_YELLOW + "80" : "1px solid " + ACBA_BLUE + "20",
                    borderRadius: "16px",
                    transition: "border-color 0.3s, background 0.3s",
                  }}
                >
                  {/* Qty badge */}
                  {inCart && (
                    <div
                      className={"absolute top-1.5 right-1.5 min-w-[22px] h-[22px] px-1 rounded-full text-[11px] font-black flex items-center justify-center " + (wasJustAdded ? "anim-badge-pop" : "")}
                      style={{ background: ACBA_YELLOW, color: "#000", boxShadow: "0 2px 8px " + ACBA_YELLOW + "60" }}
                    >
                      {String(inCart.qty)}
                    </div>
                  )}

                  {/* Emoji */}
                  <span
                    className="text-4xl drop-shadow-md"
                    style={{
                      transform: isTapped ? "scale(1.3) rotate(-8deg)" : "scale(1)",
                      transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                  >
                    {p.emoji}
                  </span>

                  {/* Name */}
                  <span className="text-[11px] font-semibold leading-tight text-center text-white/90">{p.name}</span>

                  {/* Price */}
                  <span className="text-sm font-black" style={{ color: ACBA_YELLOW }}>
                    {p.price.toFixed(2).replace(".", ",") + " €"}
                  </span>

                  {/* Stock bar + number */}
                  {!out && (
                    <div className="w-full mt-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: ACBA_BLUE + "25" }}>
                          <div
                            className="h-full rounded-full anim-stock-fill"
                            style={{
                              width: pct + "%",
                              background: p.stock <= 5
                                ? "linear-gradient(90deg, #EF4444, #F97316)"
                                : p.stock <= 10
                                  ? "linear-gradient(90deg, #F59E0B, " + ACBA_YELLOW + ")"
                                  : "linear-gradient(90deg, " + ACBA_BLUE_LIGHT + ", " + ACBA_BLUE + "80)",
                              animationDelay: (i * 0.05 + 0.3) + "s",
                            }}
                          />
                        </div>
                        <span
                          className="text-[9px] font-bold tabular-nums min-w-[18px] text-right"
                          style={{ color: p.stock <= 5 ? "#F97316" : p.stock <= 10 ? ACBA_YELLOW : ACBA_BLUE_LIGHT + "60" }}
                        >
                          {String(p.stock)}
                        </span>
                      </div>
                      {p.stock <= 5 && (
                        <span className="text-[8px] text-orange-400 font-semibold block text-center mt-0.5 anim-blink">
                          Stock bas !
                        </span>
                      )}
                    </div>
                  )}

                  {out && (
                    <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Épuisé</span>
                  )}

                  {/* Tap ripple */}
                  {isTapped && (
                    <div className="absolute inset-0 rounded-2xl anim-ripple" style={{ background: ACBA_YELLOW + "15" }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* ── Cart Bar ── */}
      {cartCount > 0 && (
        <div
          className="fixed bottom-0 inset-x-0 z-40 pb-safe"
          style={{ animation: "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
        >
          <div className="max-w-4xl mx-auto px-3 pb-3">
            <button
              onClick={() => setShowCheckout(true)}
              className={"w-full flex items-center justify-between rounded-2xl px-5 py-4 shadow-2xl cursor-pointer active:scale-[0.98] " + (cartBounce ? "anim-cart-bounce" : "")}
              style={{
                background: "linear-gradient(135deg, " + ACBA_YELLOW + " 0%, #FFC000 100%)",
                color: "#000",
                boxShadow: "0 8px 30px " + ACBA_YELLOW + "40",
                transition: "transform 0.2s",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={"w-9 h-9 rounded-full flex items-center justify-center text-sm font-black " + (cartBounce ? "anim-badge-pop" : "")}
                  style={{ background: "rgba(0,0,0,0.15)" }}
                >
                  {String(cartCount)}
                </div>
                <span className="font-bold text-sm">Voir le panier</span>
              </div>
              <span className="text-lg font-black">
                {cartTotal.toFixed(2).replace(".", ",") + " €"}
              </span>
            </button>

            {/* Quick preview chips */}
            <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
              {cart.map((item) => (
                <button
                  key={item.id}
                  onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                  className="shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 cursor-pointer group"
                  style={{
                    background: ACBA_BLUE + "30",
                    border: "1px solid " + ACBA_BLUE + "40",
                    animation: "popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                    transition: "background 0.2s",
                  }}
                >
                  <span className="text-sm">{item.emoji}</span>
                  {item.qty > 1 && <span className="text-[10px] font-bold text-slate-400">{item.qty + "x"}</span>}
                  <span className="text-[10px] text-slate-500 group-hover:text-red-400 transition-colors">✕</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Checkout Sheet ── */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowCheckout(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm anim-fade-in" />
          <div
            className="relative w-full max-w-lg rounded-t-3xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0A1228",
              border: "1px solid " + ACBA_BLUE + "30",
              borderBottom: "none",
              animation: "sheetUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: ACBA_BLUE + "40" }} />
            </div>

            <div className="px-5 pb-8">
              <div className="flex items-center gap-3 mb-4">
                <Image src="/logo-acba.png" alt="ACBA" width={28} height={40} className="object-contain" />
                <h2 className="text-xl font-bold">Votre commande</h2>
              </div>

              {/* Items */}
              <div className="flex flex-col gap-2 mb-5">
                {cart.map((item, i) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{
                      background: ACBA_BLUE + "10",
                      border: "1px solid " + ACBA_BLUE + "20",
                      animation: `fadeSlideUp 0.3s ease-out ${i * 0.06}s both`,
                    }}
                  >
                    <span className="text-2xl">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold block truncate">{item.name}</span>
                      <span className="text-xs" style={{ color: ACBA_BLUE_LIGHT + "70" }}>{item.price.toFixed(2).replace(".", ",") + " € / unité"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(item.id)}
                        className="w-9 h-9 rounded-xl font-bold flex items-center justify-center cursor-pointer active:scale-90 transition-all text-sm text-red-400 hover:bg-red-500/10"
                        style={{ background: ACBA_BLUE + "20" }}
                      >−</button>
                      <span className="w-8 text-center font-bold text-lg">{String(item.qty)}</span>
                      <button onClick={() => addToCart(DEMO_PRODUCTS.find((p) => p.id === item.id)!)}
                        className="w-9 h-9 rounded-xl font-bold flex items-center justify-center cursor-pointer active:scale-90 transition-all text-sm text-emerald-400 hover:bg-emerald-500/10"
                        style={{ background: ACBA_BLUE + "20" }}
                      >+</button>
                    </div>
                    <span className="text-sm font-bold w-14 text-right" style={{ color: ACBA_YELLOW }}>
                      {(item.price * item.qty).toFixed(2).replace(".", ",") + "€"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div
                className="flex items-center justify-between rounded-xl px-4 py-3 mb-5 anim-shimmer"
                style={{ background: ACBA_YELLOW + "10", border: "1px solid " + ACBA_YELLOW + "30" }}
              >
                <span className="text-sm font-semibold text-slate-400">Total</span>
                <span className="text-2xl font-black" style={{ color: ACBA_YELLOW }}>
                  {cartTotal.toFixed(2).replace(".", ",") + " €"}
                </span>
              </div>

              {/* Name */}
              <div className="mb-5">
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: ACBA_BLUE_LIGHT + "70" }}>Votre nom</label>
                <input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Prénom Nom"
                  className="w-full h-12 rounded-xl text-white text-sm px-4 outline-none placeholder:text-slate-600 focus:ring-2"
                  style={{
                    background: ACBA_BLUE + "15",
                    border: "1px solid " + ACBA_BLUE + "30",
                    transition: "border-color 0.3s, box-shadow 0.3s",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = ACBA_YELLOW + "60"; e.currentTarget.style.boxShadow = "0 0 0 3px " + ACBA_YELLOW + "15"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = ACBA_BLUE + "30"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>

              {/* Payment buttons */}
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACBA_BLUE_LIGHT + "70" }}>Paiement</span>
                <button
                  className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg active:scale-[0.97] cursor-pointer flex items-center justify-center gap-2 anim-btn-shine"
                  style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)", boxShadow: "0 6px 20px rgba(16,185,129,0.3)", transition: "transform 0.15s" }}
                >
                  <span className="text-lg">💵</span>
                  <span>Espèces</span>
                </button>
                <button
                  className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg active:scale-[0.97] cursor-pointer flex items-center justify-center gap-2 anim-btn-shine"
                  style={{ background: "linear-gradient(135deg, " + ACBA_BLUE_LIGHT + " 0%, " + ACBA_BLUE + " 100%)", boxShadow: "0 6px 20px " + ACBA_BLUE + "40", transition: "transform 0.15s" }}
                >
                  <span className="text-lg">💳</span>
                  <span>Carte bancaire</span>
                </button>
                <button
                  className="w-full py-3.5 rounded-2xl text-slate-400 font-semibold text-sm cursor-pointer active:scale-[0.97] flex items-center justify-center gap-2"
                  style={{ background: ACBA_BLUE + "10", border: "1px solid " + ACBA_BLUE + "25", transition: "transform 0.15s" }}
                >
                  <span>🎁</span>
                  <span>Offert</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 12px); }

        @media (min-width: 600px) {
          .portrait-6-cols { grid-template-columns: repeat(6, minmax(0, 1fr)); }
        }

        /* ── Entrance animations ── */
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }

        /* ── Badge pop ── */
        @keyframes badgePop {
          0% { transform: scale(1); }
          40% { transform: scale(1.5); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        .anim-badge-pop { animation: badgePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }

        /* ── Cart bounce ── */
        @keyframes cartBounce {
          0% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
          50% { transform: translateY(0); }
          70% { transform: translateY(-3px); }
          100% { transform: translateY(0); }
        }
        .anim-cart-bounce { animation: cartBounce 0.4s ease-out; }

        /* ── Tap ripple ── */
        @keyframes ripple {
          from { opacity: 1; transform: scale(0.5); }
          to { opacity: 0; transform: scale(2); }
        }
        .anim-ripple { animation: ripple 0.5s ease-out forwards; pointer-events: none; }

        /* ── Floating logo ── */
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .anim-float { animation: float 3s ease-in-out infinite; }

        /* ── Pulse dot (bar ouvert) ── */
        @keyframes pulseDot {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
          50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(34,197,94,0); }
        }
        .anim-pulse-dot { animation: pulseDot 2s ease-in-out infinite; }

        /* ── Pill press ── */
        .anim-pill { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .anim-pill:active { transform: scale(0.92); }
        .anim-pill-active { animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }

        /* ── Stock bar fill ── */
        @keyframes stockFill {
          from { width: 0%; }
        }
        .anim-stock-fill { animation: stockFill 0.8s ease-out both; }

        /* ── Blink (stock bas) ── */
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .anim-blink { animation: blink 2s ease-in-out infinite; }

        /* ── Fade in backdrop ── */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .anim-fade-in { animation: fadeIn 0.3s ease-out both; }

        /* ── Button shine ── */
        @keyframes shine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .anim-btn-shine {
          background-size: 200% auto;
          transition: transform 0.15s;
        }
        .anim-btn-shine:hover {
          animation: shine 1.5s linear infinite;
        }

        /* ── Shimmer on total ── */
        @keyframes shimmer {
          0% { background-position: -100% 0; }
          100% { background-position: 100% 0; }
        }
        .anim-shimmer {
          position: relative;
          overflow: hidden;
        }
        .anim-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.06) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
          pointer-events: none;
        }

        /* ── Glow badge bar ouvert ── */
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 4px rgba(34,197,94,0.1); }
          50% { box-shadow: 0 0 12px rgba(34,197,94,0.15); }
        }
        .anim-glow { animation: glow 3s ease-in-out infinite; }
      `}</style>

      {/* Dev badge */}
      <div
        className="fixed top-2 left-2 z-50 px-2 py-1 rounded-full text-[9px] font-bold text-black uppercase tracking-wider"
        style={{ background: ACBA_YELLOW, animation: "popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both" }}
      >
        DEV — Design V2 ACBA
      </div>
    </div>
  );
}
