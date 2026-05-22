"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════
interface Product {
  id: string; name: string; emoji: string; price: number; cost: number; stock: number;
  stockReserve?: number; coffeeServings?: number; legacyStock?: number; legacyPrice?: number;
  archived?: boolean; category?: string; location?: "frigo" | "cafe" | "congelateur";
  coffeeAddon?: boolean; coffeeAddonQty?: number; coffeeAddonPrice?: number;
}
interface Transaction {
  id: string; items: string; total: number; totalCost: number;
  buyer: string; date: string; method: string; amountPaid?: number;
}
interface MemberAccount { name: string; balance: number; }
interface Category { id: string; label: string; emoji: string; hasCupCost?: boolean; }
interface HomepageConfig {
  featuredProductIds?: string[];
  showCombo?: boolean;
  infos?: { emoji: string; title: string; subtitle: string }[];
}
interface Settings {
  clubName: string; adminPin: string; bureauPin?: string;
  cupCost?: number; categories?: Category[];
  homepage?: HomepageConfig;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: "boissons", label: "Boissons", emoji: "🍺" },
  { id: "cafe", label: "Café", emoji: "☕", hasCupCost: true },
  { id: "nourriture", label: "Bouffe", emoji: "🍫" },
];

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
function formatPrice(p: number) { return p.toFixed(2).replace(".", ",") + " €"; }

async function saveToServer(key: string, value: unknown): Promise<boolean> {
  try { const r = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) }); return r.ok; }
  catch { return false; }
}

// ─── Sound ───
let audioCtx: AudioContext | null = null;
function getCtx() { if (!audioCtx && typeof window !== "undefined") audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); return audioCtx; }
function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.3) {
  const ctx = getCtx(); if (!ctx) return; if (ctx.state === "suspended") ctx.resume();
  const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur); o.start(ctx.currentTime); o.stop(ctx.currentTime + dur);
}
const Sound = {
  pop() { tone(800, 0.06, "sine", 0.12); setTimeout(() => tone(1200, 0.08, "sine", 0.15), 50); },
  addToCart() { tone(523, 0.1, "sine", 0.2); setTimeout(() => tone(784, 0.15, "sine", 0.25), 80); },
  success() { tone(523, 0.15, "sine", 0.25); setTimeout(() => tone(659, 0.15, "sine", 0.25), 120); setTimeout(() => tone(784, 0.25, "sine", 0.25), 240); setTimeout(() => tone(1047, 0.4, "sine", 0.3), 380); },
  error() { tone(200, 0.2, "square", 0.15); setTimeout(() => tone(150, 0.3, "square", 0.1), 150); },
};

// ─── Components ───
function ProductIcon({ emoji, size = "text-4xl" }: { emoji: string; size?: string }) {
  if (emoji.startsWith("http")) { const px = size === "text-6xl" ? "w-16 h-16" : size === "text-5xl" ? "w-12 h-12" : "w-10 h-10"; return <img src={emoji} alt="" className={px + " object-contain rounded-lg"} />; }
  return <span className={size}>{emoji}</span>;
}

// ═══════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════
export default function TestPage() {
  // ── Core state ──
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]); // includes addons
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [members, setMembers] = useState<MemberAccount[]>([]);
  const [settings, setSettings] = useState<Settings>({ clubName: "Aero-Club", adminPin: "1234" });
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [coffeeCredits, setCoffeeCredits] = useState<Record<string, number>>({});
  const [madeleineCredits, setMadeleineCredits] = useState<Record<string, number>>({});
  const [temperatures, setTemperatures] = useState<{ frigo: number | null; congelateur: number | null; lastUpdate: string | null }>({ frigo: null, congelateur: null, lastUpdate: null });
  const [loading, setLoading] = useState(true);

  // ── UI state ──
  const [view, setView] = useState<"sale" | "admin">("sale");
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroAnim, setHeroAnim] = useState("slideIn");
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [madeleineAdded, setMadeleineAdded] = useState(false);

  // ── Checkout state ──
  const [buyerName, setBuyerName] = useState("");
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showCashFlow, setShowCashFlow] = useState(false);
  const [cashAmountInput, setCashAmountInput] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "success">("idle");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [coffeeAvoirUsedInCheckout, setCoffeeAvoirUsedInCheckout] = useState(false);

  // ── Coffee/madeleine modal ──
  const [coffeeModal, setCoffeeModal] = useState<{
    buyer: string; totalServings: number; lockType: string; productId: string;
    step: "coffee" | "madeleine"; usedNow?: number; totalMadeleines?: number;
  } | null>(null);

  // ── Admin state ──
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [adminTab, setAdminTab] = useState<"homepage" | "products">("homepage");

  // ── Refs ──
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimeout = useRef<Record<string, NodeJS.Timeout>>({});
  const hasLoaded = useRef(false);
  const clearCartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ═══════════════════════════════════════════
  //  DATA LOADING
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    fetch("/api/data").then((r) => r.json()).then((d) => {
      const prods: Product[] = d.products || [];
      setAllProducts(prods);
      setProducts(prods.filter((p) => !p.archived && !p.coffeeAddon));
      setTransactions(d.transactions || []);
      setMembers(d.members || []);
      const s = d.settings || { clubName: "Aero-Club", adminPin: "1234" };
      setSettings(s);
      setCategories(s.categories || DEFAULT_CATEGORIES);
      setCoffeeCredits(d.coffeeCredits || {});
      setMadeleineCredits(d.madeleineCredits || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // ── Auto-save ──
  const debouncedSave = useCallback((key: string, value: unknown) => {
    if (saveTimeout.current[key]) clearTimeout(saveTimeout.current[key]);
    saveTimeout.current[key] = setTimeout(() => { saveToServer("aeroclub-" + key, value); }, 800);
  }, []);

  useEffect(() => { if (!loading && hasLoaded.current) debouncedSave("products", allProducts); }, [allProducts, loading, debouncedSave]);
  useEffect(() => { if (!loading && hasLoaded.current) debouncedSave("transactions", transactions); }, [transactions, loading, debouncedSave]);
  useEffect(() => { if (!loading && hasLoaded.current) debouncedSave("members", members); }, [members, loading, debouncedSave]);
  useEffect(() => { if (!loading && hasLoaded.current) debouncedSave("settings", settings); }, [settings, loading, debouncedSave]);
  useEffect(() => { if (!loading && hasLoaded.current) debouncedSave("coffee-credits", coffeeCredits); }, [coffeeCredits, loading, debouncedSave]);
  useEffect(() => { if (!loading && hasLoaded.current) debouncedSave("madeleine-credits", madeleineCredits); }, [madeleineCredits, loading, debouncedSave]);

  // ── Poll temperatures ──
  useEffect(() => {
    const fetchTemp = () => {
      fetch("/api/temperature").then((r) => r.json()).then((d) => {
        if (d && (d.frigo !== undefined || d.congelateur !== undefined)) setTemperatures(d);
      }).catch(() => {});
    };
    fetchTemp();
    const timer = setInterval(fetchTemp, 30000);
    return () => clearInterval(timer);
  }, []);

  // ═══════════════════════════════════════════
  //  COMPUTED
  // ═══════════════════════════════════════════
  const showToast = useCallback((msg: string, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }, []);

  const effectiveStock = (p: Product) => Math.floor(p.stock / (p.coffeeServings || 1));

  const getFifoTotal = (product: Product, qty: number): number => {
    const legacyQty = Math.min(product.legacyStock || 0, qty);
    const regularQty = qty - legacyQty;
    return legacyQty * (product.legacyPrice || product.price) + regularQty * product.price;
  };

  const normalizeNameFuzzy = (n: string) => n.trim().toLowerCase().split(/\s+/).sort().join(" ");

  const getNameSuggestions = (input: string): string[] => {
    if (!input.trim() || input.trim().length < 2) return [];
    const tokens = input.trim().toLowerCase().split(/\s+/);
    const allNames = [...members.map((m) => m.name), ...transactions.map((t) => t.buyer).filter(Boolean)];
    const seen = new Map<string, string>();
    for (const n of allNames) { const key = normalizeNameFuzzy(n); if (!seen.has(key)) seen.set(key, n); }
    return [...seen.values()].filter((n) => { const nt = n.toLowerCase().split(/\s+/); return tokens.every((t) => nt.some((x) => x.startsWith(t))); }).slice(0, 5);
  };

  const getMemberBalance = (name: string): number => {
    const key = normalizeNameFuzzy(name);
    const m = members.find((m) => normalizeNameFuzzy(m.name) === key);
    return m ? m.balance : 0;
  };

  const updateMemberBalance = (name: string, delta: number) => {
    const key = normalizeNameFuzzy(name);
    const canonical = members.find((m) => normalizeNameFuzzy(m.name) === key);
    const storeName = canonical ? canonical.name : name.trim();
    setMembers((prev) => {
      const existing = prev.find((m) => normalizeNameFuzzy(m.name) === key);
      if (existing) return prev.map((m) => normalizeNameFuzzy(m.name) === key ? { ...m, name: storeName, balance: Math.round((m.balance + delta) * 100) / 100 } : m);
      if (delta > 0) return [...prev, { name: storeName, balance: Math.round(delta * 100) / 100 }];
      return prev;
    });
  };

  const cartTotal = cart.reduce((s, i) => s + getFifoTotal(i.product, i.qty), 0);
  const cartTotalCost = cart.reduce((s, i) => {
    const cat = categories.find((c) => c.id === i.product.category);
    return s + ((i.product.cost || 0) + (cat?.hasCupCost ? (settings.cupCost || 0) : 0)) * i.qty;
  }, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // Madeleine addon
  const madeleineProduct = allProducts.find((p) => p.coffeeAddon && !p.archived && p.stock > 0);
  const coffeeUnitsInCart = cart.reduce((s, c) => c.product.coffeeServings && c.product.coffeeServings > 1 ? s + c.qty : s, 0);
  const madeleineOfferQty = madeleineProduct && coffeeUnitsInCart > 0 ? coffeeUnitsInCart * (madeleineProduct.coffeeAddonQty || 2) : 0;
  const madeleineOfferPrice = madeleineProduct && coffeeUnitsInCart > 0 ? coffeeUnitsInCart * (madeleineProduct.coffeeAddonPrice || 0.80) : 0;
  const madeleineOfferCost = madeleineProduct && coffeeUnitsInCart > 0 ? coffeeUnitsInCart * (madeleineProduct.cost || 0.40) * (madeleineProduct.coffeeAddonQty || 2) : 0;
  const checkoutTotal = cartTotal + (madeleineAdded ? madeleineOfferPrice : 0);
  const checkoutTotalCost = cartTotalCost + (madeleineAdded ? madeleineOfferCost : 0);

  useEffect(() => { if (coffeeUnitsInCart === 0) setMadeleineAdded(false); }, [coffeeUnitsInCart]);

  // ── Popular products ──
  const popularProducts = (() => {
    const counts: Record<string, number> = {};
    for (const tx of transactions.slice(0, 200)) {
      for (const part of tx.items.split(",").map((s) => s.trim())) {
        const m = part.match(/^(\d+)x\s+(.+)$/);
        if (m) counts[m[2].trim()] = (counts[m[2].trim()] || 0) + parseInt(m[1]);
      }
    }
    return products.map((p) => ({ ...p, salesCount: counts[p.name] || 0 })).filter((p) => p.salesCount > 0).sort((a, b) => b.salesCount - a.salesCount).slice(0, 12);
  })();

  // ── Homepage config ──
  const hpConfig = settings.homepage || {};
  const featuredIds = hpConfig.featuredProductIds || [];
  const heroProducts = featuredIds.length > 0
    ? featuredIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[]
    : (popularProducts.length >= 3 ? popularProducts.slice(0, 5) : products.slice(0, 5));

  const cafeProduct = products.find((p) =>
    (p.name.toLowerCase().includes("café") || p.name.toLowerCase().includes("cafe")) && p.coffeeServings && p.coffeeServings > 1
  ) || products.find((p) => p.name.toLowerCase().includes("café") || p.name.toLowerCase().includes("cafe"));
  const addonProduct = allProducts.find((p) => p.coffeeAddon && !p.archived);
  const showCombo = hpConfig.showCombo !== false;
  const combo = showCombo && cafeProduct && addonProduct ? { cafe: cafeProduct, addon: addonProduct, totalPrice: cafeProduct.price + (addonProduct.coffeeAddonPrice || 0.80) } : null;

  const defaultInfos = [
    { emoji: "☕", title: "Cafe", subtitle: "Tiroir a droite" },
    { emoji: "🧊", title: "Boissons", subtitle: "Dans le frigo" },
    { emoji: "🧁", title: "Madeleines", subtitle: "Dans le frigo" },
    { emoji: "💳", title: "Paiement", subtitle: "Especes ou carte" },
  ];
  const infos = hpConfig.infos || defaultInfos;

  // ── Hero carousel timer ──
  useEffect(() => {
    if (heroProducts.length <= 1) return;
    heroTimerRef.current = setInterval(() => {
      setHeroAnim("slideOut");
      setTimeout(() => { setHeroIndex((i) => (i + 1) % heroProducts.length); setHeroAnim("slideIn"); }, 400);
    }, 4000);
    return () => { if (heroTimerRef.current) clearInterval(heroTimerRef.current); };
  }, [heroProducts.length]);

  const filteredProducts = activeCategory ? products.filter((p) => p.category === activeCategory) : products;

  // ═══════════════════════════════════════════
  //  CART & CHECKOUT
  // ═══════════════════════════════════════════
  const addToCart = (p: Product) => {
    if (effectiveStock(p) <= 0) return;
    Sound.addToCart();
    setAddedProductId(p.id); setTimeout(() => setAddedProductId(null), 600);
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === p.id);
      if (ex) { if (ex.qty >= effectiveStock(p)) return prev; return prev.map((c) => c.product.id === p.id ? { ...c, qty: c.qty + 1 } : c); }
      return [...prev, { product: p, qty: 1 }];
    });
  };

  const clearCart = () => { setCart([]); setPaymentStatus("idle"); setCoffeeAvoirUsedInCheckout(false); setMadeleineAdded(false); };

  const confirmPayment = (method: string, amountPaid?: number) => {
    if (!buyerName.trim() || cart.length === 0) return;
    const buyerKey = normalizeNameFuzzy(buyerName.trim());
    const canonicalMember = members.find((m) => normalizeNameFuzzy(m.name) === buyerKey);
    const canonicalBuyer = canonicalMember ? canonicalMember.name : buyerName.trim();

    // Déduire stock
    const cartSnapshot = [...cart];
    setAllProducts((prev) => {
      let updated = prev;
      for (const item of cartSnapshot) {
        updated = updated.map((p) => {
          if (p.id !== item.product.id) return p;
          if (item.product.coffeeServings && item.product.coffeeServings > 1) return p; // géré dans handleCoffeeChoice
          return { ...p, stock: Math.max(0, p.stock - item.qty) };
        });
      }
      return updated;
    });
    setProducts((prev) => {
      let updated = prev;
      for (const item of cartSnapshot) {
        updated = updated.map((p) => {
          if (p.id !== item.product.id) return p;
          if (item.product.coffeeServings && item.product.coffeeServings > 1) return p;
          return { ...p, stock: Math.max(0, p.stock - item.qty) };
        });
      }
      return updated;
    });

    // Balance membre
    if (method === "avoir") updateMemberBalance(canonicalBuyer, -checkoutTotal);
    else if (method === "especes" && amountPaid !== undefined) {
      const change = amountPaid - checkoutTotal;
      if (change > 0) updateMemberBalance(canonicalBuyer, change);
    }

    // Serrures
    const locationsNeeded = new Set<string>();
    for (const c of cart) locationsNeeded.add(c.product.location || "frigo");
    if (madeleineAdded && madeleineProduct?.location) locationsNeeded.add(madeleineProduct.location);
    const lockType = [...locationsNeeded].join(",");

    // Café multi-portions → modal
    const totalCoffeeServings = cart.reduce((s, c) => s + ((c.product.coffeeServings && c.product.coffeeServings > 1) ? c.qty * c.product.coffeeServings : 0), 0);
    if (totalCoffeeServings > 0) {
      const coffeeCartItem = cart.find((c) => c.product.coffeeServings && c.product.coffeeServings > 1);
      setCoffeeModal({ buyer: canonicalBuyer, totalServings: totalCoffeeServings, lockType, productId: coffeeCartItem?.product.id || "", step: "coffee", totalMadeleines: madeleineAdded ? madeleineOfferQty : 0 });
    } else {
      fetch("/api/fridge?action=trigger&lock=" + lockType).catch(() => {});
    }

    // Transaction
    const txItemParts = cart.map((c) => c.qty + "x " + c.product.name);
    if (madeleineAdded && madeleineProduct) txItemParts.push(madeleineOfferQty + "x " + madeleineProduct.name);
    const tx: Transaction = { id: Date.now().toString(36), items: txItemParts.join(", "), total: checkoutTotal, totalCost: checkoutTotalCost, buyer: canonicalBuyer, date: new Date().toISOString(), method, amountPaid };
    setTransactions((prev) => [tx, ...prev]);

    setPaymentStatus("success");
    setCartOpen(false);
    Sound.success();
    showToast("Merci " + canonicalBuyer.split(" ")[0] + " !");

    if (clearCartTimeoutRef.current) clearTimeout(clearCartTimeoutRef.current);
    clearCartTimeoutRef.current = setTimeout(() => { clearCartTimeoutRef.current = null; clearCart(); setBuyerName(""); setShowCashFlow(false); setCashAmountInput(""); }, 15000);
  };

  // ── Coffee choice ──
  const handleCoffeeChoice = (usedNow: number) => {
    if (!coffeeModal) return;
    const remaining = coffeeModal.totalServings - usedNow;
    if (remaining > 0) {
      setCoffeeCredits((prev) => ({ ...prev, [coffeeModal.buyer]: (prev[coffeeModal.buyer] || 0) + remaining }));
      showToast(coffeeModal.buyer.split(" ")[0] + " a " + ((coffeeCredits[coffeeModal.buyer] || 0) + remaining) + " avoir(s) cafe ☕");
    }
    // Déduire capsules
    if (coffeeModal.productId) {
      const updateStock = (prev: Product[]) => prev.map((p) => p.id !== coffeeModal.productId ? p : { ...p, stock: Math.max(0, p.stock - usedNow) });
      setProducts(updateStock);
      setAllProducts(updateStock);
    }
    if (madeleineAdded && (coffeeModal.totalMadeleines || 0) > 0) {
      setCoffeeModal({ ...coffeeModal, step: "madeleine", usedNow });
    } else {
      fetch("/api/fridge?action=trigger&lock=" + coffeeModal.lockType).catch(() => {});
      setCoffeeModal(null);
    }
  };

  // ── Madeleine choice ──
  const handleMadeleineChoice = (takeNow: number) => {
    if (!coffeeModal) return;
    const addonProd = allProducts.find((p) => p.coffeeAddon && !p.archived);
    const totalAddon = coffeeModal.totalMadeleines || (addonProd?.coffeeAddonQty || 2);
    const saveLater = totalAddon - takeNow;
    if (addonProd && takeNow > 0) {
      const updateStock = (prev: Product[]) => prev.map((p) => p.id === addonProd.id ? { ...p, stock: Math.max(0, p.stock - takeNow) } : p);
      setProducts(updateStock);
      setAllProducts(updateStock);
    }
    if (saveLater > 0) setMadeleineCredits((prev) => ({ ...prev, [coffeeModal.buyer]: (prev[coffeeModal.buyer] || 0) + saveLater }));
    showToast(takeNow > 0 && saveLater > 0 ? (addonProd?.emoji || "🧁") + " " + takeNow + " maintenant, " + saveLater + " en avoir !" : takeNow > 0 ? (addonProd?.emoji || "🧁") + " " + takeNow + " madeleine" + (takeNow > 1 ? "s" : "") + " !" : (addonProd?.emoji || "🧁") + " " + saveLater + " en avoir !");
    fetch("/api/fridge?action=trigger&lock=" + coffeeModal.lockType).catch(() => {});
    setCoffeeModal(null);
  };

  // ── Stock badge ──
  const stockBadge = (p: Product) => {
    const s = effectiveStock(p);
    if (s === 0) return <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">{"Epuise"}</span>;
    if (s <= 3) return <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-pulse">{"x" + s}</span>;
    return null;
  };

  // ═══════════════════════════════════════════
  //  ADMIN — Homepage config
  // ═══════════════════════════════════════════
  const updateHomepage = (patch: Partial<HomepageConfig>) => {
    setSettings((prev) => ({ ...prev, homepage: { ...(prev.homepage || {}), ...patch } }));
  };

  const toggleFeatured = (id: string) => {
    const cur = [...(hpConfig.featuredProductIds || [])];
    const idx = cur.indexOf(id);
    if (idx >= 0) cur.splice(idx, 1); else cur.push(id);
    updateHomepage({ featuredProductIds: cur });
  };

  const updateInfo = (index: number, field: "emoji" | "title" | "subtitle", value: string) => {
    const cur = [...infos];
    cur[index] = { ...cur[index], [field]: value };
    updateHomepage({ infos: cur });
  };

  const addInfo = () => {
    updateHomepage({ infos: [...infos, { emoji: "📌", title: "Titre", subtitle: "Description" }] });
  };

  const removeInfo = (index: number) => {
    const cur = [...infos];
    cur.splice(index, 1);
    updateHomepage({ infos: cur });
  };

  // ═══════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════
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

  const currentHero = heroProducts[heroIndex % heroProducts.length];

  // ── Admin PIN screen ──
  if (view === "admin" && pinInput !== settings.adminPin && !pinError) {
    // Actually handled inline below
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white overflow-x-hidden">
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(80px) scale(0.9); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes slideOut { from { opacity: 1; transform: translateX(0) scale(1); } to { opacity: 0; transform: translateX(-80px) scale(0.9); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes cartBounce { 0% { transform: scale(1); } 30% { transform: scale(1.3); } 60% { transform: scale(0.9); } 100% { transform: scale(1); } }
        @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes comboSlide { from { opacity: 0; transform: translateX(-40px) rotate(-5deg); } to { opacity: 1; transform: translateX(0) rotate(0deg); } }
        @keyframes comboPop { 0% { opacity: 0; transform: scale(0) rotate(10deg); } 60% { transform: scale(1.15) rotate(-3deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.2); } 50% { box-shadow: 0 0 40px rgba(245, 158, 11, 0.4); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes tagFloat { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-6px) rotate(2deg); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .slide-in { animation: slideIn 0.5s cubic-bezier(.22,1,.36,1) forwards; }
        .slide-out { animation: slideOut 0.4s cubic-bezier(.22,1,.36,1) forwards; }
        .fade-up { animation: fadeUp 0.6s cubic-bezier(.22,1,.36,1) forwards; }
        .float-anim { animation: float 3s ease-in-out infinite; }
        .pop-in { animation: popIn 0.4s cubic-bezier(.22,1,.36,1) forwards; }
        .cart-bounce { animation: cartBounce 0.4s cubic-bezier(.22,1,.36,1); }
        .gradient-bg { background: linear-gradient(-45deg, #1e1b4b, #0f172a, #1a1a2e, #0d1117); background-size: 300% 300%; animation: gradient 8s ease infinite; }
        .shimmer-text { background: linear-gradient(90deg, #f59e0b 25%, #fbbf24 50%, #f59e0b 75%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 3s linear infinite; }
      `}</style>

      {/* ═══════ HEADER ═══════ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0f1e]/80 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between">
          <button onClick={() => { setView("sale"); setShowAllProducts(false); }} className="flex items-center gap-3 cursor-pointer">
            <span className="text-3xl">{"✈️"}</span>
            <div>
              <h1 className="text-base font-black tracking-tight shimmer-text">{settings.clubName.toUpperCase() + " BAR"}</h1>
              <p className="text-[11px] text-slate-500 font-medium tracking-wider">{"BASSIN D'ARCACHON"}</p>
            </div>
          </button>
          {/* Temperatures */}
          <div className="flex items-center gap-3">
            <span className={"text-[11px] font-bold " + (temperatures.frigo === null ? "text-slate-600" : temperatures.frigo > 8 ? "text-red-400" : temperatures.frigo > 5 ? "text-amber-400" : "text-emerald-400")}>
              {"🧊 " + (temperatures.frigo !== null ? temperatures.frigo.toFixed(1) + "°" : "--")}
            </span>
            <span className={"text-[11px] font-bold " + (temperatures.congelateur === null ? "text-slate-600" : temperatures.congelateur > -15 ? "text-red-400" : temperatures.congelateur > -18 ? "text-amber-400" : "text-emerald-400")}>
              {"❄️ " + (temperatures.congelateur !== null ? temperatures.congelateur.toFixed(1) + "°" : "--")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Admin button */}
            <button onClick={() => { if (view === "admin") { setView("sale"); } else { setView("admin"); setPinInput(""); } Sound.pop(); }}
              className={"p-2.5 rounded-xl transition-all active:scale-90 cursor-pointer " + (view === "admin" ? "bg-amber-500/20 text-amber-400" : "bg-white/5 hover:bg-white/10 text-slate-400")}
            >
              <span className="text-xl">{"⚙️"}</span>
            </button>
            {/* Cart */}
            {view === "sale" && (
              <button onClick={() => { setCartOpen(!cartOpen); Sound.pop(); }} className="relative p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-90 cursor-pointer">
                <span className="text-xl">{"🛒"}</span>
                {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center cart-bounce shadow-lg">{cartCount}</span>}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ═══════ TOAST ═══════ */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm shadow-2xl" style={{ animation: "fadeUp 0.3s ease" }}>
          {toast.msg}
        </div>
      )}

      {/* ═══════════════════════════════════════════
           SALE VIEW
         ═══════════════════════════════════════════ */}
      {view === "sale" && (
        <main className={"max-w-4xl mx-auto px-5 " + (showAllProducts ? "pb-6" : "pb-32")}>

          {/* ── HERO CAROUSEL ── */}
          {currentHero && !showAllProducts && (
            <section className="mt-5 mb-6">
              <div className="relative overflow-hidden rounded-3xl gradient-bg p-8 min-h-[220px] flex items-center" style={{ animation: "pulse-glow 3s ease-in-out infinite" }}>
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl" />
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl" />
                </div>
                <div className={`relative flex items-center gap-8 w-full ${heroAnim === "slideIn" ? "slide-in" : "slide-out"}`}>
                  <div className="flex-shrink-0 float-anim">
                    <div className="w-28 h-28 rounded-3xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-2xl border border-white/10">
                      <ProductIcon emoji={currentHero.emoji} size="text-6xl" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-500/80">{"A la une"}</span>
                      <span className="w-8 h-px bg-amber-500/30" />
                    </div>
                    <h2 className="text-3xl font-black text-white leading-tight truncate">{currentHero.name}</h2>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-3xl font-black text-amber-400">{formatPrice(currentHero.price)}</span>
                      <button onClick={() => { if (effectiveStock(currentHero) > 0) addToCart(currentHero); }} disabled={effectiveStock(currentHero) === 0}
                        className={"px-6 py-2.5 rounded-full text-sm font-bold transition-all active:scale-90 " + (effectiveStock(currentHero) > 0 ? "bg-amber-500 text-black hover:bg-amber-400 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)]" : "bg-slate-700 text-slate-500 cursor-not-allowed")}
                      >{effectiveStock(currentHero) > 0 ? "Ajouter +" : "Epuise"}</button>
                    </div>
                  </div>
                </div>
                {heroProducts.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {heroProducts.map((_, i) => (
                      <button key={i} onClick={() => { setHeroAnim("slideOut"); setTimeout(() => { setHeroIndex(i); setHeroAnim("slideIn"); }, 300); }}
                        className={"w-1.5 h-1.5 rounded-full transition-all cursor-pointer " + (i === heroIndex % heroProducts.length ? "bg-amber-500 w-4" : "bg-white/20 hover:bg-white/40")} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── COMBO ── */}
          {combo && !showAllProducts && (
            <section className="mb-6 fade-up" style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
              <div className="relative overflow-hidden rounded-3xl border border-pink-800/30 bg-gradient-to-br from-[#1a0d1e] via-[#151025] to-[#0d1520] p-6">
                <div className="absolute top-4 right-5 text-sm" style={{ animation: "tagFloat 2s ease-in-out infinite" }}>{"✨"}</div>
                <div className="absolute bottom-5 right-10 text-sm" style={{ animation: "tagFloat 2.5s ease-in-out infinite 0.5s" }}>{"✨"}</div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-pink-400">{"Offre Combo"}</span>
                  <span className="flex-1 h-px bg-pink-800/30" />
                  <span className="text-xs font-bold text-pink-300 bg-pink-500/15 px-3 py-1 rounded-full">{"Nouveau"}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div style={{ animation: "comboSlide 0.6s cubic-bezier(.22,1,.36,1) 0.3s both" }}>
                    <div className="w-20 h-20 rounded-2xl bg-amber-900/30 border border-amber-700/30 flex items-center justify-center"><ProductIcon emoji={combo.cafe.emoji} size="text-5xl" /></div>
                  </div>
                  <span className="text-3xl font-black text-pink-400" style={{ animation: "comboPop 0.5s cubic-bezier(.22,1,.36,1) 0.5s both" }}>{"+"}</span>
                  <div style={{ animation: "comboSlide 0.6s cubic-bezier(.22,1,.36,1) 0.6s both" }}>
                    <div className="w-20 h-20 rounded-2xl bg-pink-900/30 border border-pink-700/30 flex items-center justify-center"><ProductIcon emoji={combo.addon.emoji} size="text-5xl" /></div>
                  </div>
                  <div className="flex-1 min-w-0 ml-2">
                    <p className="text-lg font-bold text-white">{combo.cafe.name}<span className="text-pink-300">{" + " + (combo.addon.coffeeAddonQty || 2) + " " + combo.addon.name + "s"}</span></p>
                    <span className="text-2xl font-black text-amber-400">{formatPrice(combo.totalPrice)}</span>
                  </div>
                </div>
                <button onClick={() => { if (effectiveStock(combo.cafe) > 0) addToCart(combo.cafe); }} disabled={effectiveStock(combo.cafe) === 0}
                  className={"w-full mt-5 py-4 rounded-2xl font-bold text-base transition-all active:scale-95 " + (effectiveStock(combo.cafe) > 0 ? "bg-gradient-to-r from-amber-600 to-pink-600 text-white cursor-pointer shadow-[0_0_25px_rgba(219,39,119,0.2)]" : "bg-slate-800 text-slate-600 cursor-not-allowed")}
                >{effectiveStock(combo.cafe) > 0 ? "☕ Commander le combo" : "Epuise"}</button>
              </div>
            </section>
          )}

          {/* ── TOP VENTES ── */}
          {popularProducts.length > 0 && !showAllProducts && (
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-3"><span className="text-base font-black text-white">{"🔥 Top ventes"}</span><span className="flex-1 h-px bg-white/5" /></div>
              <div className="grid grid-cols-6 gap-3">
                {popularProducts.slice(0, 12).map((p, i) => (
                  <button key={p.id} onClick={() => { if (effectiveStock(p) > 0) addToCart(p); }} disabled={effectiveStock(p) === 0}
                    className={"relative flex flex-col items-center gap-2 p-3.5 rounded-2xl border transition-all active:scale-90 cursor-pointer fade-up " + (addedProductId === p.id ? "bg-amber-500/20 border-amber-500/50 scale-95" : effectiveStock(p) === 0 ? "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed" : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-amber-500/20")}
                    style={{ animationDelay: (0.04 * i) + "s", animationFillMode: "both" }}
                  >
                    {stockBadge(p)}
                    <div className={addedProductId === p.id ? "pop-in" : ""}><ProductIcon emoji={p.emoji} size="text-4xl" /></div>
                    <span className="text-xs font-bold text-white/90 text-center leading-tight line-clamp-2">{p.name}</span>
                    <span className="text-sm font-black text-amber-400">{formatPrice(p.price)}</span>
                    <span className="text-[10px] text-slate-500 font-medium">{p.salesCount + " vendu" + (p.salesCount > 1 ? "s" : "")}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── TOUS LES PRODUITS ── */}
          {!showAllProducts ? (
            <button onClick={() => { setShowAllProducts(true); Sound.pop(); }}
              className="w-full py-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white font-bold text-base transition-all active:scale-95 cursor-pointer mb-6 flex items-center justify-center gap-3"
            ><span>{"📦 Voir tous les produits"}</span><span className="text-slate-500 text-xs font-medium">{"(" + products.length + ")"}</span><span className="text-amber-500">{"→"}</span></button>
          ) : (
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                <button onClick={() => { setActiveCategory(null); Sound.pop(); }} className={"flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-90 cursor-pointer " + (!activeCategory ? "bg-amber-500 text-black" : "bg-white/5 text-slate-400 hover:bg-white/10")}>{"Tout"}</button>
                {categories.map((cat) => (
                  <button key={cat.id} onClick={() => { setActiveCategory(activeCategory === cat.id ? null : cat.id); Sound.pop(); }}
                    className={"flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-90 cursor-pointer whitespace-nowrap " + (activeCategory === cat.id ? "bg-amber-500 text-black" : "bg-white/5 text-slate-400 hover:bg-white/10")}
                  >{cat.emoji + " " + cat.label}</button>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => { setShowAllProducts(false); setActiveCategory(null); Sound.pop(); }} className="text-xs text-slate-500 hover:text-amber-500 transition cursor-pointer">{"← Retour"}</button>
                <span className="flex-1 h-px bg-white/5" />
                <span className="text-[11px] text-slate-600 font-medium">{filteredProducts.length + " produit" + (filteredProducts.length > 1 ? "s" : "")}</span>
              </div>
              <div className="grid grid-cols-6 gap-3">
                {filteredProducts.map((p, i) => (
                  <button key={p.id} onClick={() => { if (effectiveStock(p) > 0) addToCart(p); }} disabled={effectiveStock(p) === 0}
                    className={"relative flex flex-col items-center gap-2 p-3.5 rounded-2xl border transition-all active:scale-90 cursor-pointer fade-up " + (addedProductId === p.id ? "bg-amber-500/20 border-amber-500/50" : effectiveStock(p) === 0 ? "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed" : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-amber-500/20")}
                    style={{ animationDelay: (0.03 * i) + "s", animationFillMode: "both" }}
                  >
                    {stockBadge(p)}
                    <div className={addedProductId === p.id ? "pop-in" : ""}><ProductIcon emoji={p.emoji} size="text-4xl" /></div>
                    <span className="text-xs font-bold text-white/90 text-center leading-tight line-clamp-2">{p.name}</span>
                    <span className="text-sm font-black text-amber-400">{formatPrice(p.price)}</span>
                    {effectiveStock(p) <= 5 && effectiveStock(p) > 0 && <span className="text-[10px] text-amber-500/60">{"Plus que " + effectiveStock(p)}</span>}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── INFOS ── */}
          {!showAllProducts && (
            <section className="mb-8 fade-up" style={{ animationDelay: "0.4s", animationFillMode: "both" }}>
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 mb-4"><span className="text-lg">{"ℹ️"}</span><span className="text-sm font-bold text-slate-400 uppercase tracking-wider">{"Infos pratiques"}</span></div>
                <div className={"grid gap-4 text-sm " + (infos.length <= 4 ? "grid-cols-4" : "grid-cols-" + Math.min(infos.length, 6))}>
                  {infos.map((info, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-base">{info.emoji}</span>
                      <div><p className="font-bold text-white/80">{info.title}</p><p className="text-slate-500">{info.subtitle}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>
      )}

      {/* ═══════════════════════════════════════════
           ADMIN VIEW
         ═══════════════════════════════════════════ */}
      {view === "admin" && (
        <main className="max-w-4xl mx-auto px-5 py-6">
          {/* PIN check */}
          {pinInput !== settings.adminPin ? (
            <div className="flex flex-col items-center gap-4 mt-20">
              <span className="text-5xl">{"🔒"}</span>
              <h2 className="text-xl font-black text-white">{"Espace Admin"}</h2>
              <div className="flex gap-2">
                {[1,2,3,4,5,6,7,8,9,0].map((n) => (
                  <button key={n} onClick={() => { const next = pinInput + n; setPinInput(next); if (next.length >= 4 && next !== settings.adminPin) { setPinError(true); setTimeout(() => { setPinError(false); setPinInput(""); }, 800); } }}
                    className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-lg active:scale-90 cursor-pointer transition">{n}</button>
                ))}
              </div>
              <div className="flex gap-1.5 mt-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className={"w-3 h-3 rounded-full transition-all " + (pinError ? "bg-red-500" : i < pinInput.length ? "bg-amber-500" : "bg-white/10")} />
                ))}
              </div>
              {pinError && <p className="text-red-400 text-sm font-bold">{"Code incorrect"}</p>}
            </div>
          ) : (
            <div>
              {/* Temperatures */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className={"rounded-2xl p-4 text-center border " + (temperatures.frigo !== null && temperatures.frigo > 8 ? "bg-red-950/50 border-red-800/50" : "bg-white/[0.03] border-white/5")}>
                  <span className={"block text-2xl font-black " + (temperatures.frigo === null ? "text-slate-600" : temperatures.frigo > 8 ? "text-red-400" : temperatures.frigo > 5 ? "text-amber-400" : "text-emerald-400")}>
                    {temperatures.frigo !== null ? "🧊 " + temperatures.frigo.toFixed(1) + "°C" : "🧊 --"}
                  </span>
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{"Frigo"}</span>
                  {temperatures.frigo !== null && temperatures.frigo > 8 && <p className="text-[10px] text-red-400 font-bold mt-1">{"⚠ Temperature trop haute !"}</p>}
                </div>
                <div className={"rounded-2xl p-4 text-center border " + (temperatures.congelateur !== null && temperatures.congelateur > -15 ? "bg-red-950/50 border-red-800/50" : "bg-white/[0.03] border-white/5")}>
                  <span className={"block text-2xl font-black " + (temperatures.congelateur === null ? "text-slate-600" : temperatures.congelateur > -15 ? "text-red-400" : temperatures.congelateur > -18 ? "text-amber-400" : "text-emerald-400")}>
                    {temperatures.congelateur !== null ? "❄️ " + temperatures.congelateur.toFixed(1) + "°C" : "❄️ --"}
                  </span>
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{"Congelateur"}</span>
                  {temperatures.congelateur !== null && temperatures.congelateur > -15 && <p className="text-[10px] text-red-400 font-bold mt-1">{"⚠ Temperature trop haute !"}</p>}
                </div>
                {temperatures.lastUpdate && (
                  <p className="col-span-2 text-[10px] text-slate-600 text-center -mt-1">
                    {"Derniere mise a jour : " + new Date(temperatures.lastUpdate).toLocaleTimeString("fr-FR")}
                  </p>
                )}
              </div>

              {/* Admin tabs */}
              <div className="flex gap-2 mb-6">
                {[{ id: "homepage" as const, label: "🏠 Page d'accueil" }, { id: "products" as const, label: "📦 Produits" }].map((tab) => (
                  <button key={tab.id} onClick={() => setAdminTab(tab.id)}
                    className={"px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 cursor-pointer " + (adminTab === tab.id ? "bg-amber-500 text-black" : "bg-white/5 text-slate-400 hover:bg-white/10")}
                  >{tab.label}</button>
                ))}
              </div>

              {/* ── Homepage config ── */}
              {adminTab === "homepage" && (
                <div className="flex flex-col gap-6">
                  {/* Featured products */}
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                    <h3 className="text-base font-black text-white mb-1">{"⭐ Produits a la une"}</h3>
                    <p className="text-xs text-slate-500 mb-4">{"Selectionnez les produits qui defilent dans le carousel. Si aucun, les plus vendus sont affiches automatiquement."}</p>
                    <div className="grid grid-cols-6 gap-2">
                      {products.map((p) => {
                        const isFeatured = featuredIds.includes(p.id);
                        return (
                          <button key={p.id} onClick={() => toggleFeatured(p.id)}
                            className={"flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all active:scale-90 cursor-pointer " + (isFeatured ? "bg-amber-500/20 border-amber-500/50" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]")}
                          >
                            <ProductIcon emoji={p.emoji} size="text-2xl" />
                            <span className="text-[10px] font-bold text-white/80 text-center leading-tight line-clamp-1">{p.name}</span>
                            {isFeatured && <span className="text-[9px] text-amber-400 font-bold">{"★ A la une"}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {featuredIds.length > 0 && (
                      <button onClick={() => updateHomepage({ featuredProductIds: [] })} className="mt-3 text-xs text-slate-500 hover:text-amber-400 cursor-pointer transition">{"Reinitialiser (mode automatique)"}</button>
                    )}
                  </div>

                  {/* Combo toggle */}
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-black text-white">{"☕ Combo Cafe + Madeleine"}</h3>
                        <p className="text-xs text-slate-500 mt-1">{"Afficher le bloc combo sur la page d'accueil"}</p>
                      </div>
                      <button onClick={() => updateHomepage({ showCombo: !showCombo })}
                        className={"w-14 h-8 rounded-full transition-all cursor-pointer relative " + (showCombo ? "bg-emerald-500" : "bg-slate-700")}
                      >
                        <div className={"w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow " + (showCombo ? "right-1" : "left-1")} />
                      </button>
                    </div>
                  </div>

                  {/* Infos pratiques */}
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                    <h3 className="text-base font-black text-white mb-1">{"ℹ️ Infos pratiques"}</h3>
                    <p className="text-xs text-slate-500 mb-4">{"Modifiez les informations affichees en bas de la page d'accueil"}</p>
                    <div className="flex flex-col gap-3">
                      {infos.map((info, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                          <input value={info.emoji} onChange={(e) => updateInfo(i, "emoji", e.target.value)}
                            className="w-12 h-10 rounded-lg bg-[#0a0f1e] border border-white/10 text-center text-lg outline-none" />
                          <input value={info.title} onChange={(e) => updateInfo(i, "title", e.target.value)}
                            className="flex-1 h-10 rounded-lg bg-[#0a0f1e] border border-white/10 px-3 text-sm font-bold text-white outline-none" />
                          <input value={info.subtitle} onChange={(e) => updateInfo(i, "subtitle", e.target.value)}
                            className="flex-1 h-10 rounded-lg bg-[#0a0f1e] border border-white/10 px-3 text-sm text-slate-300 outline-none" />
                          <button onClick={() => removeInfo(i)} className="text-red-400 hover:text-red-300 text-lg cursor-pointer active:scale-90">{"✕"}</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={addInfo} className="mt-3 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-slate-400 font-bold cursor-pointer transition active:scale-95">{"+ Ajouter une info"}</button>
                  </div>
                </div>
              )}

              {/* ── Products management ── */}
              {adminTab === "products" && (
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                  <h3 className="text-base font-black text-white mb-4">{"📦 Gestion des produits"}</h3>
                  <div className="flex flex-col gap-2">
                    {allProducts.filter((p) => !p.archived).map((p) => (
                      <div key={p.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3">
                        <ProductIcon emoji={p.emoji} size="text-2xl" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{p.name}{p.coffeeAddon && <span className="text-pink-400 text-[10px] ml-2">{"(addon cafe)"}</span>}</p>
                          <p className="text-xs text-slate-500">{formatPrice(p.price) + " • cout: " + formatPrice(p.cost)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => {
                            const updateFn = (prev: Product[]) => prev.map((x) => x.id === p.id ? { ...x, stock: Math.max(0, x.stock - 1) } : x);
                            setAllProducts(updateFn); setProducts(updateFn);
                          }} className="w-8 h-8 rounded-lg bg-white/5 text-white font-bold flex items-center justify-center active:scale-90 cursor-pointer hover:bg-white/10">{"-"}</button>
                          <span className={"text-sm font-black min-w-[30px] text-center " + (effectiveStock(p) <= 3 ? "text-red-400" : "text-white")}>{effectiveStock(p)}</span>
                          <button onClick={() => {
                            const updateFn = (prev: Product[]) => prev.map((x) => x.id === p.id ? { ...x, stock: x.stock + 1 } : x);
                            setAllProducts(updateFn); setProducts(updateFn);
                          }} className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center active:scale-90 cursor-pointer hover:bg-amber-500/30">{"+"}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 mt-4 text-center">{"Pour ajouter/modifier/supprimer des produits, utilisez l'admin principal"}</p>
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* ═══════════════════════════════════════════
           CART BOTTOM SHEET
         ═══════════════════════════════════════════ */}
      {view === "sale" && cartCount > 0 && (
        <>
          {!cartOpen && paymentStatus !== "success" && (
            <div className="fixed bottom-0 left-0 right-0 z-40">
              <div className="max-w-4xl mx-auto px-5 pb-4">
                <button onClick={() => { setCartOpen(true); Sound.pop(); }}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-amber-500 text-black font-bold shadow-[0_-4px_30px_rgba(245,158,11,0.3)] active:scale-95 transition-all cursor-pointer"
                  style={{ animation: "slideUp 0.4s cubic-bezier(.22,1,.36,1)" }}
                >
                  <div className="flex items-center gap-3"><span className="text-xl">{"🛒"}</span><span className="text-sm font-black">{cartCount + " article" + (cartCount > 1 ? "s" : "")}</span></div>
                  <span className="text-lg font-black">{formatPrice(checkoutTotal)}</span>
                </button>
              </div>
            </div>
          )}

          {/* Success overlay */}
          {paymentStatus === "success" && !cartOpen && (
            <div className="fixed bottom-0 left-0 right-0 z-40">
              <div className="max-w-4xl mx-auto px-5 pb-4">
                <div className="w-full px-5 py-4 rounded-2xl bg-emerald-600 text-white font-bold text-center shadow-2xl" style={{ animation: "slideUp 0.4s cubic-bezier(.22,1,.36,1)" }}>
                  {"✅ Paiement enregistre !"}
                </div>
              </div>
            </div>
          )}

          {cartOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setCartOpen(false)}>
              <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ animation: "slideUp 0.35s cubic-bezier(.22,1,.36,1)" }}>
                <div className="max-w-4xl mx-auto bg-[#0f1628] border-t border-amber-500/20 rounded-t-3xl">
                  <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-white/10" /></div>
                  <div className="px-5 pb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-black text-white">{"Mon panier"}</h3>
                      <button onClick={() => { clearCart(); setCartOpen(false); }} className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer">{"Vider"}</button>
                    </div>

                    {/* Cart items */}
                    <div className="flex flex-col gap-2 mb-3">
                      {cart.map((item) => (
                        <div key={item.product.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                          <ProductIcon emoji={item.product.emoji} size="text-2xl" />
                          <div className="flex-1 min-w-0"><p className="text-sm font-bold text-white truncate">{item.product.name}</p><p className="text-xs text-amber-400 font-semibold">{formatPrice(item.product.price)}</p></div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setCart((prev) => { const c = prev.find((c) => c.product.id === item.product.id); if (!c) return prev; if (c.qty <= 1) return prev.filter((c) => c.product.id !== item.product.id); return prev.map((c) => c.product.id === item.product.id ? { ...c, qty: c.qty - 1 } : c); })}
                              className="w-7 h-7 rounded-lg bg-white/5 text-white font-bold flex items-center justify-center active:scale-90 cursor-pointer">{"-"}</button>
                            <span className="text-sm font-black text-white w-5 text-center">{item.qty}</span>
                            <button onClick={() => addToCart(item.product)} className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center active:scale-90 cursor-pointer">{"+"}</button>
                          </div>
                          <span className="text-sm font-black text-amber-400 min-w-[50px] text-right">{formatPrice(getFifoTotal(item.product, item.qty))}</span>
                        </div>
                      ))}
                    </div>

                    {/* Madeleine addon toggle */}
                    {madeleineOfferQty > 0 && madeleineProduct && (
                      <div className={"rounded-xl p-3 mb-3 border transition-all " + (madeleineAdded ? "bg-pink-900/30 border-pink-600/50" : "bg-slate-800/50 border-slate-700/30")}>
                        <button onClick={() => setMadeleineAdded(!madeleineAdded)} className="w-full flex items-center gap-3 cursor-pointer">
                          <div className={"w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 " + (madeleineAdded ? "bg-pink-600 border-pink-500" : "border-slate-600 bg-transparent")}>
                            {madeleineAdded && <span className="text-white text-sm font-bold">{"✓"}</span>}
                          </div>
                          <div className="flex-1 text-left">
                            <span className="text-sm font-bold text-white">{(madeleineProduct.emoji || "🧁") + " + " + madeleineOfferQty + " " + madeleineProduct.name + (madeleineOfferQty > 1 ? "s" : "")}</span>
                            <span className="text-xs text-pink-300 ml-2 font-semibold">{"+" + formatPrice(madeleineOfferPrice)}</span>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* Total */}
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
                      <span className="text-2xl font-black text-amber-400">{"Total : " + formatPrice(checkoutTotal)}</span>
                      {madeleineAdded && <span className="block text-xs text-slate-400 mt-1">{"dont " + formatPrice(cartTotal) + " produits + " + formatPrice(madeleineOfferPrice) + " madeleines"}</span>}
                    </div>

                    {/* Buyer name */}
                    <div className="flex flex-col gap-1.5 mb-4">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{"Nom & Prenom"}</label>
                      <div className="relative">
                        <input type="text" placeholder="ex: Jean Dupont" value={buyerName}
                          onChange={(e) => { setBuyerName(e.target.value); setShowCashFlow(false); setCashAmountInput(""); setShowNameSuggestions(true); }}
                          onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
                          onFocus={() => setShowNameSuggestions(true)}
                          className={"h-12 w-full rounded-xl border-2 bg-[#0a0f1e] text-white text-center text-base font-semibold outline-none transition-colors " + (buyerName.trim() ? "border-amber-500" : "border-slate-700")}
                        />
                        {showNameSuggestions && getNameSuggestions(buyerName).length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-[#0a0f1e] border border-slate-700 rounded-xl overflow-hidden z-10 shadow-xl">
                            {getNameSuggestions(buyerName).map((name) => (
                              <button key={name} onMouseDown={() => { setBuyerName(name); setShowNameSuggestions(false); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-[#1e2d4a] transition cursor-pointer flex items-center justify-between">
                                <span>{name}</span>
                                {getMemberBalance(name) > 0 && <span className="text-emerald-400 text-xs font-semibold">{"Avoir : " + formatPrice(getMemberBalance(name))}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {buyerName.trim() && getMemberBalance(buyerName) > 0 && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
                          <span className="text-sm text-emerald-400 font-semibold">{"Bonjour " + buyerName.trim().split(" ")[0] + " ! Avoir : " + formatPrice(getMemberBalance(buyerName))}</span>
                        </div>
                      )}
                    </div>

                    {/* ── Avoir café ── */}
                    {(() => {
                      const buyerKey = normalizeNameFuzzy(buyerName.trim());
                      const canonical = buyerName.trim() ? (members.find((m) => normalizeNameFuzzy(m.name) === buyerKey)?.name || buyerName.trim()) : "";
                      const cafCredit = canonical ? (coffeeCredits[canonical] || 0) : 0;
                      const cartHasCafe = cart.some((c) => c.product.name.toLowerCase().includes("café") || c.product.name.toLowerCase().includes("cafe") || !!(c.product.coffeeServings && c.product.coffeeServings > 1));
                      if (cafCredit > 0 && buyerName.trim() && !coffeeAvoirUsedInCheckout && cartHasCafe) {
                        const madCredit = canonical ? (madeleineCredits[canonical] || 0) : 0;
                        const addonP = allProducts.find((p) => p.coffeeAddon && !p.archived && p.stock > 0);
                        const hasMad = madCredit > 0 && addonP;
                        return (
                          <div className="flex flex-col gap-3 mb-4">
                            <p className="text-xs text-amber-400 font-semibold text-center">{"☕ " + canonical.split(" ")[0] + " a " + cafCredit + " avoir" + (cafCredit > 1 ? "s" : "") + " cafe"}</p>
                            {hasMad && (
                              <div className="bg-pink-900/20 border border-pink-700/30 rounded-xl p-3 text-center">
                                <p className="text-sm text-pink-300 font-bold">{(addonP?.emoji || "🧁") + " 1 madeleine avec ce cafe"}</p>
                                <p className="text-[11px] text-slate-400 mt-1">{"☕ Cafe → tiroir a droite • 🧁 Madeleine → dans le frigo"}</p>
                              </div>
                            )}
                            <button onClick={() => {
                              const locks = hasMad ? "cafe,frigo" : "cafe";
                              fetch("/api/fridge?action=trigger&lock=" + locks).catch(() => {});
                              setCoffeeCredits((prev) => { const next = { ...prev, [canonical]: cafCredit - 1 }; if (next[canonical] <= 0) delete next[canonical]; return next; });
                              if (hasMad && addonP) {
                                setMadeleineCredits((prev) => { const next = { ...prev, [canonical]: madCredit - 1 }; if (next[canonical] <= 0) delete next[canonical]; return next; });
                                const updateFn = (prev: Product[]) => prev.map((p) => p.id === addonP.id ? { ...p, stock: Math.max(0, p.stock - 1) } : p);
                                setProducts(updateFn); setAllProducts(updateFn);
                              }
                              // Déduire capsule
                              const cp = allProducts.find((p) => p.coffeeServings && p.coffeeServings > 1 && !p.archived);
                              if (cp) { const updateFn = (prev: Product[]) => prev.map((p) => p.id !== cp.id ? p : { ...p, stock: Math.max(0, p.stock - 1) }); setProducts(updateFn); setAllProducts(updateFn); }
                              const remaining = cart.filter((c) => !c.product.name.toLowerCase().includes("cafe") && !c.product.name.toLowerCase().includes("café"));
                              setCart(remaining);
                              if (remaining.length > 0) { setCoffeeAvoirUsedInCheckout(true); showToast(hasMad ? "☕ Cafe + 🧁 Madeleine — passez au paiement" : "☕ Cafe deverrouille !"); }
                              else { showToast(hasMad ? "☕ Tiroir cafe + 🧁 Frigo ouverts !" : "☕ Tiroir cafe ouvert !"); clearCart(); setBuyerName(""); setCartOpen(false); }
                            }} className="w-full py-4 rounded-xl font-extrabold text-lg bg-amber-500 text-black active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                              {hasMad ? "☕ 1 cafe + 🧁 1 madeleine" : "☕ Utiliser mon avoir cafe"}
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* ── Payment methods ── */}
                    {buyerName.trim() && (
                      <div className="flex flex-col gap-2">
                        {/* Avoir */}
                        {getMemberBalance(buyerName) >= checkoutTotal && checkoutTotal > 0 && (
                          <button onClick={() => confirmPayment("avoir")} className="w-full py-3.5 rounded-xl font-bold text-[15px] bg-emerald-600 text-white active:scale-95 cursor-pointer">
                            {"✅ Utiliser mon avoir (" + formatPrice(getMemberBalance(buyerName)) + ")"}
                          </button>
                        )}
                        {getMemberBalance(buyerName) > 0 && getMemberBalance(buyerName) < checkoutTotal && checkoutTotal > 0 && (
                          <div className="bg-[#0a0f1e] rounded-xl p-3 text-xs text-slate-400 text-center">{"Avoir insuffisant (" + formatPrice(getMemberBalance(buyerName)) + " < " + formatPrice(checkoutTotal) + ")"}</div>
                        )}

                        {/* Espèces */}
                        {!showCashFlow ? (
                          <button onClick={() => setShowCashFlow(true)} className="w-full py-3.5 rounded-xl font-bold text-[15px] bg-emerald-700 text-white active:scale-95 cursor-pointer">{"💰 Payer en especes"}</button>
                        ) : (
                          <div className="bg-[#0a0f1e] border border-emerald-700 rounded-xl p-4">
                            <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-2">{"Montant mis dans la boite"}</label>
                            <div className="flex gap-2 mb-2">
                              {[0.5, 1, 2, 5].map((v) => (
                                <button key={v} onClick={() => setCashAmountInput(String(v))}
                                  className={"flex-1 py-2 rounded-lg text-sm font-bold transition cursor-pointer " + (cashAmountInput === String(v) ? "bg-emerald-600 text-white" : "bg-[#131b2e] border border-slate-700 text-slate-300")}
                                >{formatPrice(v)}</button>
                              ))}
                            </div>
                            <input type="number" step="0.5" min="0" placeholder="Autre montant..." value={cashAmountInput} onChange={(e) => setCashAmountInput(e.target.value)}
                              className="w-full h-10 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-center text-sm font-bold outline-none mb-2" />
                            {cashAmountInput && parseFloat(cashAmountInput) >= checkoutTotal && (
                              <div className="text-xs text-center mb-2">
                                {parseFloat(cashAmountInput) > checkoutTotal && <span className="text-emerald-400 font-semibold">{"Avoir credite : +" + formatPrice(parseFloat(cashAmountInput) - checkoutTotal)}</span>}
                                {parseFloat(cashAmountInput) === checkoutTotal && <span className="text-slate-400">{"Montant exact"}</span>}
                              </div>
                            )}
                            {cashAmountInput && parseFloat(cashAmountInput) < checkoutTotal && (
                              <div className="text-xs text-center mb-2 text-red-400">{"Il manque " + formatPrice(checkoutTotal - parseFloat(cashAmountInput))}</div>
                            )}
                            <button onClick={() => { const amt = parseFloat(cashAmountInput); if (amt >= checkoutTotal) confirmPayment("especes", amt); }}
                              disabled={!cashAmountInput || parseFloat(cashAmountInput) < checkoutTotal}
                              className={"w-full py-3 rounded-xl font-bold text-sm transition-all " + (cashAmountInput && parseFloat(cashAmountInput) >= checkoutTotal ? "bg-emerald-600 text-white active:scale-95 cursor-pointer" : "bg-slate-800 text-slate-600 cursor-not-allowed")}
                            >{"Confirmer paiement especes"}</button>
                          </div>
                        )}

                        {/* Carte */}
                        <button onClick={() => confirmPayment("carte")} className="w-full py-3.5 rounded-xl font-bold text-[15px] bg-blue-600 text-white active:scale-95 cursor-pointer">
                          {"💳 Payer " + formatPrice(checkoutTotal) + " par carte"}
                        </button>

                        {/* Offert */}
                        {checkoutTotal === 0 && (
                          <button onClick={() => confirmPayment("offert")} className="w-full py-3.5 rounded-xl font-bold text-[15px] bg-purple-700 text-white active:scale-95 cursor-pointer">{"🎁 Offert"}</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════ COFFEE MODAL ═══════ */}
      {coffeeModal && coffeeModal.step === "coffee" && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-amber-700/40 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 shadow-2xl">
            <div className="text-4xl text-center">{"☕"}</div>
            <h2 className="text-lg font-bold text-white text-center">{"Combien de cafes maintenant ?"}</h2>
            <p className="text-sm text-slate-400 text-center">{coffeeModal.buyer.split(" ")[0] + " a achete "}<span className="text-amber-400 font-bold">{coffeeModal.totalServings + " cafe" + (coffeeModal.totalServings > 1 ? "s" : "")}</span></p>
            <div className="flex flex-col gap-2">
              {Array.from({ length: coffeeModal.totalServings }, (_, i) => i + 1).map((n) => {
                const leftover = coffeeModal.totalServings - n;
                return (
                  <button key={n} onClick={() => handleCoffeeChoice(n)}
                    className={"w-full py-3.5 rounded-xl font-bold text-sm cursor-pointer active:scale-95 flex items-center justify-between px-5 " + (n === coffeeModal.totalServings ? "bg-emerald-600 text-white" : "border border-amber-600 bg-amber-900/20 text-amber-300")}
                  >
                    <span>{"☕".repeat(n) + " " + n + " cafe" + (n > 1 ? "s" : "") + (n < coffeeModal.totalServings ? " maintenant" : "")}</span>
                    {leftover > 0 && <span className="text-xs text-slate-400 font-normal">{"→ +" + leftover + " avoir"}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ MADELEINE MODAL ═══════ */}
      {coffeeModal && coffeeModal.step === "madeleine" && (() => {
        const addonProd = allProducts.find((p) => p.coffeeAddon && !p.archived);
        const addonEmoji = addonProd?.emoji || "🧁";
        const addonName = addonProd?.name || "Madeleine";
        const totalMad = coffeeModal.totalMadeleines || (addonProd?.coffeeAddonQty || 2);
        const usedNow = coffeeModal.usedNow || 0;
        return (
          <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#131b2e] border border-pink-700/40 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 shadow-2xl">
              <div className="text-4xl text-center">{addonEmoji}</div>
              <h2 className="text-lg font-bold text-white text-center">{"Vos " + totalMad + " " + addonName + (totalMad > 1 ? "s" : "")}</h2>
              <p className="text-center text-pink-300 text-sm font-semibold">{"Deja incluses — comment les repartir ?"}</p>
              <p className="text-[11px] text-slate-500 text-center">{"☕ Cafe → tiroir a droite • " + addonEmoji + " → dans le frigo"}</p>
              <div className="flex flex-col gap-2 mt-2">
                {usedNow >= totalMad && <button onClick={() => handleMadeleineChoice(totalMad)} className="w-full py-3.5 rounded-xl font-bold text-sm cursor-pointer active:scale-95 bg-emerald-600 text-white px-5">{addonEmoji + " Les " + totalMad + " maintenant"}</button>}
                {usedNow > 0 && usedNow < totalMad && (
                  <>
                    <button onClick={() => handleMadeleineChoice(usedNow)} className="w-full py-3.5 rounded-xl font-bold text-sm cursor-pointer active:scale-95 bg-emerald-600 text-white px-5 flex flex-col items-center">
                      <span>{addonEmoji + " " + usedNow + " maintenant + " + (totalMad - usedNow) + " en avoir"}</span>
                      <span className="text-[11px] font-normal text-emerald-200 mt-0.5">{"Les " + (totalMad - usedNow) + " en avoir avec vos prochains cafes"}</span>
                    </button>
                    <button onClick={() => handleMadeleineChoice(totalMad)} className="w-full py-3.5 rounded-xl font-bold text-sm cursor-pointer active:scale-95 border border-amber-600 bg-amber-900/20 text-amber-300 px-5">{addonEmoji + " Les " + totalMad + " maintenant"}</button>
                  </>
                )}
                {usedNow === 0 && <button onClick={() => handleMadeleineChoice(0)} className="w-full py-3.5 rounded-xl font-bold text-sm cursor-pointer active:scale-95 bg-emerald-600 text-white px-5">{addonEmoji + " " + totalMad + " en avoir (prochains cafes)"}</button>}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
