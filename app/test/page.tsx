"use client";
import { useState, useEffect, useRef } from "react";

// ─── Types ───
interface Product {
  id: string;
  name: string;
  emoji: string;
  price: number;
  cost: number;
  stock: number;
  coffeeServings?: number;
  archived?: boolean;
  category?: string;
  location?: "frigo" | "cafe" | "congelateur";
  coffeeAddon?: boolean;
  coffeeAddonQty?: number;
  coffeeAddonPrice?: number;
}
interface Transaction {
  id: string;
  items: string;
  total: number;
  buyer: string;
  date: string;
  method: string;
}
interface Category {
  id: string;
  label: string;
  emoji: string;
}

function formatPrice(p: number) {
  return p.toFixed(2).replace(".", ",") + " €";
}

// ─── Sound System ───
let audioCtx: AudioContext | null = null;
function getCtx() {
  if (!audioCtx && typeof window !== "undefined") {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioCtx;
}
function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.3) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.start(ctx.currentTime); o.stop(ctx.currentTime + dur);
}
const Sound = {
  pop() { tone(800, 0.06, "sine", 0.15); setTimeout(() => tone(1200, 0.08, "sine", 0.2), 50); },
  slide() { tone(400, 0.1, "sine", 0.1); setTimeout(() => tone(600, 0.1, "sine", 0.12), 60); },
  addToCart() { tone(523, 0.1, "sine", 0.2); setTimeout(() => tone(784, 0.15, "sine", 0.25), 80); },
  success() { tone(523, 0.15, "sine", 0.25); setTimeout(() => tone(659, 0.15, "sine", 0.25), 120); setTimeout(() => tone(784, 0.25, "sine", 0.25), 240); setTimeout(() => tone(1047, 0.4, "sine", 0.3), 380); },
};

// ─── Animated number ───
function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    const start = ref.current;
    const end = value;
    if (start === end) return;
    const dur = 300;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (end - start) * ease);
      if (p < 1) requestAnimationFrame(tick);
      else ref.current = end;
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span className={className}>{formatPrice(display)}</span>;
}

// ─── Render emoji or image ───
function ProductIcon({ emoji, size = "text-4xl" }: { emoji: string; size?: string }) {
  if (emoji.startsWith("http")) {
    const px = size === "text-6xl" ? "w-16 h-16" : size === "text-5xl" ? "w-12 h-12" : "w-10 h-10";
    return <img src={emoji} alt="" className={px + " object-contain rounded-lg"} />;
  }
  return <span className={size}>{emoji}</span>;
}

// ════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════

export default function TestPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroAnim, setHeroAnim] = useState("slideIn");
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Load data ───
  useEffect(() => {
    fetch("/api/data").then((r) => r.json()).then((d) => {
      const prods: Product[] = d.products || [];
      setProducts(prods.filter((p) => !p.archived && !p.coffeeAddon));
      setTransactions(d.transactions || []);
      const cats: Category[] = d.settings?.categories || [
        { id: "boissons", label: "Boissons", emoji: "🍺" },
        { id: "cafe", label: "Café", emoji: "☕" },
        { id: "nourriture", label: "Bouffe", emoji: "🍫" },
      ];
      setCategories(cats);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // ─── Compute popular products (based on transaction frequency) ───
  const popularProducts = (() => {
    const counts: Record<string, number> = {};
    // Count from recent transactions (last 200)
    const recent = transactions.slice(0, 200);
    for (const tx of recent) {
      // Parse "2x Coca-Cola, 1x Biere" format
      const parts = tx.items.split(",").map((s) => s.trim());
      for (const part of parts) {
        const match = part.match(/^(\d+)x\s+(.+)$/);
        if (match) {
          const qty = parseInt(match[1]);
          const name = match[2].trim();
          counts[name] = (counts[name] || 0) + qty;
        }
      }
    }
    // Map to products and sort by count
    return products
      .map((p) => ({ ...p, salesCount: counts[p.name] || 0 }))
      .filter((p) => p.salesCount > 0)
      .sort((a, b) => b.salesCount - a.salesCount)
      .slice(0, 6);
  })();

  // ─── Hero carousel (featured products) ───
  const heroProducts = popularProducts.length >= 3
    ? popularProducts.slice(0, 5)
    : products.slice(0, 5);

  useEffect(() => {
    if (heroProducts.length <= 1) return;
    heroTimerRef.current = setInterval(() => {
      setHeroAnim("slideOut");
      setTimeout(() => {
        setHeroIndex((i) => (i + 1) % heroProducts.length);
        setHeroAnim("slideIn");
        Sound.slide();
      }, 400);
    }, 4000);
    return () => { if (heroTimerRef.current) clearInterval(heroTimerRef.current); };
  }, [heroProducts.length]);

  // ─── Find combo (café + madeleine) ───
  const allProds = products;
  const cafeProduct = allProds.find((p) =>
    (p.name.toLowerCase().includes("café") || p.name.toLowerCase().includes("cafe")) &&
    p.coffeeServings && p.coffeeServings > 1
  ) || allProds.find((p) => p.name.toLowerCase().includes("café") || p.name.toLowerCase().includes("cafe"));

  // We need to load ALL products including addons for the combo
  const [addonProduct, setAddonProduct] = useState<Product | null>(null);
  useEffect(() => {
    fetch("/api/data").then((r) => r.json()).then((d) => {
      const all: Product[] = d.products || [];
      const addon = all.find((p) => p.coffeeAddon && !p.archived);
      if (addon) setAddonProduct(addon);
    }).catch(() => {});
  }, []);

  const combo = cafeProduct && addonProduct ? {
    cafe: cafeProduct,
    addon: addonProduct,
    totalPrice: cafeProduct.price + (addonProduct.coffeeAddonPrice || 0.80),
  } : null;

  // ─── Cart operations ───
  const addToCart = (product: Product) => {
    Sound.addToCart();
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 600);
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) return prev.map((c) => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { product, qty: 1 }];
    });
  };

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const cartTotal = cart.reduce((s, c) => s + c.product.price * c.qty, 0);

  // ─── Filtered products ───
  const filteredProducts = activeCategory
    ? products.filter((p) => p.category === activeCategory)
    : products;

  // ─── Low stock badge ───
  const stockBadge = (stock: number) => {
    if (stock === 0) return <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">{"Epuise"}</span>;
    if (stock <= 3) return <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-pulse">{"x" + stock}</span>;
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-amber-500 font-bold animate-pulse">{"Chargement..."}</p>
        </div>
      </div>
    );
  }

  const currentHero = heroProducts[heroIndex];

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white overflow-x-hidden">
      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(80px) scale(0.9); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes slideOut {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to { opacity: 0; transform: translateX(-80px) scale(0.9); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes popIn {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes cartBounce {
          0% { transform: scale(1); }
          30% { transform: scale(1.3); }
          60% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes comboSlide {
          from { opacity: 0; transform: translateX(-40px) rotate(-5deg); }
          to { opacity: 1; transform: translateX(0) rotate(0deg); }
        }
        @keyframes comboPop {
          0% { opacity: 0; transform: scale(0) rotate(10deg); }
          60% { transform: scale(1.15) rotate(-3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.2); }
          50% { box-shadow: 0 0 40px rgba(245, 158, 11, 0.4); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes tagFloat {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-6px) rotate(2deg); }
        }
        .slide-in { animation: slideIn 0.5s cubic-bezier(.22,1,.36,1) forwards; }
        .slide-out { animation: slideOut 0.4s cubic-bezier(.22,1,.36,1) forwards; }
        .fade-up { animation: fadeUp 0.6s cubic-bezier(.22,1,.36,1) forwards; }
        .scale-in { animation: scaleIn 0.4s cubic-bezier(.22,1,.36,1) forwards; }
        .float-anim { animation: float 3s ease-in-out infinite; }
        .pop-in { animation: popIn 0.4s cubic-bezier(.22,1,.36,1) forwards; }
        .cart-bounce { animation: cartBounce 0.4s cubic-bezier(.22,1,.36,1); }
        .shimmer-text {
          background: linear-gradient(90deg, #f59e0b 25%, #fbbf24 50%, #f59e0b 75%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
        .gradient-bg {
          background: linear-gradient(-45deg, #1e1b4b, #0f172a, #1a1a2e, #0d1117);
          background-size: 300% 300%;
          animation: gradient 8s ease infinite;
        }
      `}</style>

      {/* ═══════════ HEADER ═══════════ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0f1e]/80 border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{"✈️"}</span>
            <div>
              <h1 className="text-sm font-black tracking-tight shimmer-text">{"AERO-CLUB BAR"}</h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-wider">{"BASSIN D'ARCACHON"}</p>
            </div>
          </div>
          {/* Cart button */}
          <button
            onClick={() => { setCartOpen(!cartOpen); Sound.pop(); }}
            className="relative p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
          >
            <span className="text-xl">{"🛒"}</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center cart-bounce shadow-lg">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-32">

        {/* ═══════════ HERO CAROUSEL ═══════════ */}
        {currentHero && (
          <section className="mt-5 mb-6">
            <div className="relative overflow-hidden rounded-2xl gradient-bg p-6 min-h-[180px] flex items-center"
              style={{ animation: "pulse-glow 3s ease-in-out infinite" }}
            >
              {/* Background decoration */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl" />
              </div>

              <div className={`relative flex items-center gap-5 w-full ${heroAnim === "slideIn" ? "slide-in" : "slide-out"}`}>
                <div className="flex-shrink-0 float-anim">
                  <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-2xl border border-white/10">
                    <ProductIcon emoji={currentHero.emoji} size="text-5xl" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">{"Populaire"}</span>
                    <span className="w-6 h-px bg-amber-500/30" />
                  </div>
                  <h2 className="text-2xl font-black text-white leading-tight truncate">{currentHero.name}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-2xl font-black text-amber-400">{formatPrice(currentHero.price)}</span>
                    <button
                      onClick={() => { if (currentHero.stock > 0) addToCart(currentHero); }}
                      disabled={currentHero.stock === 0}
                      className={
                        "px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-90 " +
                        (currentHero.stock > 0
                          ? "bg-amber-500 text-black hover:bg-amber-400 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                          : "bg-slate-700 text-slate-500 cursor-not-allowed")
                      }
                    >
                      {currentHero.stock > 0 ? "Ajouter +" : "Epuise"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Dots */}
              {heroProducts.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {heroProducts.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setHeroAnim("slideOut");
                        setTimeout(() => { setHeroIndex(i); setHeroAnim("slideIn"); }, 300);
                      }}
                      className={
                        "w-1.5 h-1.5 rounded-full transition-all cursor-pointer " +
                        (i === heroIndex ? "bg-amber-500 w-4" : "bg-white/20 hover:bg-white/40")
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══════════ COMBO CAFÉ + MADELEINE ═══════════ */}
        {combo && (
          <section className="mb-6 fade-up" style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
            <div className="relative overflow-hidden rounded-2xl border border-pink-800/30 bg-gradient-to-br from-[#1a0d1e] via-[#151025] to-[#0d1520] p-5">
              {/* Sparkle decorations */}
              <div className="absolute top-3 right-4 text-xs" style={{ animation: "tagFloat 2s ease-in-out infinite" }}>{"✨"}</div>
              <div className="absolute bottom-4 right-8 text-xs" style={{ animation: "tagFloat 2.5s ease-in-out infinite 0.5s" }}>{"✨"}</div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-400">{"Offre Combo"}</span>
                <span className="flex-1 h-px bg-pink-800/30" />
                <span className="text-[10px] font-bold text-pink-300 bg-pink-500/15 px-2 py-0.5 rounded-full">{"Nouveau"}</span>
              </div>

              <div className="flex items-center gap-4">
                {/* Café */}
                <div className="flex items-center gap-2" style={{ animation: "comboSlide 0.6s cubic-bezier(.22,1,.36,1) 0.3s both" }}>
                  <div className="w-14 h-14 rounded-xl bg-amber-900/30 border border-amber-700/30 flex items-center justify-center">
                    <ProductIcon emoji={combo.cafe.emoji} size="text-3xl" />
                  </div>
                </div>

                <span className="text-2xl font-black text-pink-400" style={{ animation: "comboPop 0.5s cubic-bezier(.22,1,.36,1) 0.5s both" }}>{"+"}</span>

                {/* Madeleine */}
                <div className="flex items-center gap-2" style={{ animation: "comboSlide 0.6s cubic-bezier(.22,1,.36,1) 0.6s both" }}>
                  <div className="w-14 h-14 rounded-xl bg-pink-900/30 border border-pink-700/30 flex items-center justify-center">
                    <ProductIcon emoji={combo.addon.emoji} size="text-3xl" />
                  </div>
                </div>

                <div className="flex-1 min-w-0 ml-1">
                  <p className="text-sm font-bold text-white leading-tight">
                    {combo.cafe.name}
                    <span className="text-pink-300">{" + " + (combo.addon.coffeeAddonQty || 2) + " " + combo.addon.name + "s"}</span>
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-black text-amber-400">{formatPrice(combo.totalPrice)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => { if (combo.cafe.stock > 0) addToCart(combo.cafe); }}
                disabled={combo.cafe.stock === 0}
                className={
                  "w-full mt-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 " +
                  (combo.cafe.stock > 0
                    ? "bg-gradient-to-r from-amber-600 to-pink-600 text-white cursor-pointer shadow-[0_0_25px_rgba(219,39,119,0.2)]"
                    : "bg-slate-800 text-slate-600 cursor-not-allowed")
                }
              >
                {combo.cafe.stock > 0 ? "☕ Commander le combo" : "Epuise"}
              </button>
            </div>
          </section>
        )}

        {/* ═══════════ TOP VENTES ═══════════ */}
        {popularProducts.length > 0 && !showAllProducts && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base font-black text-white">{"🔥 Top ventes"}</span>
              <span className="flex-1 h-px bg-white/5" />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {popularProducts.slice(0, 6).map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => { if (p.stock > 0) addToCart(p); }}
                  disabled={p.stock === 0}
                  className={
                    "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all active:scale-90 cursor-pointer fade-up " +
                    (addedProductId === p.id
                      ? "bg-amber-500/20 border-amber-500/50 scale-95"
                      : p.stock === 0
                        ? "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"
                        : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-amber-500/20")
                  }
                  style={{ animationDelay: (0.05 * i) + "s", animationFillMode: "both" }}
                >
                  {stockBadge(p.stock)}
                  <div className={addedProductId === p.id ? "pop-in" : ""}>
                    <ProductIcon emoji={p.emoji} size="text-3xl" />
                  </div>
                  <span className="text-[11px] font-bold text-white/90 text-center leading-tight line-clamp-2">{p.name}</span>
                  <span className="text-xs font-black text-amber-400">{formatPrice(p.price)}</span>
                  {/* Sales count */}
                  <span className="text-[9px] text-slate-500 font-medium">
                    {p.salesCount + " vendu" + (p.salesCount > 1 ? "s" : "")}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════ VOIR TOUS LES PRODUITS ═══════════ */}
        {!showAllProducts ? (
          <button
            onClick={() => { setShowAllProducts(true); Sound.pop(); }}
            className="w-full py-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white font-bold text-sm transition-all active:scale-95 cursor-pointer mb-6 flex items-center justify-center gap-2"
          >
            <span>{"📦 Voir tous les produits"}</span>
            <span className="text-slate-500 text-xs font-medium">{"(" + products.length + ")"}</span>
            <span className="text-amber-500">{"→"}</span>
          </button>
        ) : (
          <section className="mb-6">
            {/* Category tabs */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => { setActiveCategory(null); Sound.pop(); }}
                className={
                  "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-90 cursor-pointer " +
                  (!activeCategory ? "bg-amber-500 text-black" : "bg-white/5 text-slate-400 hover:bg-white/10")
                }
              >
                {"Tout"}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(activeCategory === cat.id ? null : cat.id); Sound.pop(); }}
                  className={
                    "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-90 cursor-pointer whitespace-nowrap " +
                    (activeCategory === cat.id ? "bg-amber-500 text-black" : "bg-white/5 text-slate-400 hover:bg-white/10")
                  }
                >
                  {cat.emoji + " " + cat.label}
                </button>
              ))}
            </div>

            {/* Section header */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => { setShowAllProducts(false); setActiveCategory(null); Sound.pop(); }}
                className="text-xs text-slate-500 hover:text-amber-500 transition cursor-pointer"
              >
                {"← Retour"}
              </button>
              <span className="flex-1 h-px bg-white/5" />
              <span className="text-[11px] text-slate-600 font-medium">{filteredProducts.length + " produit" + (filteredProducts.length > 1 ? "s" : "")}</span>
            </div>

            {/* Product grid */}
            <div className="grid grid-cols-3 gap-2.5">
              {filteredProducts.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => { if (p.stock > 0) addToCart(p); }}
                  disabled={p.stock === 0}
                  className={
                    "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all active:scale-90 cursor-pointer fade-up " +
                    (addedProductId === p.id
                      ? "bg-amber-500/20 border-amber-500/50"
                      : p.stock === 0
                        ? "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"
                        : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-amber-500/20")
                  }
                  style={{ animationDelay: (0.03 * i) + "s", animationFillMode: "both" }}
                >
                  {stockBadge(p.stock)}
                  <div className={addedProductId === p.id ? "pop-in" : ""}>
                    <ProductIcon emoji={p.emoji} size="text-3xl" />
                  </div>
                  <span className="text-[11px] font-bold text-white/90 text-center leading-tight line-clamp-2">{p.name}</span>
                  <span className="text-xs font-black text-amber-400">{formatPrice(p.price)}</span>
                  {p.stock <= 5 && p.stock > 0 && (
                    <span className="text-[9px] text-amber-500/60">{"Plus que " + p.stock}</span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════ INFOS PRATIQUES ═══════════ */}
        <section className="mb-8 fade-up" style={{ animationDelay: "0.4s", animationFillMode: "both" }}>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{"ℹ️"}</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{"Infos pratiques"}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-base">{"☕"}</span>
                <div>
                  <p className="font-bold text-white/80">{"Cafe"}</p>
                  <p className="text-slate-500">{"Tiroir a droite"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base">{"🧊"}</span>
                <div>
                  <p className="font-bold text-white/80">{"Boissons"}</p>
                  <p className="text-slate-500">{"Dans le frigo"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base">{"🧁"}</span>
                <div>
                  <p className="font-bold text-white/80">{"Madeleines"}</p>
                  <p className="text-slate-500">{"Dans le frigo"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base">{"💳"}</span>
                <div>
                  <p className="font-bold text-white/80">{"Paiement"}</p>
                  <p className="text-slate-500">{"Especes ou carte"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ═══════════ CART BOTTOM SHEET ═══════════ */}
      {cartCount > 0 && (
        <>
          {/* Floating cart bar */}
          {!cartOpen && (
            <div className="fixed bottom-0 left-0 right-0 z-40">
              <div className="max-w-lg mx-auto px-4 pb-4">
                <button
                  onClick={() => { setCartOpen(true); Sound.pop(); }}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-amber-500 text-black font-bold shadow-[0_-4px_30px_rgba(245,158,11,0.3)] active:scale-95 transition-all cursor-pointer"
                  style={{ animation: "slideUp 0.4s cubic-bezier(.22,1,.36,1)" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{"🛒"}</span>
                    <span className="text-sm font-black">{cartCount + " article" + (cartCount > 1 ? "s" : "")}</span>
                  </div>
                  <AnimatedPrice value={cartTotal} className="text-lg font-black" />
                </button>
              </div>
            </div>
          )}

          {/* Full cart sheet */}
          {cartOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setCartOpen(false)}>
              <div
                className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                style={{ animation: "slideUp 0.35s cubic-bezier(.22,1,.36,1)" }}
              >
                <div className="max-w-lg mx-auto bg-[#0f1628] border-t border-amber-500/20 rounded-t-3xl">
                  {/* Handle */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-white/10" />
                  </div>

                  <div className="px-5 pb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-black text-white">{"Mon panier"}</h3>
                      <button
                        onClick={() => { setCart([]); setCartOpen(false); }}
                        className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                      >
                        {"Vider"}
                      </button>
                    </div>

                    {/* Cart items */}
                    <div className="flex flex-col gap-2 mb-4">
                      {cart.map((item) => (
                        <div key={item.product.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                          <ProductIcon emoji={item.product.emoji} size="text-2xl" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{item.product.name}</p>
                            <p className="text-xs text-amber-400 font-semibold">{formatPrice(item.product.price) + " / unite"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setCart((prev) => {
                                const c = prev.find((c) => c.product.id === item.product.id);
                                if (!c) return prev;
                                if (c.qty <= 1) return prev.filter((c) => c.product.id !== item.product.id);
                                return prev.map((c) => c.product.id === item.product.id ? { ...c, qty: c.qty - 1 } : c);
                              })}
                              className="w-7 h-7 rounded-lg bg-white/5 text-white font-bold flex items-center justify-center active:scale-90 cursor-pointer hover:bg-white/10"
                            >
                              {"-"}
                            </button>
                            <span className="text-sm font-black text-white w-5 text-center">{item.qty}</span>
                            <button
                              onClick={() => addToCart(item.product)}
                              className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center active:scale-90 cursor-pointer hover:bg-amber-500/30"
                            >
                              {"+"}
                            </button>
                          </div>
                          <span className="text-sm font-black text-amber-400 min-w-[50px] text-right">
                            {formatPrice(item.product.price * item.qty)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white/60">{"Total"}</span>
                        <AnimatedPrice value={cartTotal} className="text-2xl font-black text-amber-400" />
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => {
                        Sound.success();
                        setCartOpen(false);
                        // In real app: navigate to checkout
                      }}
                      className="w-full py-4 rounded-xl bg-amber-500 text-black font-black text-base active:scale-95 cursor-pointer transition-all shadow-[0_0_30px_rgba(245,158,11,0.3)]"
                    >
                      {"Passer au paiement →"}
                    </button>

                    <p className="text-center text-[11px] text-slate-600 mt-3">
                      {"Page de test — pas de vrai paiement"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
