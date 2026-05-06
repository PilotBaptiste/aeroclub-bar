"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

const ACBA_BLUE = "#0A2FE0";
const ACBA_BLUE_DARK = "#071E96";
const ACBA_BLUE_LIGHT = "#1A40FF";
const ACBA_YELLOW = "#FFD700";

const ADMIN_BG = "#F0F4FA";
const ADMIN_CARD = "#FFFFFF";
const ADMIN_BORDER = "#E2E8F0";
const ADMIN_TEXT = "#1E293B";
const ADMIN_TEXT_SEC = "#64748B";

interface Product {
  id: string;
  name: string;
  emoji: string;
  price: number;
  frigo: number;
  reserve: number;
  maxStock: number;
  category: string;
  dlc?: string;
}

const INITIAL_PRODUCTS: Product[] = [
  { id: "cafe", name: "Café", emoji: "☕", price: 0.5, frigo: 35, reserve: 15, maxStock: 60, category: "chaud" },
  { id: "eau", name: "Eau", emoji: "💧", price: 0.5, frigo: 20, reserve: 10, maxStock: 40, category: "soft" },
  { id: "coca", name: "Coca-Cola", emoji: "🥤", price: 1.0, frigo: 14, reserve: 10, maxStock: 30, category: "soft" },
  { id: "orangina", name: "Orangina", emoji: "🍊", price: 1.0, frigo: 12, reserve: 12, maxStock: 30, category: "soft" },
  { id: "icetea", name: "Ice Tea", emoji: "🧋", price: 1.0, frigo: 8, reserve: 10, maxStock: 24, category: "soft" },
  { id: "perrier", name: "Perrier", emoji: "🧊", price: 1.0, frigo: 10, reserve: 10, maxStock: 24, category: "soft" },
  { id: "biere", name: "Bière", emoji: "🍺", price: 1.5, frigo: 12, reserve: 8, maxStock: 24, category: "alcool" },
  { id: "snack", name: "Snack", emoji: "🍫", price: 1.0, frigo: 0, reserve: 15, maxStock: 20, category: "food", dlc: "2026-05-20" },
  { id: "chips", name: "Chips", emoji: "🍟", price: 1.0, frigo: 0, reserve: 12, maxStock: 20, category: "food", dlc: "2026-08-15" },
  { id: "glace", name: "Glace", emoji: "🍦", price: 1.5, frigo: 3, reserve: 0, maxStock: 12, category: "food", dlc: "2026-06-01" },
  { id: "2xcafe", name: "2x Cafés", emoji: "☕☕", price: 0.8, frigo: 25, reserve: 0, maxStock: 30, category: "chaud" },
  { id: "jus", name: "Jus d'orange", emoji: "🧃", price: 1.0, frigo: 10, reserve: 6, maxStock: 24, category: "soft", dlc: "2026-05-10" },
];

const CATEGORIES = [
  { id: null as string | null, label: "Tout", icon: "✨" },
  { id: "soft", label: "Softs", icon: "🥤" },
  { id: "chaud", label: "Chaud", icon: "☕" },
  { id: "alcool", label: "Alcool", icon: "🍺" },
  { id: "food", label: "Snacks", icon: "🍫" },
];

interface CartItem { id: string; name: string; emoji: string; price: number; qty: number; }

interface Transaction {
  id: string;
  buyer: string;
  items: { name: string; emoji: string; qty: number; price: number }[];
  total: number;
  method: string;
  time: string;
  date: string;
}

const DEMO_TRANSACTIONS: Transaction[] = [
  { id: "t1", buyer: "Jean Dupont", items: [{ name: "Café", emoji: "☕", qty: 2, price: 0.5 }, { name: "Snack", emoji: "🍫", qty: 1, price: 1.0 }], total: 2.0, method: "cash", time: "14:32", date: "2026-05-06" },
  { id: "t2", buyer: "Marie Martin", items: [{ name: "Coca-Cola", emoji: "🥤", qty: 1, price: 1.0 }], total: 1.0, method: "card", time: "14:15", date: "2026-05-06" },
  { id: "t3", buyer: "Pierre Lefèvre", items: [{ name: "Bière", emoji: "🍺", qty: 2, price: 1.5 }, { name: "Chips", emoji: "🍟", qty: 1, price: 1.0 }], total: 4.0, method: "card", time: "13:48", date: "2026-05-06" },
  { id: "t4", buyer: "Jean Dupont", items: [{ name: "Ice Tea", emoji: "🧋", qty: 1, price: 1.0 }, { name: "Glace", emoji: "🍦", qty: 1, price: 1.5 }], total: 2.5, method: "cash", time: "13:20", date: "2026-05-05" },
  { id: "t5", buyer: "Luc Moreau", items: [{ name: "2x Cafés", emoji: "☕☕", qty: 1, price: 0.8 }], total: 0.8, method: "cash", time: "12:55", date: "2026-05-05" },
  { id: "t6", buyer: "Club (offert)", items: [{ name: "Eau", emoji: "💧", qty: 3, price: 0.5 }], total: 0, method: "free", time: "12:30", date: "2026-05-05" },
  { id: "t7", buyer: "Marie Martin", items: [{ name: "Bière", emoji: "🍺", qty: 1, price: 1.5 }, { name: "Chips", emoji: "🍟", qty: 2, price: 1.0 }], total: 3.5, method: "card", time: "16:10", date: "2026-05-04" },
  { id: "t8", buyer: "Jean Dupont", items: [{ name: "Café", emoji: "☕", qty: 3, price: 0.5 }], total: 1.5, method: "cash", time: "10:00", date: "2026-05-04" },
  { id: "t9", buyer: "Sophie Bernard", items: [{ name: "Orangina", emoji: "🍊", qty: 2, price: 1.0 }], total: 2.0, method: "cash", time: "15:30", date: "2026-05-03" },
  { id: "t10", buyer: "Pierre Lefèvre", items: [{ name: "Café", emoji: "☕", qty: 1, price: 0.5 }, { name: "Eau", emoji: "💧", qty: 1, price: 0.5 }], total: 1.0, method: "card", time: "11:15", date: "2026-05-03" },
];

const SALES_7D = [12.5, 18.0, 8.5, 22.0, 15.5, 28.0, 19.5];
const DAYS_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);
  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    const duration = 600;
    const t0 = performance.now();
    const tick = (now: number) => {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current);
      ref.current = current;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{decimals > 0 ? display.toFixed(decimals).replace(".", ",") : Math.round(display)}</>;
}

function MiniChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-1.5 h-24 w-full">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[9px] font-bold" style={{ color: ADMIN_TEXT_SEC }}>{v.toFixed(0)}€</span>
          <div className="w-full rounded-t-lg anim-stock-fill" style={{
            height: (v / max) * 100 + "%",
            background: i === data.length - 1
              ? `linear-gradient(180deg, ${ACBA_YELLOW}, ${ACBA_YELLOW}90)`
              : `linear-gradient(180deg, ${ACBA_BLUE}40, ${ACBA_BLUE}20)`,
            animationDelay: i * 0.08 + "s",
            minHeight: "6px",
          }} />
          <span className="text-[9px] font-semibold" style={{ color: ADMIN_TEXT_SEC }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function AdminCard({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <div className={"rounded-2xl p-4 shadow-sm " + className}
      style={{ background: ADMIN_CARD, border: "1px solid " + ADMIN_BORDER, animation: `fadeSlideUp 0.4s ease-out ${delay}s both` }}>
      {children}
    </div>
  );
}

export default function DevPage() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [mounted, setMounted] = useState(false);
  const [tappedId, setTappedId] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [cartBounce, setCartBounce] = useState(false);
  const [mode, setMode] = useState<"client" | "admin">("client");
  const [adminTab, setAdminTab] = useState<"dashboard" | "stock" | "history" | "finance" | "members" | "settings">("dashboard");
  const [barOpen, setBarOpen] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [transactions] = useState<Transaction[]>(DEMO_TRANSACTIONS);
  const [showConfetti, setShowConfetti] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [showRecap, setShowRecap] = useState(false);
  const [inventoryMode, setInventoryMode] = useState(false);
  const [inventoryCounts, setInventoryCounts] = useState<Record<string, { frigo: string; reserve: string }>>({});
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Offline: load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("acba-dev-products");
      if (saved) {
        setProducts(JSON.parse(saved));
        setOfflineReady(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Offline: save to localStorage on change
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("acba-dev-products", JSON.stringify(products));
      setOfflineReady(true);
    } catch { /* ignore */ }
  }, [products, mounted]);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const todayRevenue = transactions.reduce((s, t) => s + t.total, 0);
  const todaySales = transactions.length;
  const lowStockProducts = products.filter((p) => p.frigo + p.reserve <= 5);
  const dlcAlerts = products.filter((p) => {
    if (!p.dlc) return false;
    const days = (new Date(p.dlc).getTime() - Date.now()) / 86400000;
    return days <= 14;
  });

  // Member history
  const memberStats = (() => {
    const map: Record<string, { total: number; count: number; items: Record<string, number> }> = {};
    transactions.forEach((t) => {
      if (!map[t.buyer]) map[t.buyer] = { total: 0, count: 0, items: {} };
      map[t.buyer].total += t.total;
      map[t.buyer].count += 1;
      t.items.forEach((it) => {
        map[t.buyer].items[it.emoji + " " + it.name] = (map[t.buyer].items[it.emoji + " " + it.name] || 0) + it.qty;
      });
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  })();

  const filteredMembers = memberSearch
    ? memberStats.filter((m) => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
    : memberStats;

  // Monthly recap
  const monthlyRecap = (() => {
    const ca = transactions.reduce((s, t) => s + t.total, 0);
    const productCounts: Record<string, { emoji: string; name: string; qty: number; revenue: number }> = {};
    transactions.forEach((t) => t.items.forEach((it) => {
      const k = it.name;
      if (!productCounts[k]) productCounts[k] = { emoji: it.emoji, name: it.name, qty: 0, revenue: 0 };
      productCounts[k].qty += it.qty;
      productCounts[k].revenue += it.qty * it.price;
    }));
    const topProducts = Object.values(productCounts).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const topConsumers = memberStats.filter((m) => m.name !== "Club (offert)").slice(0, 5);
    return { ca, count: transactions.length, topProducts, topConsumers };
  })();

  const addToCart = useCallback((p: Product) => {
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

  const doPayment = () => {
    setShowCheckout(false);
    setShowConfetti(true);
    setCart([]);
    setBuyerName("");
    setTimeout(() => setShowConfetti(false), 2500);
  };

  const transferStock = (productId: string, direction: "toFrigo" | "toReserve", qty: number) => {
    setProducts((prev) => prev.map((p) => {
      if (p.id !== productId) return p;
      if (direction === "toFrigo") {
        const moved = Math.min(qty, p.reserve);
        return { ...p, frigo: p.frigo + moved, reserve: p.reserve - moved };
      } else {
        const moved = Math.min(qty, p.frigo);
        return { ...p, frigo: p.frigo - moved, reserve: p.reserve + moved };
      }
    }));
  };

  const applyInventory = () => {
    setProducts((prev) => prev.map((p) => {
      const counts = inventoryCounts[p.id];
      if (!counts) return p;
      const f = counts.frigo !== "" ? parseInt(counts.frigo) : p.frigo;
      const r = counts.reserve !== "" ? parseInt(counts.reserve) : p.reserve;
      return { ...p, frigo: isNaN(f) ? p.frigo : f, reserve: isNaN(r) ? p.reserve : r };
    }));
    setInventoryMode(false);
    setInventoryCounts({});
  };

  const filtered = products.filter((p) => !activeCategory || p.category === activeCategory);
  const filteredStock = searchQuery
    ? products.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  const isAdmin = mode === "admin";

  const glass = (opacity = "08") => ({
    background: `linear-gradient(135deg, rgba(255,255,255,0.${opacity}) 0%, rgba(255,255,255,0.02) 100%)`,
    border: "1px solid " + ACBA_BLUE + "20",
    borderRadius: "16px",
  });

  return (
    <div className={"min-h-screen pb-20 " + (isAdmin ? "" : "text-white")} style={{ background: isAdmin ? ADMIN_BG : "linear-gradient(180deg, #040C24 0%, #06103A 50%, #040C24 100%)", color: isAdmin ? ADMIN_TEXT : undefined, transition: "background 0.4s" }}>

      {/* ── Confetti ── */}
      {showConfetti && (
        <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="confetti-piece" style={{ left: Math.random() * 100 + "%", animationDelay: Math.random() * 0.5 + "s", background: [ACBA_YELLOW, ACBA_BLUE_LIGHT, "#10B981", "#F97316", "#EF4444", "#fff"][i % 6] }} />
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center" style={{ animation: "popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}>
              <div className="text-6xl mb-3">✅</div>
              <div className="text-2xl font-black" style={{ color: ACBA_YELLOW }}>Paiement enregistré !</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b" style={{
        background: isAdmin ? "rgba(255,255,255,0.9)" : "rgba(4,12,36,0.85)",
        backdropFilter: "blur(16px)",
        borderColor: isAdmin ? ADMIN_BORDER : ACBA_BLUE + "30",
        transition: "background 0.4s",
      }}>
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={isAdmin ? "" : "anim-float"}>
              <Image src="/logo-acba.png" alt="ACBA" width={44} height={62} className="object-contain drop-shadow-lg" priority />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight" style={{ color: isAdmin ? ACBA_BLUE : ACBA_YELLOW }}>
                {isAdmin ? "ADMIN" : "AÉRO-CLUB BAR"}
              </h1>
              <p className="text-[9px] font-medium" style={{ color: isAdmin ? ADMIN_TEXT_SEC : ACBA_BLUE_LIGHT + "80" }}>Bassin d&#39;Arcachon</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && offlineReady && (
              <div className="h-6 px-2 rounded-full flex items-center gap-1" style={{ background: "#10B98115", border: "1px solid #10B98130" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10B981" }} />
                <span className="text-[9px] font-semibold" style={{ color: "#10B981" }}>Offline OK</span>
              </div>
            )}
            {isAdmin && (
              <button onClick={() => setBarOpen(!barOpen)} className="h-7 px-2.5 rounded-full flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform shadow-sm"
                style={{ background: barOpen ? "#ECFDF5" : "#FEF2F2", border: "1px solid " + (barOpen ? "#BBF7D0" : "#FECACA") }}>
                <span className={"w-2 h-2 rounded-full " + (barOpen ? "anim-pulse-dot" : "")} style={{ background: barOpen ? "#22C55E" : "#EF4444" }} />
                <span className="text-[10px] font-semibold" style={{ color: barOpen ? "#16A34A" : "#DC2626" }}>{barOpen ? "Ouvert" : "Fermé"}</span>
              </button>
            )}
            {!isAdmin && (
              <div className="h-7 px-2.5 rounded-full flex items-center gap-1.5 anim-glow" style={{ background: ACBA_BLUE + "20", border: "1px solid " + ACBA_BLUE + "40" }}>
                <span className="w-2 h-2 rounded-full anim-pulse-dot" style={{ background: barOpen ? "#22C55E" : "#EF4444" }} />
                <span className="text-[10px] font-semibold" style={{ color: barOpen ? "#22C55E" : "#EF4444" }}>{barOpen ? "Bar ouvert" : "Fermé"}</span>
              </div>
            )}
            {/* Mode toggle button in header */}
            <button onClick={() => setMode(isAdmin ? "client" : "admin")}
              className="h-8 px-3 rounded-full flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform font-bold text-[11px]"
              style={isAdmin
                ? { background: ACBA_BLUE, color: "#fff" }
                : { background: ACBA_BLUE + "20", color: ACBA_BLUE_LIGHT, border: "1px solid " + ACBA_BLUE + "30" }}>
              {isAdmin ? "🍺 Bar" : "⚙️ Admin"}
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════ CLIENT MODE ═══════════════ */}
      {!isAdmin && (
        <>
          {/* Categories */}
          <div className="sticky top-[54px] z-20" style={{ background: "rgba(4,12,36,0.9)", backdropFilter: "blur(12px)" }}>
            <div className="max-w-4xl mx-auto px-3 py-2.5 flex gap-2 overflow-x-auto no-scrollbar">
              {CATEGORIES.map((cat) => (
                <button key={cat.id ?? "all"} onClick={() => setActiveCategory(cat.id)}
                  className={"shrink-0 px-5 py-2 rounded-full text-xs font-bold cursor-pointer anim-pill " + (activeCategory === cat.id ? "anim-pill-active" : "")}
                  style={activeCategory === cat.id
                    ? { background: ACBA_YELLOW, color: "#000", boxShadow: "0 4px 15px " + ACBA_YELLOW + "40" }
                    : { background: ACBA_BLUE + "15", color: ACBA_BLUE_LIGHT + "80", border: "1px solid " + ACBA_BLUE + "25" }}
                >{cat.icon + "  " + cat.label}</button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <main className="max-w-4xl mx-auto px-3 py-4">
            <div className="grid grid-cols-3 min-[600px]:grid-cols-6 gap-2.5">
              {filtered.map((p, i) => {
                const inCart = cart.find((c) => c.id === p.id);
                const stock = p.frigo + p.reserve;
                const out = stock <= 0;
                const pct = Math.min(100, (stock / p.maxStock) * 100);
                const isTapped = tappedId === p.id;
                const wasJustAdded = justAdded === p.id;
                return (
                  <button key={p.id} onClick={() => !out && addToCart(p)} disabled={out}
                    className={"group relative rounded-2xl overflow-hidden cursor-pointer " + (out ? "opacity-30 cursor-not-allowed" : "")}
                    style={{ animation: mounted ? `fadeSlideUp 0.4s ease-out ${i * 0.05}s both` : "none", transform: isTapped ? "scale(0.92)" : "scale(1)", transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
                    <div className="relative p-3 pb-2 flex flex-col items-center gap-1" style={{
                      background: inCart ? "linear-gradient(160deg, " + ACBA_BLUE + "35 0%, " + ACBA_BLUE + "15 100%)" : "linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)",
                      border: inCart ? "2px solid " + ACBA_YELLOW + "80" : "1px solid " + ACBA_BLUE + "20", borderRadius: "16px", transition: "border-color 0.3s, background 0.3s" }}>
                      {inCart && <div className={"absolute top-1.5 right-1.5 min-w-[22px] h-[22px] px-1 rounded-full text-[11px] font-black flex items-center justify-center " + (wasJustAdded ? "anim-badge-pop" : "")} style={{ background: ACBA_YELLOW, color: "#000", boxShadow: "0 2px 8px " + ACBA_YELLOW + "60" }}>{String(inCart.qty)}</div>}
                      <span className="text-4xl drop-shadow-md" style={{ transform: isTapped ? "scale(1.3) rotate(-8deg)" : "scale(1)", transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>{p.emoji}</span>
                      <span className="text-[11px] font-semibold leading-tight text-center text-white/90">{p.name}</span>
                      <span className="text-sm font-black" style={{ color: ACBA_YELLOW }}>{p.price.toFixed(2).replace(".", ",") + " €"}</span>
                      {!out && (
                        <div className="w-full mt-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: ACBA_BLUE + "25" }}>
                              <div className="h-full rounded-full anim-stock-fill" style={{ width: pct + "%", background: stock <= 5 ? "linear-gradient(90deg, #EF4444, #F97316)" : stock <= 10 ? "linear-gradient(90deg, #F59E0B, " + ACBA_YELLOW + ")" : "linear-gradient(90deg, " + ACBA_BLUE_LIGHT + ", " + ACBA_BLUE + "80)", animationDelay: (i * 0.05 + 0.3) + "s" }} />
                            </div>
                            <span className="text-[9px] font-bold tabular-nums min-w-[18px] text-right" style={{ color: stock <= 5 ? "#F97316" : stock <= 10 ? ACBA_YELLOW : ACBA_BLUE_LIGHT + "60" }}>{String(stock)}</span>
                          </div>
                          {stock <= 5 && <span className="text-[8px] text-orange-400 font-semibold block text-center mt-0.5 anim-blink">Stock bas !</span>}
                        </div>
                      )}
                      {out && <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Épuisé</span>}
                      {isTapped && <div className="absolute inset-0 rounded-2xl anim-ripple" style={{ background: ACBA_YELLOW + "15" }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </main>

          {/* Cart Bar */}
          {cartCount > 0 && (
            <div className="fixed bottom-16 inset-x-0 z-40 pb-safe" style={{ animation: "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}>
              <div className="max-w-4xl mx-auto px-3 pb-3">
                <button onClick={() => setShowCheckout(true)}
                  className={"w-full flex items-center justify-between rounded-2xl px-5 py-4 shadow-2xl cursor-pointer active:scale-[0.98] " + (cartBounce ? "anim-cart-bounce" : "")}
                  style={{ background: "linear-gradient(135deg, " + ACBA_YELLOW + " 0%, #FFC000 100%)", color: "#000", boxShadow: "0 8px 30px " + ACBA_YELLOW + "40", transition: "transform 0.2s" }}>
                  <div className="flex items-center gap-3">
                    <div className={"w-9 h-9 rounded-full flex items-center justify-center text-sm font-black " + (cartBounce ? "anim-badge-pop" : "")} style={{ background: "rgba(0,0,0,0.15)" }}>{String(cartCount)}</div>
                    <span className="font-bold text-sm">Voir le panier</span>
                  </div>
                  <span className="text-lg font-black">{cartTotal.toFixed(2).replace(".", ",") + " €"}</span>
                </button>
                <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                  {cart.map((item) => (
                    <button key={item.id} onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                      className="shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 cursor-pointer group"
                      style={{ background: ACBA_BLUE + "30", border: "1px solid " + ACBA_BLUE + "40", animation: "popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}>
                      <span className="text-sm">{item.emoji}</span>
                      {item.qty > 1 && <span className="text-[10px] font-bold text-slate-400">{item.qty + "x"}</span>}
                      <span className="text-[10px] text-slate-500 group-hover:text-red-400 transition-colors">✕</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Checkout Sheet */}
          {showCheckout && (
            <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowCheckout(false)}>
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm anim-fade-in" />
              <div className="relative w-full max-w-lg rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
                style={{ background: "#0A1228", border: "1px solid " + ACBA_BLUE + "30", borderBottom: "none", animation: "sheetUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}>
                <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: ACBA_BLUE + "40" }} /></div>
                <div className="px-5 pb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <Image src="/logo-acba.png" alt="ACBA" width={28} height={40} className="object-contain" />
                    <h2 className="text-xl font-bold">Votre commande</h2>
                  </div>
                  <div className="flex flex-col gap-2 mb-5">
                    {cart.map((item, i) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: ACBA_BLUE + "10", border: "1px solid " + ACBA_BLUE + "20", animation: `fadeSlideUp 0.3s ease-out ${i * 0.06}s both` }}>
                        <span className="text-2xl">{item.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold block truncate">{item.name}</span>
                          <span className="text-xs" style={{ color: ACBA_BLUE_LIGHT + "70" }}>{item.price.toFixed(2).replace(".", ",") + " € / unité"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => removeFromCart(item.id)} className="w-9 h-9 rounded-xl font-bold flex items-center justify-center cursor-pointer active:scale-90 transition-all text-sm text-red-400" style={{ background: ACBA_BLUE + "20" }}>−</button>
                          <span className="w-8 text-center font-bold text-lg">{String(item.qty)}</span>
                          <button onClick={() => addToCart(products.find((pp) => pp.id === item.id)!)} className="w-9 h-9 rounded-xl font-bold flex items-center justify-center cursor-pointer active:scale-90 transition-all text-sm text-emerald-400" style={{ background: ACBA_BLUE + "20" }}>+</button>
                        </div>
                        <span className="text-sm font-bold w-14 text-right" style={{ color: ACBA_YELLOW }}>{(item.price * item.qty).toFixed(2).replace(".", ",") + "€"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-5 anim-shimmer" style={{ background: ACBA_YELLOW + "10", border: "1px solid " + ACBA_YELLOW + "30" }}>
                    <span className="text-sm font-semibold text-slate-400">Total</span>
                    <span className="text-2xl font-black" style={{ color: ACBA_YELLOW }}>{cartTotal.toFixed(2).replace(".", ",") + " €"}</span>
                  </div>
                  <div className="mb-5">
                    <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: ACBA_BLUE_LIGHT + "70" }}>Votre nom</label>
                    <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Prénom Nom"
                      className="w-full h-12 rounded-xl text-white text-sm px-4 outline-none placeholder:text-slate-600"
                      style={{ background: ACBA_BLUE + "15", border: "1px solid " + ACBA_BLUE + "30", transition: "border-color 0.3s, box-shadow 0.3s" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = ACBA_YELLOW + "60"; e.currentTarget.style.boxShadow = "0 0 0 3px " + ACBA_YELLOW + "15"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = ACBA_BLUE + "30"; e.currentTarget.style.boxShadow = "none"; }} />
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACBA_BLUE_LIGHT + "70" }}>Paiement</span>
                    {[
                      { label: "Espèces", icon: "💵", bg: "linear-gradient(135deg, #10B981, #059669)", shadow: "rgba(16,185,129,0.3)" },
                      { label: "Carte bancaire", icon: "💳", bg: "linear-gradient(135deg, " + ACBA_BLUE_LIGHT + ", " + ACBA_BLUE + ")", shadow: ACBA_BLUE + "40" },
                    ].map((btn) => (
                      <button key={btn.label} onClick={doPayment}
                        className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg active:scale-[0.97] cursor-pointer flex items-center justify-center gap-2 anim-btn-shine"
                        style={{ background: btn.bg, boxShadow: "0 6px 20px " + btn.shadow, transition: "transform 0.15s" }}>
                        <span className="text-lg">{btn.icon}</span><span>{btn.label}</span>
                      </button>
                    ))}
                    <button onClick={doPayment} className="w-full py-3.5 rounded-2xl text-slate-400 font-semibold text-sm cursor-pointer active:scale-[0.97] flex items-center justify-center gap-2" style={{ background: ACBA_BLUE + "10", border: "1px solid " + ACBA_BLUE + "25", transition: "transform 0.15s" }}>
                      <span>🎁</span><span>Offert</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════ ADMIN MODE ═══════════════ */}
      {isAdmin && (
        <>
          {/* Admin sub-tabs */}
          <div className="sticky top-[54px] z-20 border-b" style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderColor: ADMIN_BORDER }}>
            <div className="max-w-4xl mx-auto px-2 py-2 flex gap-1 overflow-x-auto no-scrollbar">
              {([
                { id: "dashboard" as const, label: "📊 Board" },
                { id: "stock" as const, label: "📦 Stock" },
                { id: "finance" as const, label: "💰 Finances" },
                { id: "history" as const, label: "📋 Ventes" },
                { id: "members" as const, label: "👥 Comptes" },
                { id: "settings" as const, label: "⚙ Config" },
              ]).map((tab) => (
                <button key={tab.id} onClick={() => setAdminTab(tab.id)}
                  className="shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer transition-all active:scale-95"
                  style={adminTab === tab.id
                    ? { background: ACBA_BLUE, color: "#fff", boxShadow: "0 2px 8px " + ACBA_BLUE + "30" }
                    : { background: "transparent", color: ADMIN_TEXT_SEC }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <main className="max-w-4xl mx-auto px-3 py-4">

            {/* ── DASHBOARD ── */}
            {adminTab === "dashboard" && (
              <div className="flex flex-col gap-3">
                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "CA du jour", value: todayRevenue, suffix: " €", icon: "💰", color: "#059669", decimals: 2 },
                    { label: "Ventes", value: todaySales, suffix: "", icon: "🧾", color: ACBA_BLUE, decimals: 0 },
                    { label: "Stock bas", value: lowStockProducts.length, suffix: "", icon: "⚠️", color: "#EA580C", decimals: 0 },
                    { label: "Alertes DLC", value: dlcAlerts.length, suffix: "", icon: "📅", color: "#DC2626", decimals: 0 },
                  ].map((stat, i) => (
                    <AdminCard key={stat.label} delay={i * 0.08}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold" style={{ color: ADMIN_TEXT_SEC }}>{stat.label}</span>
                        <span className="text-lg">{stat.icon}</span>
                      </div>
                      <div className="text-2xl font-black" style={{ color: stat.color }}>
                        <AnimatedNumber value={stat.value} decimals={stat.decimals} />{stat.suffix}
                      </div>
                    </AdminCard>
                  ))}
                </div>

                {/* Chart */}
                <AdminCard delay={0.3}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold" style={{ color: ADMIN_TEXT_SEC }}>Ventes 7 jours</span>
                    <span className="text-sm font-bold" style={{ color: ACBA_BLUE }}>
                      <AnimatedNumber value={SALES_7D.reduce((a, b) => a + b, 0)} decimals={2} /> €
                    </span>
                  </div>
                  <MiniChart data={SALES_7D} labels={DAYS_LABELS} />
                </AdminCard>

                {/* Recap button */}
                <button onClick={() => setShowRecap(true)}
                  className="w-full py-3 rounded-2xl text-sm font-bold cursor-pointer active:scale-[0.98] transition-transform shadow-sm flex items-center justify-center gap-2"
                  style={{ background: ACBA_BLUE, color: "#fff", animation: "fadeSlideUp 0.4s ease-out 0.35s both" }}>
                  <span>📈</span> Voir le récap mensuel
                </button>

                {/* Alerts */}
                {(lowStockProducts.length > 0 || dlcAlerts.length > 0) && (
                  <div className="flex flex-col gap-2" style={{ animation: "fadeSlideUp 0.4s ease-out 0.4s both" }}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: ADMIN_TEXT_SEC }}>Alertes</h3>
                    {lowStockProducts.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 shadow-sm" style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                        <span className="text-xl">{p.emoji}</span>
                        <div className="flex-1">
                          <span className="text-sm font-semibold" style={{ color: ADMIN_TEXT }}>{p.name}</span>
                          <span className="text-xs text-orange-600 block">Stock bas : {p.frigo + p.reserve} restants</span>
                        </div>
                        <span className="text-orange-500 text-lg">⚠️</span>
                      </div>
                    ))}
                    {dlcAlerts.map((p) => {
                      const days = Math.ceil((new Date(p.dlc!).getTime() - Date.now()) / 86400000);
                      const expired = days <= 0;
                      return (
                        <div key={p.id + "-dlc"} className="flex items-center gap-3 rounded-xl px-3 py-2.5 shadow-sm"
                          style={{ background: expired ? "#FEF2F2" : "#FFFBEB", border: "1px solid " + (expired ? "#FECACA" : "#FDE68A") }}>
                          <span className="text-xl">{p.emoji}</span>
                          <div className="flex-1">
                            <span className="text-sm font-semibold" style={{ color: ADMIN_TEXT }}>{p.name}</span>
                            <span className={"text-xs block " + (expired ? "text-red-600" : "text-amber-600")}>
                              {expired ? "DLC dépassée !" : "DLC dans " + days + " jours (" + p.dlc + ")"}
                            </span>
                          </div>
                          <span className="text-lg">{expired ? "🚫" : "📅"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Recent activity */}
                <div style={{ animation: "fadeSlideUp 0.4s ease-out 0.5s both" }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: ADMIN_TEXT_SEC }}>Activité récente</h3>
                  <div className="flex flex-col gap-1.5">
                    {transactions.slice(0, 4).map((t, i) => (
                      <AdminCard key={t.id} className="!p-3" delay={0.5 + i * 0.05}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ background: ACBA_BLUE + "10" }}>
                            {t.method === "cash" ? "💵" : t.method === "card" ? "💳" : "🎁"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold block truncate">{t.buyer}</span>
                            <span className="text-[11px]" style={{ color: ADMIN_TEXT_SEC }}>{t.items.map((it) => it.emoji + (it.qty > 1 ? "×" + it.qty : "")).join(" ")}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold block" style={{ color: t.total > 0 ? ACBA_BLUE : "#059669" }}>{t.total > 0 ? t.total.toFixed(2).replace(".", ",") + " €" : "Offert"}</span>
                            <span className="text-[10px]" style={{ color: ADMIN_TEXT_SEC }}>{t.time}</span>
                          </div>
                        </div>
                      </AdminCard>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STOCK ── */}
            {adminTab === "stock" && (
              <div className="flex flex-col gap-3" style={{ animation: "fadeSlideUp 0.4s ease-out both" }}>
                {/* Search + Inventory toggle */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..."
                      className="w-full h-11 rounded-xl text-sm pl-9 pr-4 outline-none placeholder:text-slate-400"
                      style={{ background: ADMIN_CARD, border: "1px solid " + ADMIN_BORDER, color: ADMIN_TEXT }} />
                  </div>
                  <button onClick={() => { setInventoryMode(!inventoryMode); if (inventoryMode) setInventoryCounts({}); }}
                    className="h-11 px-4 rounded-xl text-xs font-bold cursor-pointer active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                    style={inventoryMode
                      ? { background: ACBA_YELLOW, color: "#000", boxShadow: "0 2px 8px " + ACBA_YELLOW + "40" }
                      : { background: ADMIN_CARD, border: "1px solid " + ADMIN_BORDER, color: ADMIN_TEXT }}>
                    <span>📋</span> {inventoryMode ? "Inventaire..." : "Inventaire"}
                  </button>
                </div>

                {/* Inventory apply button */}
                {inventoryMode && Object.keys(inventoryCounts).length > 0 && (
                  <button onClick={applyInventory}
                    className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer active:scale-[0.98] transition-transform"
                    style={{ background: "#059669", color: "#fff", animation: "fadeSlideUp 0.3s ease-out both" }}>
                    ✅ Valider l&#39;inventaire ({Object.keys(inventoryCounts).length} produits modifiés)
                  </button>
                )}

                {/* Stock list */}
                {filteredStock.map((p, i) => {
                  const total = p.frigo + p.reserve;
                  const inv = inventoryCounts[p.id];
                  const invFrigo = inv?.frigo !== undefined && inv.frigo !== "" ? parseInt(inv.frigo) : null;
                  const invReserve = inv?.reserve !== undefined && inv.reserve !== "" ? parseInt(inv.reserve) : null;
                  const frigoEcart = invFrigo !== null && !isNaN(invFrigo) ? invFrigo - p.frigo : null;
                  const reserveEcart = invReserve !== null && !isNaN(invReserve) ? invReserve - p.reserve : null;

                  return (
                    <div key={p.id} className="rounded-2xl p-3.5 shadow-sm"
                      style={{ background: ADMIN_CARD, border: "1px solid " + ADMIN_BORDER, animation: `fadeSlideUp 0.3s ease-out ${i * 0.04}s both` }}>
                      <button onClick={() => !inventoryMode && setSelectedProduct(p)}
                        className={"w-full text-left " + (inventoryMode ? "" : "cursor-pointer")}>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{p.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold truncate" style={{ color: ADMIN_TEXT }}>{p.name}</span>
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: ACBA_BLUE + "10", color: ACBA_BLUE }}>{p.price.toFixed(2).replace(".", ",") + "€"}</span>
                            </div>
                            {/* Dual bar */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 flex-1">
                                <span className="text-[9px] font-semibold w-7" style={{ color: "#3B82F6" }}>❄️ {p.frigo}</span>
                                <div className="flex-1 h-[6px] rounded-full overflow-hidden flex" style={{ background: "#E2E8F0" }}>
                                  <div className="h-full rounded-l-full transition-all duration-500" style={{ width: (p.maxStock > 0 ? (p.frigo / p.maxStock) * 100 : 0) + "%", background: "linear-gradient(90deg, #3B82F6, #60A5FA)" }} />
                                  <div className="h-full rounded-r-full transition-all duration-500" style={{ width: (p.maxStock > 0 ? (p.reserve / p.maxStock) * 100 : 0) + "%", background: "linear-gradient(90deg, #F59E0B, #FBBF24)" }} />
                                </div>
                                <span className="text-[9px] font-semibold w-7 text-right" style={{ color: "#D97706" }}>📦 {p.reserve}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] font-semibold" style={{ color: total <= 5 ? "#EA580C" : ADMIN_TEXT_SEC }}>Total : {total}/{p.maxStock}</span>
                              {p.dlc && (
                                <span className="text-[10px] font-semibold" style={{ color: Math.ceil((new Date(p.dlc).getTime() - Date.now()) / 86400000) <= 7 ? "#DC2626" : ADMIN_TEXT_SEC }}>DLC : {p.dlc}</span>
                              )}
                            </div>
                          </div>
                          {!inventoryMode && <span style={{ color: ADMIN_TEXT_SEC }} className="text-sm">›</span>}
                        </div>
                      </button>

                      {/* Inventory inputs */}
                      {inventoryMode && (
                        <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: "1px solid " + ADMIN_BORDER }}>
                          <div className="flex-1">
                            <label className="text-[9px] font-semibold block mb-1" style={{ color: "#3B82F6" }}>❄️ Frigo réel</label>
                            <input type="number" inputMode="numeric" placeholder={String(p.frigo)}
                              value={inv?.frigo ?? ""}
                              onChange={(e) => setInventoryCounts((prev) => ({ ...prev, [p.id]: { frigo: e.target.value, reserve: prev[p.id]?.reserve ?? "" } }))}
                              className="w-full h-10 rounded-lg text-center text-sm font-bold outline-none"
                              style={{ background: "#F0F4FA", border: "1px solid " + ADMIN_BORDER, color: ADMIN_TEXT }} />
                            {frigoEcart !== null && frigoEcart !== 0 && (
                              <span className={"text-[10px] font-bold block text-center mt-0.5 " + (frigoEcart > 0 ? "text-emerald-600" : "text-red-600")}>
                                {frigoEcart > 0 ? "+" : ""}{frigoEcart}
                              </span>
                            )}
                          </div>
                          <div className="flex-1">
                            <label className="text-[9px] font-semibold block mb-1" style={{ color: "#D97706" }}>📦 Réserve réel</label>
                            <input type="number" inputMode="numeric" placeholder={String(p.reserve)}
                              value={inv?.reserve ?? ""}
                              onChange={(e) => setInventoryCounts((prev) => ({ ...prev, [p.id]: { frigo: prev[p.id]?.frigo ?? "", reserve: e.target.value } }))}
                              className="w-full h-10 rounded-lg text-center text-sm font-bold outline-none"
                              style={{ background: "#F0F4FA", border: "1px solid " + ADMIN_BORDER, color: ADMIN_TEXT }} />
                            {reserveEcart !== null && reserveEcart !== 0 && (
                              <span className={"text-[10px] font-bold block text-center mt-0.5 " + (reserveEcart > 0 ? "text-emerald-600" : "text-red-600")}>
                                {reserveEcart > 0 ? "+" : ""}{reserveEcart}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── HISTORY ── */}
            {adminTab === "history" && (
              <div className="flex flex-col gap-3" style={{ animation: "fadeSlideUp 0.4s ease-out both" }}>
                {/* Summary */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Espèces", value: transactions.filter((t) => t.method === "cash").reduce((s, t) => s + t.total, 0), icon: "💵" },
                    { label: "Carte", value: transactions.filter((t) => t.method === "card").reduce((s, t) => s + t.total, 0), icon: "💳" },
                    { label: "Offerts", value: transactions.filter((t) => t.method === "free").length, icon: "🎁", noEuro: true },
                  ].map((s, i) => (
                    <AdminCard key={s.label} className="!p-3 text-center" delay={i * 0.08}>
                      <div className="text-lg mb-1">{s.icon}</div>
                      <div className="text-sm font-black" style={{ color: ACBA_BLUE }}>
                        <AnimatedNumber value={s.value} decimals={("noEuro" in s) ? 0 : 2} />{("noEuro" in s) ? "" : " €"}
                      </div>
                      <div className="text-[9px]" style={{ color: ADMIN_TEXT_SEC }}>{s.label}</div>
                    </AdminCard>
                  ))}
                </div>

                {/* Member search */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">👤</span>
                  <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Rechercher un membre..."
                    className="w-full h-11 rounded-xl text-sm pl-9 pr-4 outline-none placeholder:text-slate-400"
                    style={{ background: ADMIN_CARD, border: "1px solid " + ADMIN_BORDER, color: ADMIN_TEXT }} />
                </div>

                {/* Member history or full history */}
                {memberSearch ? (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: ADMIN_TEXT_SEC }}>Historique par membre</h3>
                    {filteredMembers.length === 0 && (
                      <div className="text-center py-8 text-sm" style={{ color: ADMIN_TEXT_SEC }}>Aucun membre trouvé</div>
                    )}
                    {filteredMembers.map((m, i) => (
                      <AdminCard key={m.name} delay={i * 0.06}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: ACBA_BLUE + "10", color: ACBA_BLUE }}>
                              {m.name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-sm font-bold block" style={{ color: ADMIN_TEXT }}>{m.name}</span>
                              <span className="text-[10px]" style={{ color: ADMIN_TEXT_SEC }}>{m.count} transaction{m.count > 1 ? "s" : ""}</span>
                            </div>
                          </div>
                          <span className="text-base font-black" style={{ color: ACBA_BLUE }}>{m.total.toFixed(2).replace(".", ",") + " €"}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(m.items).map(([name, qty]) => (
                            <span key={name} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#F0F4FA", color: ADMIN_TEXT_SEC }}>
                              {name} ×{qty}
                            </span>
                          ))}
                        </div>
                      </AdminCard>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {transactions.map((t, i) => (
                      <AdminCard key={t.id} className="!p-3.5" delay={i * 0.05 + 0.2}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: ACBA_BLUE + "10" }}>
                              {t.method === "cash" ? "💵" : t.method === "card" ? "💳" : "🎁"}
                            </div>
                            <div>
                              <span className="text-sm font-bold block" style={{ color: ADMIN_TEXT }}>{t.buyer}</span>
                              <span className="text-[10px]" style={{ color: ADMIN_TEXT_SEC }}>{t.date} {t.time}</span>
                            </div>
                          </div>
                          <span className="text-base font-black" style={{ color: t.total > 0 ? ACBA_BLUE : "#059669" }}>
                            {t.total > 0 ? t.total.toFixed(2).replace(".", ",") + " €" : "Offert"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {t.items.map((item, j) => (
                            <span key={j} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: "#F0F4FA", color: ADMIN_TEXT_SEC }}>
                              {item.emoji} {item.name} {item.qty > 1 ? "×" + item.qty : ""}
                            </span>
                          ))}
                        </div>
                      </AdminCard>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── FINANCE ── */}
            {adminTab === "finance" && (
              <div className="flex flex-col gap-3" style={{ animation: "fadeSlideUp 0.4s ease-out both" }}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "CA total", value: todayRevenue, icon: "💰", color: "#059669" },
                    { label: "Bénéfice estimé", value: todayRevenue * 0.35, icon: "📈", color: ACBA_BLUE },
                    { label: "Espèces", value: transactions.filter((t) => t.method === "cash").reduce((s, t) => s + t.total, 0), icon: "💵", color: "#16A34A" },
                    { label: "Carte", value: transactions.filter((t) => t.method === "card").reduce((s, t) => s + t.total, 0), icon: "💳", color: "#7C3AED" },
                  ].map((stat, i) => (
                    <AdminCard key={stat.label} delay={i * 0.08}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold" style={{ color: ADMIN_TEXT_SEC }}>{stat.label}</span>
                        <span className="text-lg">{stat.icon}</span>
                      </div>
                      <div className="text-2xl font-black" style={{ color: stat.color }}>
                        <AnimatedNumber value={stat.value} decimals={2} /> €
                      </div>
                    </AdminCard>
                  ))}
                </div>

                <AdminCard delay={0.3}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: ADMIN_TEXT_SEC }}>Répartition des ventes</h3>
                  {(() => {
                    const productSales: Record<string, { emoji: string; name: string; qty: number; revenue: number; cost: number }> = {};
                    transactions.forEach((t) => t.items.forEach((it) => {
                      const k = it.name;
                      if (!productSales[k]) productSales[k] = { emoji: it.emoji, name: it.name, qty: 0, revenue: 0, cost: 0 };
                      productSales[k].qty += it.qty;
                      productSales[k].revenue += it.qty * it.price;
                      productSales[k].cost += it.qty * it.price * 0.6;
                    }));
                    return Object.values(productSales).sort((a, b) => b.revenue - a.revenue).map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3 py-2" style={{ borderTop: i > 0 ? "1px solid " + ADMIN_BORDER : "none" }}>
                        <span className="text-xl">{p.emoji}</span>
                        <div className="flex-1">
                          <span className="text-sm font-semibold" style={{ color: ADMIN_TEXT }}>{p.name}</span>
                          <span className="text-[11px] block" style={{ color: ADMIN_TEXT_SEC }}>{p.qty} vendus</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold" style={{ color: ACBA_BLUE }}>{p.revenue.toFixed(2).replace(".", ",") + " €"}</span>
                          <span className="text-[10px] block" style={{ color: "#059669" }}>+{(p.revenue - p.cost).toFixed(2).replace(".", ",")} € marge</span>
                        </div>
                      </div>
                    ));
                  })()}
                </AdminCard>

                <AdminCard delay={0.4}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: ADMIN_TEXT_SEC }}>Approvisionnements récents</h3>
                  {[
                    { date: "03/05", items: "24× Coca, 24× Orangina, 20× Perrier", total: 28.80, method: "Espèces" },
                    { date: "01/05", items: "20× Bière, 20× Snack, 20× Chips", total: 32.00, method: "Carte club" },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center gap-3 py-2" style={{ borderTop: i > 0 ? "1px solid " + ADMIN_BORDER : "none" }}>
                      <span className="text-[11px] font-bold px-2 py-1 rounded" style={{ background: "#F0F4FA", color: ADMIN_TEXT_SEC }}>{r.date}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm truncate block" style={{ color: ADMIN_TEXT }}>{r.items}</span>
                        <span className="text-[10px]" style={{ color: ADMIN_TEXT_SEC }}>{r.method}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: "#DC2626" }}>-{r.total.toFixed(2).replace(".", ",")} €</span>
                    </div>
                  ))}
                </AdminCard>
              </div>
            )}

            {/* ── MEMBERS ── */}
            {adminTab === "members" && (
              <div className="flex flex-col gap-3" style={{ animation: "fadeSlideUp 0.4s ease-out both" }}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">👤</span>
                  <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Rechercher un membre..."
                    className="w-full h-11 rounded-xl text-sm pl-9 pr-4 outline-none placeholder:text-slate-400"
                    style={{ background: ADMIN_CARD, border: "1px solid " + ADMIN_BORDER, color: ADMIN_TEXT }} />
                </div>

                {filteredMembers.map((m, i) => (
                  <AdminCard key={m.name} delay={i * 0.05}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold shrink-0" style={{ background: ACBA_BLUE + "10", color: ACBA_BLUE }}>
                        {m.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold block" style={{ color: ADMIN_TEXT }}>{m.name}</span>
                        <span className="text-[11px]" style={{ color: ADMIN_TEXT_SEC }}>{m.count} achat{m.count > 1 ? "s" : ""}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black block" style={{ color: ACBA_BLUE }}>{m.total.toFixed(2).replace(".", ",") + " €"}</span>
                        <span className="text-[10px]" style={{ color: ADMIN_TEXT_SEC }}>total dépensé</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2 pt-2" style={{ borderTop: "1px solid " + ADMIN_BORDER }}>
                      {Object.entries(m.items).map(([name, qty]) => (
                        <span key={name} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#F0F4FA", color: ADMIN_TEXT_SEC }}>
                          {name} ×{qty}
                        </span>
                      ))}
                    </div>
                  </AdminCard>
                ))}

                {filteredMembers.length === 0 && (
                  <div className="text-center py-12 text-sm" style={{ color: ADMIN_TEXT_SEC }}>Aucun membre trouvé</div>
                )}
              </div>
            )}

            {/* ── SETTINGS ── */}
            {adminTab === "settings" && (
              <div className="flex flex-col gap-3" style={{ animation: "fadeSlideUp 0.4s ease-out both" }}>
                <AdminCard delay={0}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: ADMIN_TEXT_SEC }}>Paramètres du bar</h3>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-[11px] font-semibold block mb-1" style={{ color: ADMIN_TEXT_SEC }}>Nom du club</label>
                      <input defaultValue="Aéro-Club du Bassin d'Arcachon" className="w-full h-11 rounded-xl text-sm px-4 outline-none" style={{ background: "#F0F4FA", border: "1px solid " + ADMIN_BORDER, color: ADMIN_TEXT }} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-1" style={{ color: ADMIN_TEXT_SEC }}>Code PIN admin</label>
                      <input type="password" defaultValue="1234" className="w-full h-11 rounded-xl text-sm px-4 outline-none" style={{ background: "#F0F4FA", border: "1px solid " + ADMIN_BORDER, color: ADMIN_TEXT }} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-1" style={{ color: ADMIN_TEXT_SEC }}>Code PIN bureau</label>
                      <input type="password" defaultValue="1215" className="w-full h-11 rounded-xl text-sm px-4 outline-none" style={{ background: "#F0F4FA", border: "1px solid " + ADMIN_BORDER, color: ADMIN_TEXT }} />
                    </div>
                  </div>
                </AdminCard>

                <AdminCard delay={0.1}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: ADMIN_TEXT_SEC }}>État du bar</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold block" style={{ color: ADMIN_TEXT }}>Bar {barOpen ? "ouvert" : "fermé"}</span>
                      <span className="text-[11px]" style={{ color: ADMIN_TEXT_SEC }}>Les clients {barOpen ? "peuvent" : "ne peuvent pas"} commander</span>
                    </div>
                    <button onClick={() => setBarOpen(!barOpen)}
                      className="w-14 h-8 rounded-full cursor-pointer transition-all relative"
                      style={{ background: barOpen ? "#22C55E" : "#E2E8F0" }}>
                      <div className="w-6 h-6 rounded-full bg-white shadow-md absolute top-1 transition-all"
                        style={{ left: barOpen ? "28px" : "4px" }} />
                    </button>
                  </div>
                </AdminCard>

                <AdminCard delay={0.2}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: ADMIN_TEXT_SEC }}>Données</h3>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid " + ADMIN_BORDER }}>
                      <span className="text-sm" style={{ color: ADMIN_TEXT }}>Produits</span>
                      <span className="text-sm font-bold" style={{ color: ACBA_BLUE }}>{products.length}</span>
                    </div>
                    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid " + ADMIN_BORDER }}>
                      <span className="text-sm" style={{ color: ADMIN_TEXT }}>Transactions</span>
                      <span className="text-sm font-bold" style={{ color: ACBA_BLUE }}>{transactions.length}</span>
                    </div>
                    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid " + ADMIN_BORDER }}>
                      <span className="text-sm" style={{ color: ADMIN_TEXT }}>Membres actifs</span>
                      <span className="text-sm font-bold" style={{ color: ACBA_BLUE }}>{memberStats.length}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm" style={{ color: ADMIN_TEXT }}>Cache offline</span>
                      <span className="text-sm font-bold" style={{ color: offlineReady ? "#059669" : "#DC2626" }}>{offlineReady ? "Actif" : "Inactif"}</span>
                    </div>
                  </div>
                </AdminCard>

                <button className="w-full py-3 rounded-2xl text-sm font-bold cursor-pointer active:scale-[0.98] transition-transform"
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}>
                  🗑 Réinitialiser les données (démo)
                </button>
              </div>
            )}
          </main>

          {/* Stock detail sheet (admin light) */}
          {selectedProduct && (
            <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSelectedProduct(null)}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm anim-fade-in" />
              <div className="relative w-full max-w-lg rounded-t-3xl max-h-[75vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
                style={{ background: "#FFFFFF", borderBottom: "none", animation: "sheetUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}>
                <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: "#CBD5E1" }} /></div>
                <div className="px-5 pb-24">
                  {/* Product header */}
                  <div className="flex items-center gap-4 mb-5">
                    <span className="text-5xl">{selectedProduct.emoji}</span>
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: ADMIN_TEXT }}>{selectedProduct.name}</h2>
                      <span className="text-sm font-semibold" style={{ color: ACBA_BLUE }}>{selectedProduct.price.toFixed(2).replace(".", ",") + " €"}</span>
                    </div>
                  </div>

                  {/* Stock visual */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { label: "Frigo", value: selectedProduct.frigo, icon: "❄️", color: "#3B82F6", bg: "#EFF6FF" },
                      { label: "Réserve", value: selectedProduct.reserve, icon: "📦", color: "#D97706", bg: "#FFFBEB" },
                    ].map((loc) => (
                      <div key={loc.label} className="p-4 rounded-2xl text-center" style={{ background: loc.bg, border: "1px solid " + ADMIN_BORDER }}>
                        <div className="text-2xl mb-1">{loc.icon}</div>
                        <div className="text-3xl font-black mb-1" style={{ color: loc.color }}>
                          <AnimatedNumber value={loc.value} />
                        </div>
                        <div className="text-xs font-semibold" style={{ color: ADMIN_TEXT_SEC }}>{loc.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Transfer: Reserve → Frigo */}
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: ADMIN_TEXT_SEC }}>Réserve → Frigo</h3>
                    <div className="flex gap-2">
                      {[1, 2, 3, 6].map((n) => (
                        <button key={n} onClick={() => { transferStock(selectedProduct.id, "toFrigo", n); setSelectedProduct((prev) => prev ? { ...prev, frigo: prev.frigo + Math.min(n, prev.reserve), reserve: prev.reserve - Math.min(n, prev.reserve) } : null); }}
                          className="flex-1 py-3 rounded-xl text-sm font-bold cursor-pointer active:scale-90 transition-all"
                          style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#2563EB" }}>
                          +{n}
                        </button>
                      ))}
                      <button onClick={() => { const qty = selectedProduct.reserve; transferStock(selectedProduct.id, "toFrigo", qty); setSelectedProduct((prev) => prev ? { ...prev, frigo: prev.frigo + qty, reserve: 0 } : null); }}
                        className="flex-1 py-3 rounded-xl text-sm font-bold cursor-pointer active:scale-90 transition-all"
                        style={{ background: "#DBEAFE", border: "1px solid #93C5FD", color: "#1D4ED8" }}>
                        Tout
                      </button>
                    </div>
                  </div>

                  {/* Transfer: Frigo → Reserve */}
                  <div className="mb-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: ADMIN_TEXT_SEC }}>Frigo → Réserve</h3>
                    <div className="flex gap-2">
                      {[1, 2, 3, 6].map((n) => (
                        <button key={n} onClick={() => { transferStock(selectedProduct.id, "toReserve", n); setSelectedProduct((prev) => prev ? { ...prev, reserve: prev.reserve + Math.min(n, prev.frigo), frigo: prev.frigo - Math.min(n, prev.frigo) } : null); }}
                          className="flex-1 py-3 rounded-xl text-sm font-bold cursor-pointer active:scale-90 transition-all"
                          style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#B45309" }}>
                          +{n}
                        </button>
                      ))}
                      <button onClick={() => { const qty = selectedProduct.frigo; transferStock(selectedProduct.id, "toReserve", qty); setSelectedProduct((prev) => prev ? { ...prev, reserve: prev.reserve + qty, frigo: 0 } : null); }}
                        className="flex-1 py-3 rounded-xl text-sm font-bold cursor-pointer active:scale-90 transition-all"
                        style={{ background: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E" }}>
                        Tout
                      </button>
                    </div>
                  </div>

                  {/* DLC */}
                  {selectedProduct.dlc && (
                    <div className="rounded-xl p-3" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                      <div className="flex items-center gap-2">
                        <span>📅</span>
                        <span className="text-sm font-semibold" style={{ color: ADMIN_TEXT }}>DLC : {selectedProduct.dlc}</span>
                        <span className="text-xs ml-auto" style={{ color: Math.ceil((new Date(selectedProduct.dlc).getTime() - Date.now()) / 86400000) <= 7 ? "#DC2626" : "#D97706" }}>
                          {(() => {
                            const d = Math.ceil((new Date(selectedProduct.dlc).getTime() - Date.now()) / 86400000);
                            return d <= 0 ? "Expiré !" : "Dans " + d + " jours";
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Monthly Recap Sheet */}
          {showRecap && (
            <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowRecap(false)}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm anim-fade-in" />
              <div className="relative w-full max-w-lg rounded-t-3xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
                style={{ background: "#FFFFFF", animation: "sheetUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}>
                <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full" style={{ background: "#CBD5E1" }} /></div>
                <div className="px-5 pb-24">
                  <h2 className="text-xl font-bold mb-1" style={{ color: ADMIN_TEXT }}>📈 Récap mensuel</h2>
                  <p className="text-xs mb-4" style={{ color: ADMIN_TEXT_SEC }}>Mai 2026</p>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="p-4 rounded-2xl text-center" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                      <div className="text-2xl mb-1">💰</div>
                      <div className="text-2xl font-black" style={{ color: "#059669" }}>
                        <AnimatedNumber value={monthlyRecap.ca} decimals={2} /> €
                      </div>
                      <div className="text-xs font-semibold" style={{ color: ADMIN_TEXT_SEC }}>CA total</div>
                    </div>
                    <div className="p-4 rounded-2xl text-center" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                      <div className="text-2xl mb-1">🧾</div>
                      <div className="text-2xl font-black" style={{ color: ACBA_BLUE }}>
                        <AnimatedNumber value={monthlyRecap.count} />
                      </div>
                      <div className="text-xs font-semibold" style={{ color: ADMIN_TEXT_SEC }}>Transactions</div>
                    </div>
                  </div>

                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: ADMIN_TEXT_SEC }}>Top produits</h3>
                  <div className="flex flex-col gap-1.5 mb-5">
                    {monthlyRecap.topProducts.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "#F8FAFC", border: "1px solid " + ADMIN_BORDER, animation: `fadeSlideUp 0.3s ease-out ${i * 0.06}s both` }}>
                        <span className="text-lg font-black w-6 text-center" style={{ color: i === 0 ? ACBA_YELLOW : i === 1 ? "#94A3B8" : "#CD7F32" }}>{i + 1}</span>
                        <span className="text-xl">{p.emoji}</span>
                        <div className="flex-1">
                          <span className="text-sm font-semibold" style={{ color: ADMIN_TEXT }}>{p.name}</span>
                          <span className="text-[11px] block" style={{ color: ADMIN_TEXT_SEC }}>{p.qty} vendus</span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: ACBA_BLUE }}>{p.revenue.toFixed(2).replace(".", ",") + " €"}</span>
                      </div>
                    ))}
                  </div>

                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: ADMIN_TEXT_SEC }}>Top consommateurs</h3>
                  <div className="flex flex-col gap-1.5">
                    {monthlyRecap.topConsumers.map((m, i) => (
                      <div key={m.name} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "#F8FAFC", border: "1px solid " + ADMIN_BORDER, animation: `fadeSlideUp 0.3s ease-out ${(i + 5) * 0.06}s both` }}>
                        <span className="text-lg font-black w-6 text-center" style={{ color: i === 0 ? ACBA_YELLOW : i === 1 ? "#94A3B8" : "#CD7F32" }}>{i + 1}</span>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: ACBA_BLUE + "10", color: ACBA_BLUE }}>{m.name.charAt(0)}</div>
                        <div className="flex-1">
                          <span className="text-sm font-semibold" style={{ color: ADMIN_TEXT }}>{m.name}</span>
                          <span className="text-[11px] block" style={{ color: ADMIN_TEXT_SEC }}>{m.count} achat{m.count > 1 ? "s" : ""}</span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: ACBA_BLUE }}>{m.total.toFixed(2).replace(".", ",") + " €"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════ BOTTOM NAV ═══════════════ */}
      <nav className="fixed bottom-0 inset-x-0 z-[60] border-t" style={{
        background: isAdmin ? "rgba(255,255,255,0.95)" : "rgba(4,12,36,0.95)",
        backdropFilter: "blur(16px)",
        borderColor: isAdmin ? ADMIN_BORDER : ACBA_BLUE + "20",
        transition: "background 0.4s",
      }}>
        <div className="max-w-4xl mx-auto flex">
          {([
            { id: "client" as const, label: "Bar", icon: "🍺" },
            { id: "admin" as const, label: "Admin", icon: "⚙️" },
          ]).map((tab) => (
            <button key={tab.id} onClick={() => setMode(tab.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 cursor-pointer transition-all active:scale-95"
              style={{ color: mode === tab.id ? (isAdmin ? ACBA_BLUE : ACBA_YELLOW) : (isAdmin ? ADMIN_TEXT_SEC : ACBA_BLUE_LIGHT + "40") }}>
              <span className="text-xl" style={{ transform: mode === tab.id ? "scale(1.15)" : "scale(1)", transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>{tab.icon}</span>
              <span className="text-[10px] font-bold">{tab.label}</span>
              {mode === tab.id && <div className="w-5 h-0.5 rounded-full mt-0.5" style={{ background: isAdmin ? ACBA_BLUE : ACBA_YELLOW }} />}
            </button>
          ))}
        </div>
      </nav>

      {/* ═══════════════ STYLES ═══════════════ */}
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 12px); }


        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
        @keyframes badgePop { 0% { transform: scale(1); } 40% { transform: scale(1.5); } 70% { transform: scale(0.9); } 100% { transform: scale(1); } }
        .anim-badge-pop { animation: badgePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes cartBounce { 0% { transform: translateY(0); } 30% { transform: translateY(-6px); } 50% { transform: translateY(0); } 70% { transform: translateY(-3px); } 100% { transform: translateY(0); } }
        .anim-cart-bounce { animation: cartBounce 0.4s ease-out; }
        @keyframes ripple { from { opacity: 1; transform: scale(0.5); } to { opacity: 0; transform: scale(2); } }
        .anim-ripple { animation: ripple 0.5s ease-out forwards; pointer-events: none; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .anim-float { animation: float 3s ease-in-out infinite; }
        @keyframes pulseDot { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.6); } 50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(34,197,94,0); } }
        .anim-pulse-dot { animation: pulseDot 2s ease-in-out infinite; }
        .anim-pill { transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .anim-pill:active { transform: scale(0.92); }
        .anim-pill-active { animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes stockFill { from { width: 0%; height: 0%; } }
        .anim-stock-fill { animation: stockFill 0.8s ease-out both; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .anim-blink { animation: blink 2s ease-in-out infinite; }
        .anim-blink-soft { animation: blink 3s ease-in-out infinite; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .anim-fade-in { animation: fadeIn 0.3s ease-out both; }
        @keyframes shine { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .anim-btn-shine { background-size: 200% auto; transition: transform 0.15s; }
        .anim-btn-shine:hover { animation: shine 1.5s linear infinite; }
        @keyframes shimmer { 0% { background-position: -100% 0; } 100% { background-position: 100% 0; } }
        .anim-shimmer { position: relative; overflow: hidden; }
        .anim-shimmer::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.06) 50%, transparent 100%); background-size: 200% 100%; animation: shimmer 3s ease-in-out infinite; pointer-events: none; }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 4px rgba(34,197,94,0.1); } 50% { box-shadow: 0 0 12px rgba(34,197,94,0.15); } }
        .anim-glow { animation: glow 3s ease-in-out infinite; }
        @keyframes confettiFall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        .confetti-piece { position: absolute; top: -10px; width: 8px; height: 8px; border-radius: 2px; animation: confettiFall 2.5s ease-out forwards; }
      `}</style>

      {/* Dev badge */}
      <div className="fixed top-2 left-2 z-50 px-2 py-1 rounded-full text-[9px] font-bold text-black uppercase tracking-wider"
        style={{ background: ACBA_YELLOW, animation: "popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both" }}>
        DEV — V2 ACBA
      </div>
    </div>
  );
}
