"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// ─── LocalStorage helpers ───
function loadLocal(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveLocal(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Storage error:", e);
  }
}

// ─── Default data ───
const DEFAULT_PRODUCTS = [
  { id: "cafe", name: "Café", emoji: "☕", price: 0.5, stock: 50 },
  { id: "eau", name: "Eau", emoji: "💧", price: 0.5, stock: 30 },
  { id: "coca", name: "Coca-Cola", emoji: "🥤", price: 1.0, stock: 24 },
  { id: "orangina", name: "Orangina", emoji: "🍊", price: 1.0, stock: 24 },
  { id: "biere", name: "Bière", emoji: "🍺", price: 1.5, stock: 20 },
  { id: "snack", name: "Snack", emoji: "🍫", price: 1.0, stock: 15 },
];

const DEFAULT_SETTINGS = {
  clubName: "Aéro-Club",
  adminPin: "1234",
  sumupConfigured: false,
};

function formatPrice(p) {
  return p.toFixed(2).replace(".", ",") + " €";
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ══════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════
export default function AeroClubBar() {
  const [view, setView] = useState("member");
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [transactions, setTransactions] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Member purchase state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [buyerName, setBuyerName] = useState("");
  const [lastBuyerName, setLastBuyerName] = useState("");
  const [sumupCheckoutUrl, setSumupCheckoutUrl] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [sumupLoading, setSumupLoading] = useState(false);
  const [sumupError, setSumupError] = useState(null);

  // Admin state
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", emoji: "🥤", price: 1.0, stock: 20 });
  const [activeAdminTab, setActiveAdminTab] = useState("stock");
  const [toast, setToast] = useState(null);
  const [filterBuyer, setFilterBuyer] = useState("");

  // ─── Load data ───
  useEffect(() => {
    setProducts(loadLocal("aeroclub-products", DEFAULT_PRODUCTS));
    setTransactions(loadLocal("aeroclub-transactions", []));
    setSettings(loadLocal("aeroclub-settings", DEFAULT_SETTINGS));
    setLastBuyerName(loadLocal("aeroclub-lastbuyer", ""));
    setLoading(false);

    // Check if returning from SumUp payment
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      const productId = params.get("product");
      const buyer = decodeURIComponent(params.get("buyer") || "");
      if (productId) {
        handleReturnFromSumUp(productId, buyer);
      }
      // Clean URL
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // ─── Persist on change ───
  useEffect(() => { if (!loading) saveLocal("aeroclub-products", products); }, [products, loading]);
  useEffect(() => { if (!loading) saveLocal("aeroclub-transactions", transactions); }, [transactions, loading]);
  useEffect(() => { if (!loading) saveLocal("aeroclub-settings", settings); }, [settings, loading]);
  useEffect(() => { if (!loading) saveLocal("aeroclub-lastbuyer", lastBuyerName); }, [lastBuyerName, loading]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ─── Handle return from SumUp payment page ───
  function handleReturnFromSumUp(productId, buyer) {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: Math.max(0, p.stock - 1) } : p))
    );
    const product = products.find((p) => p.id === productId) || { name: productId, price: 0 };
    const tx = {
      id: Date.now().toString(36),
      productId,
      productName: product.name,
      price: product.price,
      buyer: buyer || "Carte SumUp",
      date: new Date().toISOString(),
      method: "carte",
    };
    setTransactions((prev) => [tx, ...prev]);
    showToast(`Paiement confirmé — Merci ${buyer || ""} !`);
  }

  // ─── Create SumUp checkout ───
  async function createSumUpCheckout(product, buyer) {
    setSumupLoading(true);
    setSumupError(null);
    setSumupCheckoutUrl(null);
    setQrDataUrl(null);

    try {
      const res = await fetch("/api/sumup-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: product.price,
          description: product.name,
          buyer: buyer,
          productId: product.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSumupError(data.error || "Erreur lors de la création du paiement");
        return;
      }

      setSumupCheckoutUrl(data.paymentUrl);

      // Generate QR code dynamically
      try {
        const QRCode = (await import("qrcode")).default;
        const qr = await QRCode.toDataURL(data.paymentUrl, {
          width: 200,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        setQrDataUrl(qr);
      } catch {
        // QR generation failed, user can still click the link
        console.warn("QR code generation failed");
      }
    } catch (err) {
      setSumupError("Impossible de contacter le serveur");
    } finally {
      setSumupLoading(false);
    }
  }

  // ─── Member: handle purchase ───
  const handlePurchase = (product) => {
    if (product.stock <= 0) return;
    setSelectedProduct(product);
    setBuyerName(lastBuyerName);
    setPaymentStatus("pending");
    setSumupCheckoutUrl(null);
    setQrDataUrl(null);
    setSumupError(null);
  };

  // Called when buyer name is entered and they want to pay by card
  const handlePayByCard = () => {
    if (!buyerName.trim() || !selectedProduct) return;
    createSumUpCheckout(selectedProduct, buyerName.trim());
  };

  const confirmPayment = (method) => {
    if (!buyerName.trim()) return;
    setProducts((prev) =>
      prev.map((p) => (p.id === selectedProduct.id ? { ...p, stock: p.stock - 1 } : p))
    );
    const tx = {
      id: Date.now().toString(36),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      price: selectedProduct.price,
      buyer: buyerName.trim(),
      date: new Date().toISOString(),
      method: method || "espèces",
    };
    setTransactions((prev) => [tx, ...prev]);
    setLastBuyerName(buyerName.trim());
    setPaymentStatus("success");
    showToast(`${selectedProduct.name} — Merci ${buyerName.trim().split(" ")[0]} !`);
    setTimeout(() => {
      setSelectedProduct(null);
      setPaymentStatus(null);
      setBuyerName("");
      setSumupCheckoutUrl(null);
      setQrDataUrl(null);
    }, 2500);
  };

  const cancelPayment = () => {
    setSelectedProduct(null);
    setPaymentStatus(null);
    setSumupCheckoutUrl(null);
    setQrDataUrl(null);
    setSumupError(null);
  };

  // ─── Admin login ───
  const handleAdminLogin = () => {
    if (pinInput === settings.adminPin) {
      setView("admin");
      setPinInput("");
      setPinError(false);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 1500);
    }
  };

  // ─── Admin: stock ───
  const adjustStock = (productId, delta) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: Math.max(0, p.stock + delta) } : p))
    );
  };

  const setStockDirect = (productId, val) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, stock: num } : p)));
    }
  };

  const addProduct = () => {
    if (!newProduct.name.trim()) return;
    const id = newProduct.name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString(36);
    setProducts((prev) => [...prev, { ...newProduct, id }]);
    setNewProduct({ name: "", emoji: "🥤", price: 1.0, stock: 20 });
    setShowAddProduct(false);
    showToast("Produit ajouté !");
  };

  const removeProduct = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    showToast("Produit supprimé", "info");
  };

  // ─── Stats ───
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTx = transactions.filter((t) => t.date.slice(0, 10) === todayStr);
  const todayRevenue = todayTx.reduce((s, t) => s + t.price, 0);
  const totalRevenue = transactions.reduce((s, t) => s + t.price, 0);
  const lowStock = products.filter((p) => p.stock <= 5);

  // Filtered transactions
  const filteredTx = filterBuyer
    ? transactions.filter((t) =>
        (t.buyer || "").toLowerCase().includes(filterBuyer.toLowerCase())
      )
    : transactions;

  // Unique buyers for quick filter
  const uniqueBuyers = [...new Set(transactions.map((t) => t.buyer).filter(Boolean))];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0f1c]">
        <div className="w-10 h-10 border-3 border-slate-700 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm mt-4">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-200 relative overflow-hidden">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl text-white font-semibold text-sm z-50 shadow-2xl animate-[slideDown_0.3s_ease]`}
          style={{ background: toast.type === "success" ? "#059669" : "#6366f1" }}
        >
          {toast.msg}
        </div>
      )}

      {/* ══════════ MEMBER VIEW ══════════ */}
      {view === "member" && (
        <div className="min-h-screen flex flex-col items-center px-4 pb-8">
          {/* Header */}
          <div className="text-center pt-10 pb-6 relative w-full">
            <div className="text-5xl mb-2 drop-shadow-lg">✈️</div>
            <h1 className="text-3xl font-extrabold text-amber-500 tracking-tight">{settings.clubName}</h1>
            <p className="text-slate-500 text-sm font-medium mt-1">Bar en libre-service</p>
            <button
              onClick={() => { setView("login"); setPinInput(""); }}
              className="absolute top-5 right-2 text-slate-600 text-xl p-2 hover:text-slate-400 transition"
            >
              ⚙️
            </button>
          </div>

          {/* Product grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg">
            {products.map((p) => {
              const out = p.stock <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => !out && handlePurchase(p)}
                  disabled={out}
                  className={`bg-[#131b2e] border border-[#1e2d4a] rounded-2xl py-6 px-3 flex flex-col items-center gap-1.5 transition-all duration-200 ${
                    out ? "opacity-40 cursor-not-allowed" : "hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 active:scale-95 cursor-pointer"
                  }`}
                >
                  <span className="text-4xl">{p.emoji}</span>
                  <span className="text-sm font-bold">{p.name}</span>
                  <span className="text-lg font-extrabold text-amber-500">{formatPrice(p.price)}</span>
                  {out && <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Épuisé</span>}
                  {!out && p.stock <= 5 && (
                    <span className="text-[10px] text-orange-400 bg-orange-950 px-2 py-0.5 rounded-full font-semibold">
                      Plus que {p.stock}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Payment modal ── */}
          {selectedProduct && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4" onClick={cancelPayment}>
              <div className="bg-gradient-to-br from-[#131b2e] to-[#0f172a] border border-[#1e2d4a] rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-[fadeIn_0.2s_ease]" onClick={(e) => e.stopPropagation()}>

                {paymentStatus === "pending" && (
                  <>
                    <span className="text-6xl block">{selectedProduct.emoji}</span>
                    <h2 className="text-xl font-bold mt-3">{selectedProduct.name}</h2>
                    <p className="text-3xl font-extrabold text-amber-500 mt-1">{formatPrice(selectedProduct.price)}</p>

                    <div className="h-px bg-[#1e2d4a] my-5" />

                    {/* Buyer name */}
                    <div className="flex flex-col gap-1.5 mb-5">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nom & Prénom</label>
                      <input
                        type="text"
                        placeholder="ex: Jean Dupont"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        autoFocus
                        className={`h-12 rounded-xl border-2 bg-[#0f172a] text-white text-center text-base font-semibold outline-none transition-colors ${
                          buyerName.trim() ? "border-amber-500" : "border-slate-700"
                        }`}
                      />
                      {!buyerName.trim() && (
                        <span className="text-[11px] text-amber-500 font-medium">Obligatoire pour valider</span>
                      )}
                    </div>

                    {/* Payment options */}
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Comment payer ?</p>

                    {/* SumUp QR Code section */}
                    <div className="flex flex-col items-center gap-3 mb-4">
                      {!sumupCheckoutUrl && !sumupLoading && (
                        <button
                          onClick={handlePayByCard}
                          disabled={!buyerName.trim()}
                          className={`w-full py-3.5 rounded-xl font-bold text-[15px] transition-all ${
                            buyerName.trim()
                              ? "bg-gradient-to-r from-blue-700 to-blue-500 text-white hover:from-blue-600 active:scale-95 cursor-pointer"
                              : "bg-slate-800 text-slate-600 cursor-not-allowed"
                          }`}
                        >
                          💳 Payer par carte (SumUp)
                        </button>
                      )}

                      {sumupLoading && (
                        <div className="flex items-center gap-2 py-4 text-slate-400">
                          <div className="w-5 h-5 border-2 border-slate-600 border-t-amber-500 rounded-full animate-spin" />
                          <span className="text-sm">Génération du QR code...</span>
                        </div>
                      )}

                      {sumupError && (
                        <div className="bg-red-950 border border-red-800 rounded-xl p-3 text-red-300 text-sm w-full">
                          {sumupError}
                        </div>
                      )}

                      {qrDataUrl && sumupCheckoutUrl && (
                        <div className="flex flex-col items-center gap-2 animate-[fadeIn_0.3s_ease]">
                          <div className="bg-white p-2 rounded-2xl shadow-xl">
                            <img src={qrDataUrl} alt="QR Code paiement" className="w-44 h-44" />
                          </div>
                          <span className="text-xs text-slate-500">Scannez avec votre téléphone</span>
                          <a
                            href={sumupCheckoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 underline"
                          >
                            Ou cliquez ici pour payer
                          </a>
                          <button
                            onClick={() => confirmPayment("carte")}
                            className="mt-2 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 text-white font-bold text-sm active:scale-95 cursor-pointer"
                          >
                            ✅ J'ai payé par carte
                          </button>
                        </div>
                      )}

                      {sumupCheckoutUrl && !qrDataUrl && (
                        <a
                          href={sumupCheckoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-500 text-white font-bold text-center block"
                        >
                          💳 Ouvrir le paiement SumUp
                        </a>
                      )}
                    </div>

                    <p className="text-slate-600 text-xs my-2">— ou —</p>

                    {/* Cash payment */}
                    <button
                      onClick={() => confirmPayment("espèces")}
                      disabled={!buyerName.trim()}
                      className={`w-full py-3.5 rounded-xl font-bold text-[15px] transition-all ${
                        buyerName.trim()
                          ? "bg-gradient-to-r from-emerald-800 to-emerald-600 text-white active:scale-95 cursor-pointer"
                          : "bg-slate-800 text-slate-600 cursor-not-allowed"
                      }`}
                    >
                      💰 J'ai payé en espèces
                    </button>

                    <button onClick={cancelPayment} className="mt-4 px-5 py-2.5 rounded-lg border border-slate-700 text-slate-400 text-sm font-semibold hover:border-slate-500 transition cursor-pointer">
                      Annuler
                    </button>
                  </>
                )}

                {paymentStatus === "success" && (
                  <div className="py-10 flex flex-col items-center gap-2 animate-[fadeIn_0.3s_ease]">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-400 flex items-center justify-center text-4xl text-white font-bold shadow-[0_0_40px_rgba(16,185,129,0.4)]">
                      ✓
                    </div>
                    <h2 className="text-2xl font-bold text-emerald-400 mt-2">Merci !</h2>
                    <p className="text-slate-400">Bon {selectedProduct.name.toLowerCase()} 😊</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-700 text-center mt-6 px-4">
            Paiement par carte via QR code SumUp • Espèces acceptées
          </p>
        </div>
      )}

      {/* ══════════ ADMIN LOGIN ══════════ */}
      {view === "login" && (
        <div className="min-h-screen flex flex-col items-center justify-center p-5">
          <button onClick={() => setView("member")} className="absolute top-4 left-4 text-slate-500 text-sm font-semibold hover:text-slate-300 cursor-pointer">
            ← Retour
          </button>
          <div className="flex flex-col items-center gap-5">
            <span className="text-5xl">🔒</span>
            <h2 className="text-xl font-bold">Accès Trésorier</h2>
            <div className="grid grid-cols-3 gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"].map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    if (k === "C") setPinInput("");
                    else if (k === "OK") handleAdminLogin();
                    else setPinInput((p) => p + k);
                  }}
                  className={`w-16 h-14 rounded-xl border text-xl font-bold flex items-center justify-center transition cursor-pointer ${
                    k === "OK"
                      ? "bg-gradient-to-r from-amber-700 to-amber-500 text-white border-transparent"
                      : k === "C"
                      ? "bg-[#131b2e] border-red-900 text-red-500"
                      : "bg-[#131b2e] border-[#1e2d4a] text-slate-200 hover:border-slate-600"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    pinInput.length > i
                      ? pinError ? "bg-red-500 scale-125" : "bg-amber-500"
                      : "bg-slate-700"
                  }`}
                />
              ))}
            </div>
            {pinError && <p className="text-red-500 text-sm font-semibold">Code incorrect</p>}
          </div>
        </div>
      )}

      {/* ══════════ ADMIN VIEW ══════════ */}
      {view === "admin" && (
        <div className="min-h-screen p-4 pb-10 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setView("member")} className="text-slate-500 text-sm font-semibold hover:text-slate-300 cursor-pointer">
              ← Retour bar
            </button>
            <h1 className="text-xl font-extrabold text-amber-500">Gestion {settings.clubName}</h1>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
            {[
              { val: formatPrice(todayRevenue), label: "Aujourd'hui" },
              { val: todayTx.length, label: "Ventes du jour" },
              { val: formatPrice(totalRevenue), label: "Total cumulé" },
              ...(lowStock.length > 0
                ? [{ val: `⚠ ${lowStock.length}`, label: "Stock faible", alert: true }]
                : []),
            ].map((s, i) => (
              <div
                key={i}
                className={`rounded-2xl p-3.5 text-center border ${
                  s.alert
                    ? "bg-red-950 border-red-800"
                    : "bg-[#131b2e] border-[#1e2d4a]"
                }`}
              >
                <span className="block text-xl font-extrabold text-amber-500">{s.val}</span>
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4">
            {[
              { key: "stock", label: "📦 Stock" },
              { key: "history", label: "📋 Historique" },
              { key: "settings", label: "⚙ Config" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveAdminTab(tab.key)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                  activeAdminTab === tab.key
                    ? "bg-[#1e2d4a] text-amber-500"
                    : "bg-[#131b2e] text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Stock tab ── */}
          {activeAdminTab === "stock" && (
            <div className="flex flex-col gap-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 bg-[#131b2e] border border-[#1e2d4a] rounded-xl px-3.5 py-2.5">
                  <span className="text-2xl w-9 text-center">{p.emoji}</span>
                  <div className="flex-1 flex flex-col">
                    <span className="text-sm font-bold">{p.name}</span>
                    <span className="text-xs text-amber-500 font-semibold">{formatPrice(p.price)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => adjustStock(p.id, -1)} className="w-8 h-8 rounded-lg border border-slate-700 bg-[#0f172a] text-red-500 text-lg font-bold flex items-center justify-center cursor-pointer">−</button>
                    <input
                      type="number"
                      value={p.stock}
                      onChange={(e) => setStockDirect(p.id, e.target.value)}
                      className="w-12 h-8 rounded-lg border border-slate-700 bg-[#0f172a] text-white text-sm font-bold text-center outline-none"
                    />
                    <button onClick={() => adjustStock(p.id, 1)} className="w-8 h-8 rounded-lg border border-slate-700 bg-[#0f172a] text-emerald-500 text-lg font-bold flex items-center justify-center cursor-pointer">+</button>
                  </div>
                  <button onClick={() => removeProduct(p.id)} className="opacity-40 hover:opacity-80 text-base cursor-pointer">🗑</button>
                </div>
              ))}

              {!showAddProduct ? (
                <button onClick={() => setShowAddProduct(true)} className="border-2 border-dashed border-[#1e2d4a] text-slate-500 py-3.5 rounded-xl text-sm font-semibold hover:border-slate-600 transition cursor-pointer">
                  + Ajouter un produit
                </button>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-3">
                  <input placeholder="😀" value={newProduct.emoji} onChange={(e) => setNewProduct({ ...newProduct, emoji: e.target.value })} className="w-14 h-9 rounded-lg border border-slate-700 bg-[#0f172a] text-white text-center text-2xl outline-none" />
                  <input placeholder="Nom" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="flex-1 h-9 rounded-lg border border-slate-700 bg-[#0f172a] text-white text-sm px-2.5 outline-none" />
                  <input type="number" step="0.1" placeholder="Prix" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })} className="w-16 h-9 rounded-lg border border-slate-700 bg-[#0f172a] text-white text-sm text-center outline-none" />
                  <input type="number" placeholder="Stock" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value, 10) || 0 })} className="w-16 h-9 rounded-lg border border-slate-700 bg-[#0f172a] text-white text-sm text-center outline-none" />
                  <button onClick={addProduct} className="w-9 h-9 rounded-lg bg-emerald-600 text-white text-lg font-bold cursor-pointer">✓</button>
                  <button onClick={() => setShowAddProduct(false)} className="w-9 h-9 rounded-lg bg-red-900 text-red-300 text-lg font-bold cursor-pointer">✕</button>
                </div>
              )}
            </div>
          )}

          {/* ── History tab ── */}
          {activeAdminTab === "history" && (
            <div className="flex flex-col gap-2">
              {/* Filter by buyer */}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="🔍 Filtrer par nom..."
                  value={filterBuyer}
                  onChange={(e) => setFilterBuyer(e.target.value)}
                  className="flex-1 h-10 rounded-xl border border-slate-700 bg-[#131b2e] text-white text-sm px-3 outline-none focus:border-amber-500 transition"
                />
                {filterBuyer && (
                  <button onClick={() => setFilterBuyer("")} className="text-xs text-slate-400 hover:text-white cursor-pointer">✕ Effacer</button>
                )}
              </div>

              {/* Quick buyer pills */}
              {uniqueBuyers.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {uniqueBuyers.slice(0, 10).map((b) => (
                    <button
                      key={b}
                      onClick={() => setFilterBuyer(b)}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition cursor-pointer ${
                        filterBuyer === b
                          ? "bg-amber-500 text-black"
                          : "bg-[#1e2d4a] text-slate-400 hover:text-white"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}

              {filteredTx.length === 0 ? (
                <p className="text-slate-600 text-center py-10 text-sm">
                  {filterBuyer ? "Aucune transaction pour ce nom" : "Aucune transaction"}
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredTx.slice(0, 100).map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3.5 py-2.5">
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-sm font-semibold">{tx.productName}</span>
                        <span className="text-[11px] text-slate-500">
                          {tx.buyer || "—"} • {tx.method === "espèces" ? "💰" : "💳"} {tx.method}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-amber-500 min-w-[60px] text-right">{formatPrice(tx.price)}</span>
                      <span className="text-[11px] text-slate-500 min-w-[110px] text-right">{formatDate(tx.date)}</span>
                    </div>
                  ))}
                </div>
              )}

              {transactions.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("Effacer tout l'historique ? Cette action est irréversible.")) {
                      setTransactions([]);
                      showToast("Historique effacé", "info");
                    }
                  }}
                  className="self-center mt-2 px-4 py-2.5 rounded-lg bg-[#1c1917] border border-red-900 text-red-300 text-sm font-semibold hover:bg-red-950 transition cursor-pointer"
                >
                  🗑 Effacer l'historique
                </button>
              )}
            </div>
          )}

          {/* ── Settings tab ── */}
          {activeAdminTab === "settings" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nom du club</label>
                <input value={settings.clubName} onChange={(e) => setSettings({ ...settings, clubName: e.target.value })} className="h-10 rounded-xl border border-slate-700 bg-[#131b2e] text-white text-sm px-3.5 outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Code PIN admin</label>
                <input value={settings.adminPin} onChange={(e) => setSettings({ ...settings, adminPin: e.target.value })} className="h-10 rounded-xl border border-slate-700 bg-[#131b2e] text-white text-sm px-3.5 outline-none" maxLength={6} />
              </div>

              <div className="h-px bg-[#1e2d4a] my-3" />

              <h3 className="text-base font-bold">🔗 Intégration SumUp</h3>
              <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-4 text-sm text-slate-400 leading-relaxed">
                <p className="font-semibold text-slate-200 mb-2">Comment configurer :</p>
                <p>1. Créez un compte sur <span className="text-amber-500">developer.sumup.com</span></p>
                <p>2. Créez une application et récupérez votre <strong>API Key</strong> et <strong>Merchant Code</strong></p>
                <p>3. Dans Vercel, allez dans Settings → Environment Variables</p>
                <p>4. Ajoutez <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-400">SUMUP_API_KEY</code> et <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-400">SUMUP_MERCHANT_CODE</code></p>
                <p>5. Ajoutez <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-400">NEXT_PUBLIC_APP_URL</code> avec l'URL de votre site</p>
                <p className="mt-3 text-slate-500">Les QR codes de paiement seront générés automatiquement pour chaque achat.</p>
              </div>

              <div className="h-px bg-[#1e2d4a] my-3" />

              <h3 className="text-base font-bold">📊 Export des données</h3>
              <button
                onClick={() => {
                  const csv = [
                    "Date,Produit,Prix,Acheteur,Méthode",
                    ...transactions.map(t =>
                      `${t.date},"${t.productName}",${t.price},"${t.buyer || ""}",${t.method}`
                    )
                  ].join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `aeroclub-transactions-${todayStr}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast("Export CSV téléchargé !");
                }}
                className="self-start px-4 py-2.5 rounded-lg bg-[#1e2d4a] text-amber-500 text-sm font-semibold hover:bg-[#253550] transition cursor-pointer"
              >
                📥 Exporter en CSV
              </button>

              <div className="h-px bg-[#1e2d4a] my-3" />

              <button
                onClick={() => {
                  if (confirm("Remettre tous les produits par défaut ?")) {
                    setProducts(DEFAULT_PRODUCTS);
                    showToast("Produits réinitialisés", "info");
                  }
                }}
                className="self-start px-4 py-2.5 rounded-lg bg-[#1c1917] border border-red-900 text-red-300 text-sm font-semibold cursor-pointer"
              >
                🔄 Réinitialiser les produits
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
