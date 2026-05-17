"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ════════════════════════════════════════════
//  SOUND SYSTEM — Web Audio API + Speech
// ════════════════════════════════════════════

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
  o.connect(g);
  g.connect(ctx.destination);
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + dur);
}

const Sound = {
  cartAdd() {
    tone(600, 0.08, "sine", 0.15);
    setTimeout(() => tone(900, 0.12, "sine", 0.2), 60);
  },
  cartRemove() {
    tone(400, 0.1, "sine", 0.1);
  },
  success() {
    tone(523, 0.15, "sine", 0.25);
    setTimeout(() => tone(659, 0.15, "sine", 0.25), 120);
    setTimeout(() => tone(784, 0.25, "sine", 0.25), 240);
    setTimeout(() => tone(1047, 0.4, "sine", 0.3), 380);
  },
  error() {
    tone(200, 0.2, "square", 0.15);
    setTimeout(() => tone(150, 0.3, "square", 0.1), 150);
  },
  lock() {
    tone(2000, 0.05, "square", 0.12);
    setTimeout(() => tone(1500, 0.08, "triangle", 0.1), 30);
  },
  tap() {
    tone(1200, 0.03, "sine", 0.08);
  },
};

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  u.rate = 1.05;
  u.pitch = 1.0;
  u.volume = 1.0;
  window.speechSynthesis.speak(u);
}

function announceLock(lockType: string) {
  Sound.lock();
  const locks = lockType.split(",");
  const names: string[] = [];
  if (locks.includes("cafe")) names.push("le cafe");
  if (locks.includes("frigo")) names.push("le frigo");
  if (locks.includes("congelateur")) names.push("le congelateur");
  if (names.length === 0) names.push("les serrures");
  const text =
    names.length === 1
      ? names[0] + " est ouvert !"
      : names.slice(0, -1).join(", ") + " et " + names[names.length - 1] + " sont ouverts !";
  setTimeout(() => speak(text), 400);
}

// ════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════

interface Product {
  id: string;
  name: string;
  emoji: string;
  price: number;
  cost: number;
  stock: number;
  category?: string;
  location?: "frigo" | "cafe" | "congelateur";
  archived?: boolean;
}

interface CartItem {
  product: Product;
  qty: number;
}

interface Category {
  id: string | null;
  label: string;
  emoji: string;
}

// ════════════════════════════════════════════
//  DEMO DATA
// ════════════════════════════════════════════

const DEMO_PRODUCTS: Product[] = [
  { id: "cafe", name: "Cafe", emoji: "☕", price: 0.5, cost: 0.15, stock: 35, category: "chaud", location: "cafe" },
  { id: "eau", name: "Eau", emoji: "💧", price: 0.5, cost: 0.1, stock: 20, category: "soft", location: "frigo" },
  { id: "coca", name: "Coca-Cola", emoji: "🥤", price: 1.0, cost: 0.4, stock: 14, category: "soft", location: "frigo" },
  { id: "orangina", name: "Orangina", emoji: "🍊", price: 1.0, cost: 0.4, stock: 12, category: "soft", location: "frigo" },
  { id: "icetea", name: "Ice Tea", emoji: "🧋", price: 1.0, cost: 0.35, stock: 8, category: "soft", location: "frigo" },
  { id: "perrier", name: "Perrier", emoji: "🧊", price: 1.0, cost: 0.3, stock: 10, category: "soft", location: "frigo" },
  { id: "biere", name: "Biere", emoji: "🍺", price: 1.5, cost: 0.6, stock: 12, category: "alcool", location: "frigo" },
  { id: "snack", name: "Snack", emoji: "🍫", price: 1.0, cost: 0.3, stock: 15, category: "food", location: "cafe" },
  { id: "chips", name: "Chips", emoji: "🍟", price: 1.0, cost: 0.35, stock: 12, category: "food", location: "cafe" },
  { id: "glace", name: "Glace", emoji: "🍦", price: 1.5, cost: 0.5, stock: 3, category: "food", location: "congelateur" },
  { id: "jus", name: "Jus d'orange", emoji: "🧃", price: 1.0, cost: 0.35, stock: 2, category: "soft", location: "frigo" },
  { id: "bonbon", name: "Bonbons", emoji: "🍬", price: 0.5, cost: 0.15, stock: 0, category: "food", location: "cafe" },
];

const DEMO_CATEGORIES: Category[] = [
  { id: null, label: "Tout", emoji: "✨" },
  { id: "soft", label: "Softs", emoji: "🥤" },
  { id: "chaud", label: "Chaud", emoji: "☕" },
  { id: "alcool", label: "Alcool", emoji: "🍺" },
  { id: "food", label: "Snacks", emoji: "🍫" },
];

const MEMBERS = ["Jean Dupont", "Marie Martin", "Pierre Lefevre", "Luc Moreau", "Sophie Bernard", "Club (offert)"];

// ════════════════════════════════════════════
//  CSS KEYFRAMES (injected once)
// ════════════════════════════════════════════

const STYLES = `
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(24px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
@keyframes slideDown {
  from { transform: translateY(0); }
  to   { transform: translateY(100%); }
}
@keyframes popIn {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}
@keyframes checkDraw {
  from { stroke-dashoffset: 48; }
  to   { stroke-dashoffset: 0; }
}
@keyframes circlePop {
  from { transform: scale(0); opacity: 1; }
  to   { transform: scale(1); opacity: 1; }
}
@keyframes confettiDrop {
  0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(120px) rotate(720deg); opacity: 0; }
}
@keyframes emojiFloat {
  0%   { transform: translateY(0) scale(1); }
  50%  { transform: translateY(-6px) scale(1.05); }
  100% { transform: translateY(0) scale(1); }
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
  50%      { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
}
@keyframes gradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes badgePop {
  0%   { transform: scale(0); }
  60%  { transform: scale(1.3); }
  100% { transform: scale(1); }
}
@keyframes ripple {
  0%   { transform: scale(0); opacity: 0.5; }
  100% { transform: scale(4); opacity: 0; }
}
.card-pop { animation: popIn 0.3s ease; }
.badge-pop { animation: badgePop 0.3s ease; }
.confetti-piece { animation: confettiDrop 1.2s ease-out forwards; }
`;

// ════════════════════════════════════════════
//  CONFETTI COMPONENT
// ════════════════════════════════════════════

function Confetti() {
  const colors = ["#FFD700", "#0A2FE0", "#FF6B6B", "#4ADE80", "#A78BFA", "#F472B6", "#38BDF8"];
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    color: colors[i % colors.length],
    size: 6 + Math.random() * 6,
    duration: 0.8 + Math.random() * 0.8,
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            position: "absolute",
            top: "30%",
            left: p.left + "%",
            width: p.size,
            height: p.size,
            borderRadius: p.id % 3 === 0 ? "50%" : "2px",
            background: p.color,
            animationDelay: p.delay + "s",
            animationDuration: p.duration + "s",
          }}
        />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════
//  SUCCESS OVERLAY
// ════════════════════════════════════════════

function SuccessOverlay({ lockType, onClose }: { lockType: string; onClose: () => void }) {
  useEffect(() => {
    Sound.success();
    const t1 = setTimeout(() => announceLock(lockType), 500);
    const t2 = setTimeout(onClose, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [lockType, onClose]);

  const lockNames: string[] = [];
  const locks = lockType.split(",");
  if (locks.includes("cafe")) lockNames.push("☕ Cafe");
  if (locks.includes("frigo")) lockNames.push("🍺 Frigo");
  if (locks.includes("congelateur")) lockNames.push("❄️ Congelateur");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        animation: "scaleIn 0.3s ease",
      }}
    >
      <Confetti />
      {/* Checkmark */}
      <div style={{ position: "relative", width: 120, height: 120, marginBottom: 32 }}>
        <svg viewBox="0 0 52 52" style={{ width: 120, height: 120 }}>
          <circle cx="26" cy="26" r="24" fill="none" stroke="#4ADE80" strokeWidth="3"
            style={{ animation: "circlePop 0.4s ease forwards" }} />
          <path fill="none" stroke="#4ADE80" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
            d="M14.1 27.2l7.1 7.2 16.7-16.8"
            style={{ strokeDasharray: 48, animation: "checkDraw 0.5s ease 0.3s forwards", strokeDashoffset: 48 }} />
        </svg>
      </div>
      <p style={{ color: "#fff", fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 12 }}>
        Transaction validee !
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        {lockNames.map((n) => (
          <span key={n} style={{
            background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)",
            borderRadius: 12, padding: "8px 20px", color: "#4ADE80", fontSize: 18, fontWeight: 600,
          }}>{n} ouvert</span>
        ))}
      </div>
      <p style={{ color: "rgba(255,255,255,0.4)", marginTop: 40, fontSize: 14 }}>Toucher pour fermer</p>
    </div>
  );
}

// ════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════

export default function DevPage() {
  // ── State ──
  const [products] = useState<Product[]>(DEMO_PRODUCTS);
  const [categories] = useState<Category[]>(DEMO_CATEGORIES);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<string>("");
  const [payMethod, setPayMethod] = useState<"especes" | "carte" | "avoir">("especes");
  const [success, setSuccess] = useState<{ lockType: string } | null>(null);
  const [animatingProductId, setAnimatingProductId] = useState<string | null>(null);
  const [catChangeKey, setCatChangeKey] = useState(0);
  const [time, setTime] = useState("");
  const cartRef = useRef<HTMLDivElement>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const rippleId = useRef(0);

  // ── Clock ──
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const i = setInterval(tick, 30000);
    return () => clearInterval(i);
  }, []);

  // ── Filtered products ──
  const filtered = products.filter((p) => !p.archived && (selectedCat === null || p.category === selectedCat));

  // ── Cart helpers ──
  const cartTotal = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) { Sound.error(); return; }
    Sound.cartAdd();
    setAnimatingProductId(product.id);
    setTimeout(() => setAnimatingProductId(null), 300);
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { product, qty: 1 }];
    });
  }, []);

  const updateQty = useCallback((productId: string, delta: number) => {
    if (delta > 0) Sound.cartAdd(); else Sound.cartRemove();
    setCart((prev) => {
      return prev.map((c) => {
        if (c.product.id !== productId) return c;
        const newQty = c.qty + delta;
        return newQty <= 0 ? null : { ...c, qty: newQty };
      }).filter(Boolean) as CartItem[];
    });
  }, []);

  const handleCategoryChange = useCallback((catId: string | null) => {
    Sound.tap();
    setSelectedCat(catId);
    setCatChangeKey((k) => k + 1);
  }, []);

  // ── Ripple effect ──
  const addRipple = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const id = ++rippleId.current;
    setRipples((prev) => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
  }, []);

  // ── Checkout ──
  const handleCheckout = useCallback(() => {
    if (cart.length === 0 || !selectedBuyer) return;

    // Determine locks needed
    const locationsNeeded = new Set<string>();
    for (const c of cart) {
      locationsNeeded.add(c.product.location || "frigo");
    }
    const lockType = [...locationsNeeded].join(",");

    // Close modals and show success
    setCheckoutOpen(false);
    setCartOpen(false);
    setSuccess({ lockType });
    setCart([]);
    setSelectedBuyer("");
  }, [cart, selectedBuyer]);

  const closeSuccess = useCallback(() => setSuccess(null), []);

  // ════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* ── Success Overlay ── */}
      {success && <SuccessOverlay lockType={success.lockType} onClose={closeSuccess} />}

      <div style={{
        minHeight: "100dvh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        backgroundSize: "200% 200%",
        animation: "gradientShift 15s ease infinite",
        color: "#f1f5f9",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}>

        {/* ══════ TOP BAR ══════ */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px",
          background: "rgba(15,23,42,0.8)", backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          position: "sticky", top: 0, zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "linear-gradient(135deg, #0A2FE0, #1A40FF)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 800, color: "#FFD700",
              boxShadow: "0 0 20px rgba(10,47,224,0.4)",
            }}>A</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Aero-Club Bar</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>DEV MODE</div>
            </div>
          </div>

          <div style={{ fontSize: 28, fontWeight: 300, color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em" }}>
            {time}
          </div>

          {/* Cart button */}
          <button
            onClick={() => { Sound.tap(); setCartOpen(true); }}
            style={{
              position: "relative",
              background: cartCount > 0 ? "linear-gradient(135deg, #0A2FE0, #1A40FF)" : "rgba(255,255,255,0.06)",
              border: "1px solid " + (cartCount > 0 ? "rgba(26,64,255,0.5)" : "rgba(255,255,255,0.08)"),
              borderRadius: 14, padding: "10px 18px",
              color: "#f1f5f9", fontSize: 18, cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <span style={{ fontSize: 22 }}>{"🛒"}</span>
            {cartCount > 0 && (
              <span className="badge-pop" key={cartCount} style={{
                background: "#FFD700", color: "#0f172a",
                borderRadius: "50%", width: 24, height: 24,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800,
              }}>{cartCount}</span>
            )}
          </button>
        </header>

        {/* ══════ CATEGORIES ══════ */}
        <div style={{
          display: "flex", gap: 8, padding: "16px 24px",
          overflowX: "auto", flexShrink: 0,
          WebkitOverflowScrolling: "touch",
        }}>
          {categories.map((cat) => {
            const active = selectedCat === cat.id;
            return (
              <button
                key={cat.id ?? "__all__"}
                onClick={() => handleCategoryChange(cat.id)}
                style={{
                  flex: "0 0 auto",
                  padding: "10px 20px",
                  borderRadius: 50,
                  border: "1px solid " + (active ? "rgba(10,47,224,0.6)" : "rgba(255,255,255,0.08)"),
                  background: active
                    ? "linear-gradient(135deg, rgba(10,47,224,0.4), rgba(26,64,255,0.2))"
                    : "rgba(255,255,255,0.04)",
                  color: active ? "#93B4FF" : "rgba(255,255,255,0.5)",
                  fontSize: 15, fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                  display: "flex", alignItems: "center", gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* ══════ PRODUCTS GRID ══════ */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "8px 24px 120px",
          WebkitOverflowScrolling: "touch",
        }}>
          <div
            key={catChangeKey}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 16,
            }}
          >
            {filtered.map((product, i) => {
              const inCart = cart.find((c) => c.product.id === product.id);
              const isAnimating = animatingProductId === product.id;
              const outOfStock = product.stock <= 0;
              const lowStock = product.stock > 0 && product.stock <= 2;
              return (
                <div
                  key={product.id}
                  className={isAnimating ? "card-pop" : ""}
                  onClick={(e) => { if (!outOfStock) { addRipple(e); addToCart(product); } }}
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    background: outOfStock
                      ? "rgba(255,255,255,0.02)"
                      : inCart
                        ? "linear-gradient(135deg, rgba(10,47,224,0.15), rgba(26,64,255,0.08))"
                        : "rgba(255,255,255,0.04)",
                    border: "1px solid " + (
                      outOfStock ? "rgba(255,255,255,0.04)"
                        : lowStock ? "rgba(239,68,68,0.3)"
                          : inCart ? "rgba(10,47,224,0.3)" : "rgba(255,255,255,0.06)"
                    ),
                    borderRadius: 20,
                    padding: "20px 16px 16px",
                    cursor: outOfStock ? "not-allowed" : "pointer",
                    opacity: outOfStock ? 0.4 : 1,
                    transition: "all 0.2s ease",
                    animation: `fadeInUp 0.4s ease ${i * 0.04}s both`,
                    backdropFilter: "blur(10px)",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    ...(lowStock ? { animation: `fadeInUp 0.4s ease ${i * 0.04}s both, pulseGlow 2s infinite` } : {}),
                  }}
                >
                  {/* Ripple effect */}
                  {ripples.filter((r) => true).map((r) => (
                    <span key={r.id} style={{
                      position: "absolute", left: r.x, top: r.y,
                      width: 20, height: 20, borderRadius: "50%",
                      background: "rgba(255,255,255,0.2)",
                      transform: "translate(-50%,-50%)",
                      animation: "ripple 0.6s ease forwards",
                      pointerEvents: "none",
                    }} />
                  ))}

                  {/* Emoji */}
                  <div style={{
                    fontSize: 48,
                    marginBottom: 8,
                    animation: "emojiFloat 3s ease-in-out infinite",
                    animationDelay: (i * 0.2) + "s",
                    filter: outOfStock ? "grayscale(1)" : "none",
                  }}>
                    {product.emoji}
                  </div>

                  {/* Name */}
                  <div style={{
                    fontSize: 14, fontWeight: 600, textAlign: "center",
                    color: outOfStock ? "rgba(255,255,255,0.3)" : "#e2e8f0",
                    marginBottom: 4,
                    lineHeight: 1.2,
                    maxHeight: "2.4em", overflow: "hidden",
                  }}>
                    {product.name}
                  </div>

                  {/* Price */}
                  <div style={{
                    fontSize: 20, fontWeight: 800,
                    background: "linear-gradient(135deg, #FFD700, #FFA500)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    marginBottom: 8,
                  }}>
                    {product.price.toFixed(2).replace(".", ",")} {"€"}
                  </div>

                  {/* Stock indicator */}
                  <div style={{
                    fontSize: 11, fontWeight: 500,
                    color: outOfStock ? "#ef4444" : lowStock ? "#f97316" : "rgba(255,255,255,0.3)",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: outOfStock ? "#ef4444" : lowStock ? "#f97316" : "#4ade80",
                    }} />
                    {outOfStock ? "Rupture" : product.stock + " dispo"}
                  </div>

                  {/* Quantity badge in cart */}
                  {inCart && (
                    <div className="badge-pop" key={inCart.qty} style={{
                      position: "absolute", top: 8, right: 8,
                      width: 28, height: 28, borderRadius: "50%",
                      background: "linear-gradient(135deg, #0A2FE0, #1A40FF)",
                      color: "#fff", fontSize: 14, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(10,47,224,0.5)",
                    }}>
                      {inCart.qty}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>{"📦"}</div>
              <div>Aucun produit dans cette categorie</div>
            </div>
          )}
        </div>

        {/* ══════ BOTTOM BAR ══════ */}
        {cartCount > 0 && (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            background: "rgba(15,23,42,0.95)", backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: "14px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            zIndex: 90,
            animation: "slideUp 0.3s ease",
          }}>
            <div onClick={() => { Sound.tap(); setCartOpen(true); }} style={{ cursor: "pointer", flex: 1 }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>
                {cartCount} article{cartCount > 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {cartTotal.toFixed(2).replace(".", ",")} {"€"}
              </div>
            </div>

            <button
              onClick={() => { Sound.tap(); setCartOpen(true); }}
              style={{
                background: "linear-gradient(135deg, #0A2FE0, #1A40FF)",
                border: "none", borderRadius: 16,
                padding: "14px 32px",
                color: "#fff", fontSize: 16, fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(10,47,224,0.4)",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              Voir le panier
              <span style={{ fontSize: 18 }}>{"→"}</span>
            </button>
          </div>
        )}

        {/* ══════ CART DRAWER ══════ */}
        {cartOpen && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
          >
            {/* Backdrop */}
            <div
              onClick={() => { Sound.tap(); setCartOpen(false); }}
              style={{
                position: "absolute", inset: 0,
                background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
              }}
            />

            {/* Sheet */}
            <div
              ref={cartRef}
              style={{
                position: "relative",
                background: "linear-gradient(180deg, #1e293b, #0f172a)",
                borderRadius: "28px 28px 0 0",
                maxHeight: "85dvh",
                overflow: "auto",
                animation: "slideUp 0.35s ease",
                boxShadow: "0 -4px 40px rgba(0,0,0,0.5)",
              }}
            >
              {/* Handle */}
              <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px" }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
              </div>

              <div style={{ padding: "0 24px 32px" }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20, marginTop: 8 }}>
                  {"🛒"} Panier
                </h2>

                {/* Cart items */}
                {cart.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)" }}>
                    Panier vide
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                    {cart.map((item, i) => (
                      <div
                        key={item.product.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 16, padding: "12px 16px",
                          animation: `scaleIn 0.25s ease ${i * 0.05}s both`,
                        }}
                      >
                        <span style={{ fontSize: 32 }}>{item.product.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{item.product.name}</div>
                          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                            {item.product.price.toFixed(2).replace(".", ",")} {"€"} / unite
                          </div>
                        </div>

                        {/* Qty controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            onClick={() => updateQty(item.product.id, -1)}
                            style={{
                              width: 36, height: 36, borderRadius: 10,
                              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                              color: "#f1f5f9", fontSize: 18, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >{"−"}</button>
                          <span style={{ fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: "center" }}>
                            {item.qty}
                          </span>
                          <button
                            onClick={() => updateQty(item.product.id, 1)}
                            style={{
                              width: 36, height: 36, borderRadius: 10,
                              background: "rgba(10,47,224,0.2)", border: "1px solid rgba(10,47,224,0.3)",
                              color: "#93B4FF", fontSize: 18, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >+</button>
                        </div>

                        <div style={{ fontSize: 16, fontWeight: 700, minWidth: 60, textAlign: "right" }}>
                          {(item.product.price * item.qty).toFixed(2).replace(".", ",")} {"€"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {cart.length > 0 && (
                  <>
                    {/* Divider */}
                    <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 0 20px" }} />

                    {/* Total */}
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      marginBottom: 28,
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>Total</span>
                      <span style={{ fontSize: 28, fontWeight: 800 }}>
                        {cartTotal.toFixed(2).replace(".", ",")} {"€"}
                      </span>
                    </div>

                    {/* Member selector */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Membre
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {MEMBERS.map((m) => (
                          <button
                            key={m}
                            onClick={() => { Sound.tap(); setSelectedBuyer(m); }}
                            style={{
                              padding: "10px 18px", borderRadius: 12,
                              background: selectedBuyer === m
                                ? "linear-gradient(135deg, #0A2FE0, #1A40FF)"
                                : "rgba(255,255,255,0.04)",
                              border: "1px solid " + (selectedBuyer === m ? "rgba(26,64,255,0.5)" : "rgba(255,255,255,0.08)"),
                              color: selectedBuyer === m ? "#fff" : "rgba(255,255,255,0.5)",
                              fontSize: 14, fontWeight: selectedBuyer === m ? 700 : 500,
                              cursor: "pointer", transition: "all 0.2s ease",
                            }}
                          >{m}</button>
                        ))}
                      </div>
                    </div>

                    {/* Payment method */}
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Paiement
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        {([
                          { key: "especes" as const, label: "Especes", emoji: "💰" },
                          { key: "carte" as const, label: "Carte", emoji: "💳" },
                          { key: "avoir" as const, label: "Avoir", emoji: "🏦" },
                        ]).map((pm) => (
                          <button
                            key={pm.key}
                            onClick={() => { Sound.tap(); setPayMethod(pm.key); }}
                            style={{
                              flex: 1, padding: "14px 12px", borderRadius: 14,
                              background: payMethod === pm.key
                                ? "linear-gradient(135deg, rgba(10,47,224,0.3), rgba(26,64,255,0.15))"
                                : "rgba(255,255,255,0.03)",
                              border: "1px solid " + (payMethod === pm.key ? "rgba(10,47,224,0.4)" : "rgba(255,255,255,0.06)"),
                              color: payMethod === pm.key ? "#93B4FF" : "rgba(255,255,255,0.4)",
                              fontSize: 14, fontWeight: payMethod === pm.key ? 700 : 500,
                              cursor: "pointer", transition: "all 0.2s ease",
                              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                            }}
                          >
                            <span style={{ fontSize: 24 }}>{pm.emoji}</span>
                            {pm.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Checkout button */}
                    <button
                      onClick={handleCheckout}
                      disabled={!selectedBuyer}
                      style={{
                        width: "100%", padding: "18px",
                        borderRadius: 18,
                        border: "none",
                        background: selectedBuyer
                          ? "linear-gradient(135deg, #0A2FE0, #1A40FF)"
                          : "rgba(255,255,255,0.06)",
                        color: selectedBuyer ? "#fff" : "rgba(255,255,255,0.2)",
                        fontSize: 18, fontWeight: 800,
                        cursor: selectedBuyer ? "pointer" : "not-allowed",
                        boxShadow: selectedBuyer ? "0 4px 24px rgba(10,47,224,0.5)" : "none",
                        transition: "all 0.3s ease",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                      }}
                    >
                      {selectedBuyer ? (
                        <>
                          Valider {cartTotal.toFixed(2).replace(".", ",")} {"€"}
                          <span style={{ fontSize: 20 }}>{"✓"}</span>
                        </>
                      ) : (
                        "Selectionnez un membre"
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
