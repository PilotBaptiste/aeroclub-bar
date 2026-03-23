"use client";
import { useState, useEffect, useCallback, useRef } from "react";

interface Product {
  id: string;
  name: string;
  emoji: string;
  price: number;
  cost: number;
  stock: number;
  stockReserve?: number;
  legacyStock?: number;
  legacyPrice?: number;
  archived?: boolean;
}

const EMOJI_CATEGORIES = [
  { label: "🥤 Boissons", emojis: ["🥤","🧃","💧","🫙","🧋","🍵","☕","🫖","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🫗","🧊","🍾","🥛"] },
  { label: "🍦 Glaces", emojis: ["🍦","🍧","🍨","🍡","🧁","🍰","🎂","🍩","🍪","🥧","🍮","🍫","🍬","🍭","🍡"] },
  { label: "🍫 Snacks", emojis: ["🍫","🍬","🍭","🍿","🥜","🌰","🥐","🥖","🥨","🥯","🧇","🍞","🥪","🌮","🌯","🥙","🧆","🫔"] },
  { label: "🍎 Fruits", emojis: ["🍎","🍊","🍋","🍇","🍓","🫐","🍌","🍉","🍑","🍒","🥝","🍍","🥭","🍐"] },
  { label: "📦 Divers", emojis: ["📦","🎁","⭐","🏷️","🛒","💊","🩺","🔑","🎫","🎟️","🪙","💵","🧴","🧻"] },
];
interface Procurement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  method: "especes" | "carte";
}
interface CartItem {
  product: Product;
  qty: number;
}
interface Transaction {
  id: string;
  items: string;
  total: number;
  totalCost: number;
  buyer: string;
  date: string;
  method: string;
  amountPaid?: number;
}
interface MemberAccount {
  name: string;
  balance: number;
}
interface Suggestion {
  id: string;
  text: string;
  author: string;
  date: string;
}
interface Settings {
  clubName: string;
  adminPin: string;
  bureauPin?: string;
  cashInBox?: number;
  cbReceived?: number;
  cashInitialFund?: number;
  cbInitialFund?: number;
}

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "cafe",
    name: "Cafe",
    emoji: "\u2615",
    price: 0.5,
    cost: 0.15,
    stock: 50,
    stockReserve: 0,
  },
  {
    id: "eau",
    name: "Eau",
    emoji: "\uD83D\uDCA7",
    price: 0.5,
    cost: 0.1,
    stock: 30,
    stockReserve: 0,
  },
  {
    id: "coca",
    name: "Coca-Cola",
    emoji: "\uD83E\uDD64",
    price: 1.0,
    cost: 0.45,
    stock: 24,
    stockReserve: 0,
  },
  {
    id: "orangina",
    name: "Orangina",
    emoji: "\uD83C\uDF4A",
    price: 1.0,
    cost: 0.45,
    stock: 24,
    stockReserve: 0,
  },
  {
    id: "biere",
    name: "Biere",
    emoji: "\uD83C\uDF7A",
    price: 1.5,
    cost: 0.8,
    stock: 20,
    stockReserve: 0,
  },
  {
    id: "snack",
    name: "Snack",
    emoji: "\uD83C\uDF6B",
    price: 1.0,
    cost: 0.5,
    stock: 15,
    stockReserve: 0,
  },
];

const DEFAULT_SETTINGS: Settings = { clubName: "Aero-Club", adminPin: "1234", bureauPin: "1215" };

function formatPrice(p: number) {
  return p.toFixed(2).replace(".", ",") + " \u20AC";
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── API helpers for Vercel KV ───
async function loadFromServer() {
  try {
    const res = await fetch("/api/data");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function saveToServer(key: string, value: unknown): Promise<boolean> {
  try {
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    return res.ok;
  } catch (e) {
    console.error("Save error:", e);
    return false;
  }
}

export default function AeroClubBar() {
  const [view, setView] = useState("member");
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<{
    items: CartItem[];
    total: number;
    buyer: string;
    method: string;
    lockType: "cafe" | "frigo" | "both";
  } | null>(null);
  const [sumupLoading, setSumupLoading] = useState(false);
  const [sumupError, setSumupError] = useState<string | null>(null);
  const [sumupCheckoutId, setSumupCheckoutId] = useState<string | null>(null);
  const [sumupPolling, setSumupPolling] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    emoji: "\uD83E\uDD64",
    price: 1.0,
    cost: 0.5,
    stock: 20,
    stockReserve: 0,
  });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeAdminTab, setActiveAdminTab] = useState("stock");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(
    null,
  );
  const [filterBuyer, setFilterBuyer] = useState("");
  const [filterMethod, setFilterMethod] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [members, setMembers] = useState<MemberAccount[]>([]);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionAuthor, setSuggestionAuthor] = useState("");
  const [cashAmountInput, setCashAmountInput] = useState("");
  const [showCashFlow, setShowCashFlow] = useState(false);
  const [_cartCooldowns, setCartCooldowns] = useState<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const [cartExpiries, setCartExpiries] = useState<Record<string, number>>({});
  const [, setCartTick] = useState(0);
  const cartTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showBureauPin, setShowBureauPin] = useState(false);
  const [bureauPinInput, setBureauPinInput] = useState("");
  const [bureauPinError, setBureauPinError] = useState(false);
  const [bureauUnlocked, setBureauUnlocked] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [restockForm, setRestockForm] = useState<{ qty: number; newPrice: number; newCost: number; method: "especes" | "carte" }>({ qty: 1, newPrice: 0, newCost: 0, method: "especes" });
  const [lockRetriggerCountdown, setLockRetriggerCountdown] = useState<number | null>(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState<"new" | "edit" | null>(null);
  const [emojiPickerCategory, setEmojiPickerCategory] = useState(0);
  const saveTimeout = useRef<Record<string, NodeJS.Timeout>>({});
  const hasLoaded = useRef(false);
  const sumupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sumupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockRetriggerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Debounced save to avoid too many API calls
  const debouncedSave = useCallback((key: string, value: unknown) => {
    if (!hasLoaded.current) return; // ← AJOUTER CETTE LIGNE
    if (saveTimeout.current[key]) clearTimeout(saveTimeout.current[key]);
    setSaveStatus("saving");
    saveTimeout.current[key] = setTimeout(async () => {
      const ok = await saveToServer(key, value);
      setSaveStatus(ok ? "idle" : "error");
    }, 1000); // ← CHANGER 500 en 1000
  }, []);

  // Load data from server
  useEffect(() => {
    (async () => {
      const data = await loadFromServer();
      if (data) {
        if (data.products) setProducts(data.products);
        if (data.transactions) setTransactions(data.transactions);
        if (data.settings) setSettings(data.settings);
        if (data.suggestions) setSuggestions(data.suggestions);
        if (data.members) setMembers(data.members);
        if (data.procurements) setProcurements(data.procurements);
      }
      setLoading(false);
      if (data) {
        setTimeout(() => {
          hasLoaded.current = true;
        }, 2000);
      }
    })();
  }, []);

  // Save on change
  useEffect(() => {
    if (!loading) debouncedSave("aeroclub-products", products);
  }, [products, loading, debouncedSave]);
  useEffect(() => {
    if (!loading) debouncedSave("aeroclub-transactions", transactions);
  }, [transactions, loading, debouncedSave]);
  useEffect(() => {
    if (!loading) debouncedSave("aeroclub-settings", settings);
  }, [settings, loading, debouncedSave]);
  useEffect(() => {
    if (!loading) debouncedSave("aeroclub-suggestions", suggestions);
  }, [suggestions, loading, debouncedSave]);
  useEffect(() => {
    if (!loading) debouncedSave("aeroclub-members", members);
  }, [members, loading, debouncedSave]);
  useEffect(() => {
    if (!loading) debouncedSave("aeroclub-procurements", procurements);
  }, [procurements, loading, debouncedSave]);

  // Nettoyer les timers SumUp et le clearCart au démontage du composant
  useEffect(() => {
    return () => {
      if (sumupIntervalRef.current) clearInterval(sumupIntervalRef.current);
      if (sumupTimeoutRef.current) clearTimeout(sumupTimeoutRef.current);
      if (clearCartTimeoutRef.current) clearTimeout(clearCartTimeoutRef.current);
      if (cartTickRef.current) clearInterval(cartTickRef.current);
      if (lockRetriggerTimerRef.current) clearInterval(lockRetriggerTimerRef.current);
    };
  }, []);

  // Auto-reload toutes les 10 min si l'app est idle (iPad non surveillé)
  useEffect(() => {
    const timer = setInterval(() => {
      if (cart.length === 0 && !showCheckout && view !== "admin") {
        window.location.reload();
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [cart.length, showCheckout, view]);

  // Tick interval pour le countdown du panier
  useEffect(() => {
    if (cart.length > 0) {
      if (!cartTickRef.current) {
        cartTickRef.current = setInterval(() => setCartTick((t) => t + 1), 1000);
      }
    } else {
      if (cartTickRef.current) { clearInterval(cartTickRef.current); cartTickRef.current = null; }
      setCartExpiries({});
    }
  }, [cart.length]);

  const showToast = useCallback((msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // FIFO : vend l'ancien stock au legacyPrice d'abord, puis au price courant
  const getFifoTotal = (product: Product, qty: number): number => {
    const legacyQty = Math.min(product.legacyStock || 0, qty);
    const regularQty = qty - legacyQty;
    return legacyQty * (product.legacyPrice || product.price) + regularQty * product.price;
  };

  const cartTotal = cart.reduce((s, i) => s + getFifoTotal(i.product, i.qty), 0);
  const cartTotalCost = cart.reduce(
    (s, i) => s + (i.product.cost || 0) * i.qty,
    0,
  );
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // Normalize a full name by sorting tokens alphabetically so
  // "DUPONT Jean", "Jean Dupont", "jean dupont" all map to the same key
  const normalizeNameFuzzy = (n: string) =>
    n.trim().toLowerCase().split(/\s+/).sort().join(" ");

  // Autocomplete suggestions: names that contain any token of the input
  const getNameSuggestions = (input: string): string[] => {
    if (!input.trim() || input.trim().length < 2) return [];
    const tokens = input.trim().toLowerCase().split(/\s+/);
    // Membres en premier pour privilegier leur graphie canonique
    const allNames = [
      ...members.map((m) => m.name),
      ...transactions.map((t) => t.buyer).filter(Boolean),
    ];
    // Déduplication insensible à la casse et à l'ordre des tokens
    const seen = new Map<string, string>();
    for (const n of allNames) {
      const key = normalizeNameFuzzy(n);
      if (!seen.has(key)) seen.set(key, n);
    }
    return [...seen.values()]
      .filter((n) => {
        const nameToks = n.toLowerCase().split(/\s+/);
        // Chaque token de l'input doit correspondre au DÉBUT d'un token du nom
        return tokens.every((tok) => nameToks.some((nt) => nt.startsWith(tok)));
      })
      .slice(0, 5);
  };

  const getMemberBalance = (name: string): number => {
    const key = normalizeNameFuzzy(name);
    const m = members.find((m) => normalizeNameFuzzy(m.name) === key);
    return m ? m.balance : 0;
  };

  const updateMemberBalance = (name: string, delta: number) => {
    const key = normalizeNameFuzzy(name);
    // Use the canonical name already stored if found
    const canonical = members.find((m) => normalizeNameFuzzy(m.name) === key);
    const storeName = canonical ? canonical.name : name.trim();
    setMembers((prev) => {
      const existing = prev.find((m) => normalizeNameFuzzy(m.name) === key);
      if (existing) {
        return prev.map((m) =>
          normalizeNameFuzzy(m.name) === key
            ? {
                ...m,
                name: storeName,
                balance: Math.round((m.balance + delta) * 100) / 100,
              }
            : m,
        );
      }
      if (delta > 0) {
        return [
          ...prev,
          { name: storeName, balance: Math.round(delta * 100) / 100 },
        ];
      }
      return prev;
    });
  };

  const addToCart = (p: Product) => {
    if (p.stock <= 0) return;
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === p.id);
      if (ex) {
        if (ex.qty >= p.stock) return prev;
        return prev.map((c) =>
          c.product.id === p.id ? { ...c, qty: c.qty + 1 } : c,
        );
      }
      return [...prev, { product: p, qty: 1 }];
    });

    // Reset the 30s cooldown for this product
    const expiryTs = Date.now() + 30000;
    setCartExpiries((prev) => ({ ...prev, [p.id]: expiryTs }));
    setCartCooldowns((prev) => {
      if (prev[p.id]) clearTimeout(prev[p.id]);
      const timer = setTimeout(() => {
        setCart((c) => c.filter((item) => item.product.id !== p.id));
        setCartCooldowns((cd) => {
          const next = { ...cd };
          delete next[p.id];
          return next;
        });
        setCartExpiries((ce) => {
          const next = { ...ce };
          delete next[p.id];
          return next;
        });
      }, 30000);
      return { ...prev, [p.id]: timer };
    });
  };

  const removeFromCart = (pid: string) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === pid);
      if (ex && ex.qty > 1)
        return prev.map((c) =>
          c.product.id === pid ? { ...c, qty: c.qty - 1 } : c,
        );
      // fully removed — clear cooldown and expiry
      setCartCooldowns((cd) => {
        if (cd[pid]) clearTimeout(cd[pid]);
        const next = { ...cd };
        delete next[pid];
        return next;
      });
      setCartExpiries((ce) => {
        const next = { ...ce };
        delete next[pid];
        return next;
      });
      return prev.filter((c) => c.product.id !== pid);
    });
  };

  const clearCart = () => {
    // Clear all cooldown timers
    setCartCooldowns((cd) => {
      Object.values(cd).forEach((t) => clearTimeout(t));
      return {};
    });
    setCart([]);
    setShowCheckout(false);
    setPaymentStatus(null);
    setSumupCheckoutId(null);
    setSumupPolling(false);
    setSumupError(null);
    setBureauUnlocked(false);
    setShowBureauPin(false);
    setBureauPinInput("");
  };
  const getCartQty = (pid: string) => {
    const i = cart.find((c) => c.product.id === pid);
    return i ? i.qty : 0;
  };

  const confirmRestock = () => {
    if (!restockingProduct || restockForm.qty <= 0) return;
    const p = restockingProduct;
    const totalCost = Math.round(restockForm.qty * restockForm.newCost * 100) / 100;
    const priceChanged = restockForm.newPrice !== p.price;

    setProducts((prev) =>
      prev.map((x) => {
        if (x.id !== p.id) return x;
        const existingLegacy = x.legacyStock || 0;
        const existingLegacyPrice = x.legacyPrice;
        // Si le prix change : tout le stock courant + legacy devient legacy au prix courant
        const newLegacyStock = priceChanged
          ? x.stock + existingLegacy
          : existingLegacy;
        const newLegacyPrice = priceChanged
          ? x.price
          : existingLegacyPrice;
        return {
          ...x,
          stock: x.stock + restockForm.qty,
          cost: restockForm.newCost,
          price: restockForm.newPrice,
          legacyStock: newLegacyStock || undefined,
          legacyPrice: newLegacyPrice || undefined,
        };
      }),
    );

    const entry: Procurement = {
      id: Date.now().toString(36),
      date: new Date().toISOString(),
      productId: p.id,
      productName: p.name,
      qty: restockForm.qty,
      unitCost: restockForm.newCost,
      totalCost,
      method: restockForm.method,
    };
    setProcurements((prev) => [entry, ...prev]);

    if (restockForm.method === "especes") {
      setSettings((prev) => ({
        ...prev,
        cashInBox: Math.round(((prev.cashInBox || 0) - totalCost) * 100) / 100,
      }));
    } else {
      setSettings((prev) => ({
        ...prev,
        cbReceived: Math.round(((prev.cbReceived || 0) - totalCost) * 100) / 100,
      }));
    }

    showToast(
      "Réappro " + p.name + " : +" + restockForm.qty + " unités — " + formatPrice(totalCost) + " débité",
    );
    setRestockingProduct(null);
  };

  const createSumUpCheckout = async () => {
    if (!buyerName.trim() || cartTotal <= 0) return;
    setSumupLoading(true);
    setSumupError(null);
    setSumupCheckoutId(null);
    setSumupPolling(false);
    try {
      const desc = cart.map((c) => c.qty + "x " + c.product.name).join(", ");
      const res = await fetch("/api/sumup-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: cartTotal,
          description: desc,
          buyer: buyerName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSumupError(data.error || "Erreur paiement");
        return;
      }
      setSumupCheckoutId(data.checkoutId || "pending");
      setSumupPolling(true);
      // Nettoyer un éventuel interval précédent
      if (sumupIntervalRef.current) clearInterval(sumupIntervalRef.current);
      // Polling toutes les 2 secondes
      sumupIntervalRef.current = setInterval(async () => {
        try {
          const cid = data.checkoutId;
          const url = "/api/sumup-webhook" + (cid ? "?checkoutId=" + cid : "");
          const poll = await fetch(url);
          const result = await poll.json();
          if (result.status === "success") {
            if (sumupIntervalRef.current) clearInterval(sumupIntervalRef.current);
            sumupIntervalRef.current = null;
            setSumupPolling(false);
            confirmPayment("carte");
          } else if (result.status === "failed") {
            if (sumupIntervalRef.current) clearInterval(sumupIntervalRef.current);
            sumupIntervalRef.current = null;
            setSumupPolling(false);
            setSumupError("Paiement refusé ou annulé. Réessayez.");
            setSumupCheckoutId(null);
          }
          // "pending" → on continue de poller
        } catch {
          /* continue polling */
        }
      }, 2000);
      // Arrêt automatique après 3 minutes
      if (sumupTimeoutRef.current) clearTimeout(sumupTimeoutRef.current);
      sumupTimeoutRef.current = setTimeout(() => {
        sumupTimeoutRef.current = null;
        if (sumupIntervalRef.current) clearInterval(sumupIntervalRef.current);
        sumupIntervalRef.current = null;
        setSumupPolling(false);
      }, 180000);
    } catch {
      setSumupError("Impossible de contacter le terminal.");
    } finally {
      setSumupLoading(false);
    }
  };

  const confirmPayment = (method: string, amountPaid?: number) => {
    if (!buyerName.trim() || cart.length === 0) return;
    // Utiliser le nom canonique du membre si connu, sinon le nom tel que tapé
    const buyerKey = normalizeNameFuzzy(buyerName.trim());
    const canonicalMember = members.find(
      (m) => normalizeNameFuzzy(m.name) === buyerKey,
    );
    const canonicalBuyer = canonicalMember
      ? canonicalMember.name
      : buyerName.trim();
    // Calculer les produits mis à jour AVANT setProducts pour éviter la race condition (dépletion FIFO)
    let updatedProducts = [...products];
    for (const item of cart) {
      updatedProducts = updatedProducts.map((p) => {
        if (p.id !== item.product.id) return p;
        let remaining = item.qty;
        let newLegacyStock = p.legacyStock || 0;
        const fromLegacy = Math.min(newLegacyStock, remaining);
        newLegacyStock = Math.max(0, newLegacyStock - fromLegacy);
        remaining -= fromLegacy;
        return { ...p, stock: Math.max(0, p.stock - remaining), legacyStock: newLegacyStock };
      });
    }
    setProducts(updatedProducts);
    // Send Telegram alerts ONLY for products in this cart that drop to low stock
    const cartProductIds = cart.map((c) => c.product.id);
    for (const p of updatedProducts) {
      if (!cartProductIds.includes(p.id)) continue;
      if (p.stock > 0 && p.stock <= 5) {
        fetch("/api/alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productName: p.name, stock: p.stock }),
        }).catch(() => {});
      }
      if (p.stock === 0) {
        fetch("/api/alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productName: p.name, stock: 0 }),
        }).catch(() => {});
      }
    }

    // Handle member balance
    if (method === "avoir") {
      updateMemberBalance(canonicalBuyer, -cartTotal);
    } else if (method === "especes" && amountPaid !== undefined) {
      const change = amountPaid - cartTotal;
      if (change > 0) {
        updateMemberBalance(canonicalBuyer, change);
      }
      // Update cash in box
      setSettings((prev) => ({
        ...prev,
        cashInBox: Math.round(((prev.cashInBox || 0) + amountPaid) * 100) / 100,
      }));
    } else if (method === "carte") {
      setSettings((prev) => ({
        ...prev,
        cbReceived:
          Math.round(((prev.cbReceived || 0) + cartTotal) * 100) / 100,
      }));
    }

    // Deverrouille la bonne serrure selon le panier
    const hasCafe = cart.some(
      (c) =>
        c.product.name.toLowerCase().includes("cafe") ||
        c.product.name.toLowerCase().includes("café"),
    );
    const hasOther = cart.some(
      (c) =>
        !c.product.name.toLowerCase().includes("cafe") &&
        !c.product.name.toLowerCase().includes("café"),
    );
    if (hasCafe && hasOther)
      fetch("/api/fridge?action=trigger&lock=both").catch(() => {});
    else if (hasCafe)
      fetch("/api/fridge?action=trigger&lock=cafe").catch(() => {});
    else fetch("/api/fridge?action=trigger&lock=frigo").catch(() => {});

    const tx: Transaction = {
      id: Date.now().toString(36),
      items: cart.map((c) => c.qty + "x " + c.product.name).join(", "),
      total: cartTotal,
      totalCost: cartTotalCost,
      buyer: canonicalBuyer,
      date: new Date().toISOString(),
      method,
      amountPaid,
    };
    setTransactions((prev) => [tx, ...prev]);
    setLastOrder({
      items: [...cart],
      total: cartTotal,
      buyer: canonicalBuyer,
      method,
      lockType: hasCafe && hasOther ? "both" : hasCafe ? "cafe" : "frigo",
    });
    setPaymentStatus("success");
    showToast("Merci " + canonicalBuyer.split(" ")[0] + " !");
    // Annuler un éventuel timeout précédent avant d'en créer un nouveau
    if (clearCartTimeoutRef.current) clearTimeout(clearCartTimeoutRef.current);
    clearCartTimeoutRef.current = setTimeout(() => {
      clearCartTimeoutRef.current = null;
      clearCart();
      setBuyerName("");
      setLastOrder(null);
      setShowCashFlow(false);
      setCashAmountInput("");
      setLockRetriggerCountdown(null);
      if (lockRetriggerTimerRef.current) { clearInterval(lockRetriggerTimerRef.current); lockRetriggerTimerRef.current = null; }
    }, 20000);
  };

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
  const adjustStock = (pid: string, d: number) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === pid ? { ...p, stock: Math.max(0, p.stock + d) } : p,
      ),
    );
  };
  const setStockDirect = (pid: string, v: string) => {
    const n = parseInt(v, 10);
    if (!isNaN(n) && n >= 0)
      setProducts((prev) =>
        prev.map((p) => (p.id === pid ? { ...p, stock: n } : p)),
      );
  };
  const addProduct = () => {
    if (!newProduct.name.trim()) return;
    const id =
      newProduct.name.toLowerCase().replace(/\s+/g, "-") +
      "-" +
      Date.now().toString(36);
    setProducts((prev) => [...prev, { ...newProduct, id }]);
    setNewProduct({
      name: "",
      emoji: "\uD83E\uDD64",
      price: 1.0,
      cost: 0.5,
      stock: 20,
      stockReserve: 0,
    });
    setShowAddProduct(false);
    showToast("Produit ajoute !");
  };
  const removeProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    showToast("Produit supprime", "info");
  };
  const saveEditProduct = () => {
    if (!editingProduct || !editingProduct.name.trim()) return;
    setProducts((prev) =>
      prev.map((p) => (p.id === editingProduct.id ? { ...editingProduct } : p)),
    );
    setEditingProduct(null);
    showToast("Produit modifie !");
  };

  const submitSuggestion = () => {
    if (!suggestionText.trim()) return;
    const s: Suggestion = {
      id: Date.now().toString(36),
      text: suggestionText.trim(),
      author: suggestionAuthor.trim() || "Anonyme",
      date: new Date().toISOString(),
    };
    setSuggestions((prev) => [s, ...prev]);
    setSuggestionText("");
    setSuggestionAuthor("");
    setShowSuggestionModal(false);
    showToast("Merci pour votre suggestion !");
  };

  const renameMember = (oldName: string) => {
    const newName = prompt("Nouveau nom pour " + oldName + " :", oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();
    const oldKey = normalizeNameFuzzy(oldName);
    // Rename in members
    setMembers((prev) => {
      const exists = prev.find((m) => normalizeNameFuzzy(m.name) === oldKey);
      if (exists)
        return prev.map((m) =>
          normalizeNameFuzzy(m.name) === oldKey ? { ...m, name: trimmed } : m,
        );
      return prev; // présent uniquement dans les transactions → pas de nouveau membre
    });
    // Rename in ALL transactions (match toutes les variantes : casse, ordre tokens)
    setTransactions((prev) =>
      prev.map((t) =>
        normalizeNameFuzzy(t.buyer) === oldKey ? { ...t, buyer: trimmed } : t,
      ),
    );
    showToast("Membre renomme : " + trimmed);
  };

  const deleteMember = (name: string) => {
    const msg =
      "Supprimer " +
      name +
      " ? Cela supprimera aussi son avoir et son historique de transactions.";
    if (!confirm(msg)) return;
    const nameKey = normalizeNameFuzzy(name);
    setMembers((prev) =>
      prev.filter((m) => normalizeNameFuzzy(m.name) !== nameKey),
    );
    setTransactions((prev) =>
      prev.filter((t) => normalizeNameFuzzy(t.buyer || "") !== nameKey),
    );
    showToast("Membre et transactions supprimes", "info");
  };

  const deleteSuggestion = (id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  const deleteTransaction = (tx: Transaction) => {
    if (!confirm("Supprimer cette vente ? Le stock sera restaure.")) return;
    const itemParts = tx.items.split(", ");
    setProducts((prev) => {
      let u = [...prev];
      for (const part of itemParts) {
        const match = part.match(/^(\d+)x (.+)$/);
        if (match) {
          const qty = parseInt(match[1], 10);
          const name = match[2];
          u = u.map((p) =>
            p.name === name ? { ...p, stock: p.stock + qty } : p,
          );
        }
      }
      return u;
    });
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    showToast("Vente supprimee, stock restaure", "info");
  };

  const editTransaction = (tx: Transaction) => {
    const newAmount = prompt(
      "Nouveau montant pour cette vente (actuel: " + tx.total + ") :",
      String(tx.total),
    );
    if (newAmount === null) return;
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount < 0) return;
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === tx.id
          ? { ...t, total: amount, method: amount === 0 ? "offert" : t.method }
          : t,
      ),
    );
    showToast("Transaction modifiee : " + formatPrice(amount));
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTx = transactions.filter((t) => t.date.slice(0, 10) === todayStr);
  const todayRevenue = todayTx.reduce((s, t) => s + t.total, 0);
  const totalRevenue = transactions.reduce((s, t) => s + t.total, 0);
  const totalCost = transactions.reduce((s, t) => s + (t.totalCost || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const marginPct =
    totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
  const todayCost = todayTx.reduce((s, t) => s + (t.totalCost || 0), 0);
  const todayProfit = todayRevenue - todayCost;
  const lowStock = products.filter((p) => p.stock <= 5);
  const filteredTx = transactions
    .filter((t) => !filterBuyer || (t.buyer || "").toLowerCase().includes(filterBuyer.toLowerCase()))
    .filter((t) => !filterMethod || t.method === filterMethod);
  const uniqueBuyers = (() => {
    const seen = new Map<string, string>();
    for (const t of transactions) {
      if (!t.buyer) continue;
      const key = normalizeNameFuzzy(t.buyer);
      if (!seen.has(key)) seen.set(key, t.buyer);
    }
    return [...seen.values()];
  })();

  if (loading)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0f1c]">
        <div className="w-10 h-10 border-[3px] border-slate-700 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm mt-4">{"Chargement..."}</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-200 relative overflow-hidden">
      {toast && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl text-white font-semibold text-sm z-50 shadow-2xl"
          style={{
            background: toast.type === "success" ? "#059669" : "#6366f1",
          }}
        >
          {toast.msg}
        </div>
      )}

      {view === "member" && (
        <div className="min-h-screen flex flex-col items-center px-4 pb-32">
          <div className="text-center pt-10 pb-6 relative w-full">
            <div className="text-5xl mb-2">{"\u2708\uFE0F"}</div>
            <h1 className="text-3xl font-extrabold text-amber-500 tracking-tight">
              {settings.clubName}
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-1">
              {"Touchez pour ajouter au panier"}
            </p>
            <button
              onClick={() => {
                setView("login");
                setPinInput("");
              }}
              className="absolute top-5 right-2 text-slate-600 text-xl p-2 hover:text-slate-400 transition cursor-pointer"
            >
              {"\u2699\uFE0F"}
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 w-full max-w-lg">
            {products.filter((p) => !p.archived).map((p) => {
              const out = p.stock <= 0;
              const qty = getCartQty(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={out}
                  className={
                    "bg-[#131b2e] border rounded-xl py-3 px-1.5 flex flex-col items-center gap-0.5 transition-all duration-200 relative " +
                    (out
                      ? "opacity-40 cursor-not-allowed border-[#1e2d4a]"
                      : qty > 0
                        ? "border-amber-500 shadow-lg shadow-amber-500/10 cursor-pointer active:scale-95"
                        : "border-[#1e2d4a] hover:border-amber-500/40 cursor-pointer active:scale-95")
                  }
                >
                  {qty > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-black text-[11px] font-extrabold flex items-center justify-center shadow-lg">
                      {String(qty)}
                    </div>
                  )}
                  <span className="text-3xl">{p.emoji}</span>
                  <span className="text-[11px] font-bold text-center leading-tight">{p.name}</span>
                  <span className="text-sm font-extrabold text-amber-500">
                    {formatPrice(p.price)}
                  </span>
                  {!out && p.stock <= 5 && (
                    <span className="text-[9px] text-orange-400 font-semibold">
                      {"+" + p.stock + " restants"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Suggestion button */}
          <button
            onClick={() => setShowSuggestionModal(true)}
            className="mt-4 w-full max-w-lg flex items-center justify-center gap-2 py-3 rounded-xl border border-[#1e2d4a] bg-[#131b2e] text-slate-400 text-sm font-semibold hover:border-amber-500/40 hover:text-amber-500 transition cursor-pointer"
          >
            <span>{"\uD83D\uDCA1"}</span>
            <span>{"Une idee ? Proposez un produit ou une suggestion !"}</span>
          </button>

          {/* Suggestion modal */}
          {showSuggestionModal && (
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4"
              onClick={() => setShowSuggestionModal(false)}
            >
              <div
                className="bg-[#131b2e] border border-[#1e2d4a] rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-bold mb-1">
                  {"\uD83D\uDCA1 Une suggestion ?"}
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  {
                    "Proposez un produit, une amelioration, ou dites-nous ce qui vous ferait plaisir !"
                  }
                </p>
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Votre nom (optionnel)"
                    value={suggestionAuthor}
                    onChange={(e) => setSuggestionAuthor(e.target.value)}
                    className="h-10 rounded-xl border border-slate-700 bg-[#0f172a] text-white text-sm px-3 outline-none focus:border-amber-500"
                  />
                  <textarea
                    placeholder="Votre suggestion..."
                    value={suggestionText}
                    onChange={(e) => setSuggestionText(e.target.value)}
                    rows={3}
                    className="rounded-xl border border-slate-700 bg-[#0f172a] text-white text-sm p-3 outline-none focus:border-amber-500 resize-none"
                  />
                  <button
                    onClick={submitSuggestion}
                    disabled={!suggestionText.trim()}
                    className={
                      "w-full py-3 rounded-xl font-bold text-sm transition-all " +
                      (suggestionText.trim()
                        ? "bg-amber-500 text-black active:scale-95 cursor-pointer"
                        : "bg-slate-800 text-slate-600 cursor-not-allowed")
                    }
                  >
                    {"Envoyer"}
                  </button>
                  <button
                    onClick={() => setShowSuggestionModal(false)}
                    className="text-slate-500 text-sm cursor-pointer"
                  >
                    {"Annuler"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {cartCount > 0 && !showCheckout && (
            <div className="fixed bottom-0 left-0 right-0 bg-[#131b2e] border-t border-[#1e2d4a] p-4 z-30">
              <div className="max-w-lg mx-auto">
                <div className="flex flex-wrap gap-2 mb-3">
                  {cart.map((item) => {
                    const expiry = cartExpiries[item.product.id];
                    const secs = expiry ? Math.max(0, Math.ceil((expiry - Date.now()) / 1000)) : null;
                    return (
                    <div
                      key={item.product.id}
                      className="flex items-center gap-1.5 bg-[#0f172a] border border-[#1e2d4a] rounded-lg px-2.5 py-1.5"
                    >
                      <span className="text-lg">{item.product.emoji}</span>
                      <span className="text-xs font-semibold">
                        {(item.qty > 1 ? item.qty + "x " : "") +
                          item.product.name}
                      </span>
                      <span className="text-xs text-amber-500 font-bold">
                        {formatPrice(item.product.price * item.qty)}
                      </span>
                      {secs !== null && (
                        <span className={`text-[10px] font-bold tabular-nums ${secs <= 5 ? "text-red-400" : "text-slate-500"}`}>
                          {secs}s
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(item.product.id);
                        }}
                        className="ml-1 text-red-500 text-xs font-bold cursor-pointer hover:text-red-300"
                      >
                        {"\u2715"}
                      </button>
                    </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={clearCart}
                    className="px-4 py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-semibold cursor-pointer"
                  >
                    {"Vider"}
                  </button>
                  <button
                    onClick={() => {
                      // Annule tous les cooldowns : l'utilisateur est en train de payer
                      setCartCooldowns((cd) => {
                        Object.values(cd).forEach((t) => clearTimeout(t));
                        return {};
                      });
                      setShowCheckout(true);
                      setBuyerName("");
                    }}
                    className="flex-1 py-3.5 rounded-xl bg-amber-500 text-black font-bold text-base cursor-pointer active:scale-95 transition"
                  >
                    {"Payer " +
                      formatPrice(cartTotal) +
                      " (" +
                      cartCount +
                      " article" +
                      (cartCount > 1 ? "s" : "") +
                      ")"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCheckout && (
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4"
              onClick={() => {
                if (!paymentStatus) {
                  clearCart();
                }
              }}
            >
              <div
                className="bg-[#131b2e] border border-[#1e2d4a] rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {!paymentStatus && (
                  <div>
                    <h2 className="text-lg font-bold mb-3">
                      {"Votre commande"}
                    </h2>
                    <div className="flex flex-col gap-1.5 mb-4">
                      {cart.map((item) => (
                        <div
                          key={item.product.id}
                          className="flex items-center justify-between bg-[#0f172a] rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">
                              {item.product.emoji}
                            </span>
                            <span className="text-sm font-semibold">
                              {item.product.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => removeFromCart(item.product.id)}
                              className="w-7 h-7 rounded-lg bg-[#131b2e] border border-slate-700 text-red-500 font-bold flex items-center justify-center cursor-pointer text-sm"
                            >
                              {"\u2212"}
                            </button>
                            <span className="text-sm font-bold w-6 text-center">
                              {String(item.qty)}
                            </span>
                            <button
                              onClick={() => addToCart(item.product)}
                              className="w-7 h-7 rounded-lg bg-[#131b2e] border border-slate-700 text-emerald-500 font-bold flex items-center justify-center cursor-pointer text-sm"
                            >
                              {"+"}
                            </button>
                            <span className="text-sm font-bold text-amber-500 ml-2 min-w-[50px] text-right">
                              {formatPrice(item.product.price * item.qty)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
                      <span className="text-2xl font-extrabold text-amber-500">
                        {"Total : " + formatPrice(cartTotal)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 mb-4">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {"Nom & Prenom"}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="ex: Jean Dupont"
                          value={buyerName}
                          onChange={(e) => {
                            setBuyerName(e.target.value);
                            setShowCashFlow(false);
                            setCashAmountInput("");
                            setShowNameSuggestions(true);
                          }}
                          onBlur={() =>
                            setTimeout(() => setShowNameSuggestions(false), 150)
                          }
                          onFocus={() => setShowNameSuggestions(true)}
                          autoFocus
                          className={
                            "h-12 w-full rounded-xl border-2 bg-[#0f172a] text-white text-center text-base font-semibold outline-none transition-colors " +
                            (buyerName.trim()
                              ? "border-amber-500"
                              : "border-slate-700")
                          }
                        />
                        {showNameSuggestions &&
                          getNameSuggestions(buyerName).length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-[#0f172a] border border-slate-700 rounded-xl overflow-hidden z-10 shadow-xl">
                              {getNameSuggestions(buyerName).map((name) => (
                                <button
                                  key={name}
                                  onMouseDown={() => {
                                    setBuyerName(name);
                                    setShowNameSuggestions(false);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-[#1e2d4a] transition cursor-pointer flex items-center justify-between"
                                >
                                  <span>{name}</span>
                                  {getMemberBalance(name) > 0 && (
                                    <span className="text-emerald-400 text-xs font-semibold">
                                      {"Avoir : " +
                                        formatPrice(getMemberBalance(name))}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                      {!buyerName.trim() && (
                        <span className="text-[11px] text-amber-500 font-medium">
                          {"Obligatoire pour valider"}
                        </span>
                      )}
                      {buyerName.trim() && getMemberBalance(buyerName) > 0 && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
                          <span className="text-sm text-emerald-400 font-semibold">
                            {"Bonjour " +
                              buyerName.trim().split(" ")[0] +
                              " ! Avoir : " +
                              formatPrice(getMemberBalance(buyerName))}
                          </span>
                        </div>
                      )}
                      {buyerName.trim() &&
                        getMemberBalance(buyerName) === 0 && (
                          <span className="text-[11px] text-slate-600">
                            {"Pas d\u0027avoir pour ce nom"}
                          </span>
                        )}
                    </div>

                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">
                      {"Comment payer ?"}
                    </p>

                    {/* Pay with avoir */}
                    {buyerName.trim() &&
                      getMemberBalance(buyerName) >= cartTotal &&
                      cartTotal > 0 && (
                        <button
                          onClick={() => confirmPayment("avoir")}
                          className="w-full py-3.5 rounded-xl font-bold text-[15px] bg-emerald-600 text-white active:scale-95 cursor-pointer mb-3"
                        >
                          {"\u2705 Utiliser mon avoir (" +
                            formatPrice(getMemberBalance(buyerName)) +
                            ")"}
                        </button>
                      )}
                    {buyerName.trim() &&
                      getMemberBalance(buyerName) > 0 &&
                      getMemberBalance(buyerName) < cartTotal &&
                      cartTotal > 0 && (
                        <div className="bg-[#0f172a] rounded-xl p-3 mb-3 text-xs text-slate-400 text-center">
                          {"Avoir insuffisant (" +
                            formatPrice(getMemberBalance(buyerName)) +
                            " < " +
                            formatPrice(cartTotal) +
                            "). Payez par especes ou carte."}
                        </div>
                      )}

                    {/* Cash flow */}
                    {!showCashFlow && (
                      <button
                        onClick={() => setShowCashFlow(true)}
                        disabled={!buyerName.trim()}
                        className={
                          "w-full py-3.5 rounded-xl font-bold text-[15px] transition-all mb-2 " +
                          (buyerName.trim()
                            ? "bg-emerald-700 text-white active:scale-95 cursor-pointer"
                            : "bg-slate-800 text-slate-600 cursor-not-allowed")
                        }
                      >
                        {"\uD83D\uDCB0 Payer en especes"}
                      </button>
                    )}
                    {showCashFlow && (
                      <div className="bg-[#0f172a] border border-emerald-700 rounded-xl p-4 mb-3">
                        <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-2">
                          {"Montant mis dans la boite"}
                        </label>
                        <div className="flex gap-2 mb-2">
                          {[0.5, 1, 2, 5].map((v) => (
                            <button
                              key={v}
                              onClick={() => setCashAmountInput(String(v))}
                              className={
                                "flex-1 py-2 rounded-lg text-sm font-bold transition cursor-pointer " +
                                (cashAmountInput === String(v)
                                  ? "bg-emerald-600 text-white"
                                  : "bg-[#131b2e] border border-slate-700 text-slate-300")
                              }
                            >
                              {formatPrice(v)}
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="Autre montant..."
                          value={cashAmountInput}
                          onChange={(e) => setCashAmountInput(e.target.value)}
                          className="w-full h-10 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-center text-sm font-bold outline-none mb-2"
                        />
                        {cashAmountInput &&
                          parseFloat(cashAmountInput) >= cartTotal && (
                            <div className="text-xs text-center mb-2">
                              {parseFloat(cashAmountInput) > cartTotal && (
                                <span className="text-emerald-400 font-semibold">
                                  {"Avoir credite : +" +
                                    formatPrice(
                                      parseFloat(cashAmountInput) - cartTotal,
                                    )}
                                </span>
                              )}
                              {parseFloat(cashAmountInput) === cartTotal && (
                                <span className="text-slate-400">
                                  {"Montant exact"}
                                </span>
                              )}
                            </div>
                          )}
                        {cashAmountInput &&
                          parseFloat(cashAmountInput) < cartTotal && (
                            <div className="text-xs text-center mb-2 text-red-400">
                              {"Montant insuffisant (il manque " +
                                formatPrice(
                                  cartTotal - parseFloat(cashAmountInput),
                                ) +
                                ")"}
                            </div>
                          )}
                        <button
                          onClick={() => {
                            const amt = parseFloat(cashAmountInput);
                            if (amt >= cartTotal)
                              confirmPayment("especes", amt);
                          }}
                          disabled={
                            !cashAmountInput ||
                            parseFloat(cashAmountInput) < cartTotal
                          }
                          className={
                            "w-full py-3 rounded-xl font-bold text-sm transition-all " +
                            (cashAmountInput &&
                            parseFloat(cashAmountInput) >= cartTotal
                              ? "bg-emerald-600 text-white active:scale-95 cursor-pointer"
                              : "bg-slate-800 text-slate-600 cursor-not-allowed")
                          }
                        >
                          {"Confirmer paiement especes"}
                        </button>
                      </div>
                    )}

                    <p className="text-slate-600 text-xs my-2">
                      {"--- ou ---"}
                    </p>

                    {/* Card payment — Solo terminal */}
                    <div className="flex flex-col items-center gap-3 mb-3">
                      {!sumupCheckoutId && !sumupLoading && (
                        <button
                          onClick={createSumUpCheckout}
                          disabled={!buyerName.trim()}
                          className={
                            "w-full py-3.5 rounded-xl font-bold text-[15px] transition-all " +
                            (buyerName.trim()
                              ? "bg-blue-600 text-white active:scale-95 cursor-pointer"
                              : "bg-slate-800 text-slate-600 cursor-not-allowed")
                          }
                        >
                          {"💳 Payer " + formatPrice(cartTotal) + " par carte"}
                        </button>
                      )}
                      {sumupLoading && (
                        <div className="flex items-center gap-2 py-4 text-slate-400">
                          <div className="w-5 h-5 border-2 border-slate-600 border-t-amber-500 rounded-full animate-spin" />
                          <span className="text-sm">
                            {"Envoi au terminal..."}
                          </span>
                        </div>
                      )}
                      {sumupPolling && sumupCheckoutId && (
                        <div className="w-full bg-blue-950 border border-blue-700 rounded-xl p-4 flex flex-col items-center gap-3">
                          <div className="w-8 h-8 border-[3px] border-blue-700 border-t-blue-300 rounded-full animate-spin" />
                          <p className="text-blue-300 font-bold text-sm text-center">
                            {"💳 En attente du paiement sur le terminal..."}
                          </p>
                          <p className="text-slate-500 text-xs text-center">
                            {"Le client présente sa carte sur le SumUp Solo"}
                          </p>
                          <button
                            onClick={async () => {
                              if (sumupIntervalRef.current) {
                                clearInterval(sumupIntervalRef.current);
                                sumupIntervalRef.current = null;
                              }
                              if (sumupTimeoutRef.current) {
                                clearTimeout(sumupTimeoutRef.current);
                                sumupTimeoutRef.current = null;
                              }
                              setSumupPolling(false);
                              setSumupCheckoutId(null);
                              try {
                                await fetch("/api/sumup-terminate", {
                                  method: "POST",
                                });
                              } catch {
                                /* ignore */
                              }
                            }}
                            className="text-xs text-slate-600 hover:text-slate-400 cursor-pointer mt-1"
                          >
                            {"Annuler"}
                          </button>
                        </div>
                      )}
                      {sumupError && (
                        <div className="bg-red-950 border border-red-800 rounded-xl p-3 text-red-300 text-sm w-full text-center">
                          {sumupError}
                          <button
                            onClick={() => setSumupError(null)}
                            className="block mx-auto mt-2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
                          >
                            {"Réessayer"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Offert / gratuit */}
                    {cartTotal === 0 && buyerName.trim() && (
                      <button
                        onClick={() => confirmPayment("offert")}
                        className="w-full py-3.5 rounded-xl font-bold text-[15px] bg-purple-700 text-white active:scale-95 cursor-pointer mb-2"
                      >
                        {"\uD83C\uDF81 Offert"}
                      </button>
                    )}

                    {/* Membre du Bureau */}
                    {!bureauUnlocked && !showBureauPin && (
                      <button
                        onClick={() => setShowBureauPin(true)}
                        className="w-full mt-1 py-2 rounded-xl text-xs text-slate-600 hover:text-slate-400 transition cursor-pointer"
                      >
                        {"🎖 Membre du Bureau"}
                      </button>
                    )}
                    {showBureauPin && !bureauUnlocked && (
                      <div className="mt-2 bg-[#0f172a] border border-slate-700 rounded-xl p-4 flex flex-col items-center gap-3">
                        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                          {"Code Bureau"}
                        </p>
                        <div className="flex gap-2">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={
                                "w-3 h-3 rounded-full transition-all " +
                                (bureauPinInput.length > i
                                  ? bureauPinError
                                    ? "bg-red-500"
                                    : "bg-amber-500"
                                  : "bg-slate-700")
                              }
                            />
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-2 w-full max-w-[200px]">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"].map(
                            (k) => (
                              <button
                                key={String(k)}
                                onClick={() => {
                                  if (k === "C") {
                                    setBureauPinInput("");
                                  } else if (k === "OK") {
                                    if (bureauPinInput === (settings.bureauPin || "1215")) {
                                      setBureauUnlocked(true);
                                      setShowBureauPin(false);
                                      setBureauPinInput("");
                                    } else {
                                      setBureauPinError(true);
                                      setTimeout(() => {
                                        setBureauPinError(false);
                                        setBureauPinInput("");
                                      }, 1200);
                                    }
                                  } else {
                                    if (bureauPinInput.length < 4)
                                      setBureauPinInput((p) => p + String(k));
                                  }
                                }}
                                className={
                                  "py-2.5 rounded-lg text-sm font-bold flex items-center justify-center cursor-pointer transition " +
                                  (k === "OK"
                                    ? "bg-amber-500 text-black"
                                    : k === "C"
                                      ? "bg-[#131b2e] border border-red-900 text-red-500"
                                      : "bg-[#131b2e] border border-slate-700 text-slate-200")
                                }
                              >
                                {String(k)}
                              </button>
                            ),
                          )}
                        </div>
                        {bureauPinError && (
                          <p className="text-red-500 text-xs font-semibold">
                            {"Code incorrect"}
                          </p>
                        )}
                        <button
                          onClick={() => {
                            setShowBureauPin(false);
                            setBureauPinInput("");
                          }}
                          className="text-slate-600 text-xs cursor-pointer"
                        >
                          {"Annuler"}
                        </button>
                      </div>
                    )}
                    {bureauUnlocked && buyerName.trim() && (
                      <button
                        onClick={() => confirmPayment("bureau")}
                        className="w-full py-3.5 rounded-xl font-bold text-[15px] bg-amber-700 text-white active:scale-95 cursor-pointer mt-1 mb-2"
                      >
                        {"🎖 Commande Bureau (gratuit)"}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        clearCart();
                      }}
                      className="mt-3 px-5 py-2.5 rounded-lg border border-slate-700 text-slate-400 text-sm font-semibold hover:border-slate-500 transition cursor-pointer"
                    >
                      {"Retour"}
                    </button>
                  </div>
                )}
                {paymentStatus === "success" && lastOrder && (
                  <div className="py-6 flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-3xl text-white font-bold shadow-[0_0_40px_rgba(16,185,129,0.4)]">
                      {"\u2713"}
                    </div>
                    <h2 className="text-xl font-bold text-emerald-400">
                      {"Merci " + lastOrder.buyer.split(" ")[0] + " !"}
                    </h2>

                    <div className="w-full bg-[#0f172a] rounded-xl p-4 mt-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        {"Recapitulatif"}
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {lastOrder.items.map((item) => (
                          <div
                            key={item.product.id}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {item.product.emoji}
                              </span>
                              <span className="text-sm">
                                {item.qty > 1 ? item.qty + "x " : ""}
                                {item.product.name}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-amber-500">
                              {formatPrice(item.product.price * item.qty)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="h-px bg-[#1e2d4a] my-3" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{"Total"}</span>
                        <span className="text-lg font-extrabold text-amber-500">
                          {formatPrice(lastOrder.total)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-slate-500">
                          {"Paye par"}
                        </span>
                        <span className="text-xs text-slate-400">
                          {lastOrder.method === "especes"
                            ? "\uD83D\uDCB0 Especes"
                            : lastOrder.method === "avoir"
                              ? "\uD83D\uDCB3 Avoir"
                              : lastOrder.method === "offert"
                                ? "\uD83C\uDF81 Offert"
                                : "\uD83D\uDCB3 Carte"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-slate-500">
                          {"Membre"}
                        </span>
                        <span className="text-xs text-slate-300 font-semibold">
                          {lastOrder.buyer}
                        </span>
                      </div>
                      {getMemberBalance(lastOrder.buyer) > 0 && (
                        <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 text-center">
                          <span className="text-sm text-emerald-400 font-semibold">
                            {"Votre avoir : " +
                              formatPrice(getMemberBalance(lastOrder.buyer))}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bandeau serrure */}
                    <div className="w-full bg-emerald-900/30 border border-emerald-700/40 rounded-xl p-3 flex flex-col items-center gap-2">
                      <p className="text-sm font-semibold text-emerald-400">
                        {lastOrder.lockType === "cafe"
                          ? "\u2615 Tiroir caf\u00e9 d\u00e9verrouill\u00e9 !"
                          : lastOrder.lockType === "frigo"
                            ? "\uD83C\uDF7A Frigo d\u00e9verrouill\u00e9 !"
                            : "\u2615\uD83C\uDF7A Caf\u00e9 & Frigo d\u00e9verrouill\u00e9s !"}
                      </p>
                      {lockRetriggerCountdown === null ? (
                        <button
                          onClick={() => {
                            fetch("/api/fridge?action=trigger&lock=" + lastOrder.lockType).catch(() => {});
                            setLockRetriggerCountdown(5);
                            if (lockRetriggerTimerRef.current) clearInterval(lockRetriggerTimerRef.current);
                            lockRetriggerTimerRef.current = setInterval(() => {
                              setLockRetriggerCountdown((prev) => {
                                if (prev === null || prev <= 1) {
                                  if (lockRetriggerTimerRef.current) clearInterval(lockRetriggerTimerRef.current);
                                  lockRetriggerTimerRef.current = null;
                                  return 0;
                                }
                                return prev - 1;
                              });
                            }, 1000);
                          }}
                          className="text-xs px-4 py-1.5 rounded-lg bg-emerald-700/40 text-emerald-300 font-semibold cursor-pointer hover:bg-emerald-700/60 active:scale-95"
                        >
                          {"\uD83D\uDD13 R\u00e9-ouvrir"}
                        </button>
                      ) : lockRetriggerCountdown > 0 ? (
                        <p className="text-xs text-emerald-500 font-bold tabular-nums">
                          {"Ferme dans " + lockRetriggerCountdown + "s\u2026"}
                        </p>
                      ) : null}
                    </div>

                    <p className="text-slate-600 text-xs mt-2">
                      {"Bonne degustation ! \uD83D\uDE0A"}
                    </p>
                    <button
                      onClick={() => {
                        clearCart();
                        setBuyerName("");
                        setLastOrder(null);
                        setLockRetriggerCountdown(null);
                        if (lockRetriggerTimerRef.current) { clearInterval(lockRetriggerTimerRef.current); lockRetriggerTimerRef.current = null; }
                      }}
                      className="mt-2 px-6 py-2.5 rounded-xl bg-[#1e2d4a] text-amber-500 text-sm font-semibold cursor-pointer active:scale-95"
                    >
                      {"Fermer"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {view === "login" && (
        <div className="min-h-screen flex flex-col items-center justify-center p-5">
          <button
            onClick={() => setView("member")}
            className="absolute top-4 left-4 text-slate-500 text-sm font-semibold hover:text-slate-300 cursor-pointer"
          >
            {"\u2190 Retour"}
          </button>
          <div className="flex flex-col items-center gap-5">
            <span className="text-5xl">{"\uD83D\uDD12"}</span>
            <h2 className="text-xl font-bold">{"Acces Tresorier"}</h2>
            <div className="grid grid-cols-3 gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"].map((k) => (
                <button
                  key={String(k)}
                  onClick={() => {
                    if (k === "C") setPinInput("");
                    else if (k === "OK") handleAdminLogin();
                    else setPinInput((p) => p + String(k));
                  }}
                  className={
                    "w-16 h-14 rounded-xl border text-xl font-bold flex items-center justify-center transition cursor-pointer " +
                    (k === "OK"
                      ? "bg-amber-500 text-white border-transparent"
                      : k === "C"
                        ? "bg-[#131b2e] border-red-900 text-red-500"
                        : "bg-[#131b2e] border-[#1e2d4a] text-slate-200 hover:border-slate-600")
                  }
                >
                  {String(k)}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={
                    "w-4 h-4 rounded-full transition-all duration-200 " +
                    (pinInput.length > i
                      ? pinError
                        ? "bg-red-500 scale-125"
                        : "bg-amber-500"
                      : "bg-slate-700")
                  }
                />
              ))}
            </div>
            {pinError && (
              <p className="text-red-500 text-sm font-semibold">
                {"Code incorrect"}
              </p>
            )}
          </div>
        </div>
      )}

      {view === "admin" && (
        <div className="min-h-screen p-4 pb-10 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => setView("member")}
              className="text-slate-500 text-sm font-semibold hover:text-slate-300 cursor-pointer"
            >
              {"\u2190 Retour bar"}
            </button>
            <h1 className="text-xl font-extrabold text-amber-500">
              {"Gestion " + settings.clubName}
            </h1>
            <span className="ml-auto text-xs">
              {saveStatus === "saving" && (
                <span className="text-slate-500">{"Sauvegarde..."}</span>
              )}
              {saveStatus === "error" && (
                <span className="text-red-400">{"Erreur sauvegarde !"}</span>
              )}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
            <div className="rounded-2xl p-3.5 text-center border bg-[#131b2e] border-[#1e2d4a]">
              <span className="block text-xl font-extrabold text-amber-500">
                {formatPrice(todayRevenue)}
              </span>
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                {"Aujourd\u0027hui"}
              </span>
            </div>
            <div className="rounded-2xl p-3.5 text-center border bg-[#131b2e] border-[#1e2d4a]">
              <span className="block text-xl font-extrabold text-amber-500">
                {String(todayTx.length)}
              </span>
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                {"Ventes du jour"}
              </span>
            </div>
            <div className="rounded-2xl p-3.5 text-center border bg-[#131b2e] border-[#1e2d4a]">
              <span className="block text-xl font-extrabold text-amber-500">
                {formatPrice(totalRevenue)}
              </span>
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                {"Total cumule"}
              </span>
            </div>
            {lowStock.length > 0 && (
              <div className="rounded-2xl p-3.5 text-center border bg-red-950 border-red-800">
                <span className="block text-xl font-extrabold text-amber-500">
                  {"\u26A0 " + lowStock.length}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  {"Stock faible"}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-1 mb-4">
            {[
              { key: "stock", label: "\uD83D\uDCE6 Stock" },
              { key: "finance", label: "\uD83D\uDCB0 Finances" },
              { key: "history", label: "\uD83D\uDCCB Ventes" },
              { key: "members", label: "\uD83D\uDC65 Comptes" },
              { key: "suggestions", label: "\uD83D\uDCA1 Idees" },
              { key: "settings", label: "\u2699 Config" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveAdminTab(tab.key)}
                className={
                  "flex-1 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer " +
                  (activeAdminTab === tab.key
                    ? "bg-[#1e2d4a] text-amber-500"
                    : "bg-[#131b2e] text-slate-500 hover:text-slate-300")
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeAdminTab === "stock" && (
            <div className="flex flex-col gap-2">
              {products.map((p) => {
                const isEd = editingProduct && editingProduct.id === p.id;
                if (isEd)
                  return (
                    <div
                      key={p.id}
                      className="bg-[#0f172a] border-2 border-amber-500 rounded-xl p-4"
                    >
                      <span className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-3 block">
                        {"Modifier"}
                      </span>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500 font-semibold uppercase">
                            {"Emoji"}
                          </label>
                          <button
                            onClick={() => setEmojiPickerFor(emojiPickerFor === "edit" ? null : "edit")}
                            className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-3xl cursor-pointer hover:border-amber-500"
                          >
                            {editingProduct.emoji}
                          </button>
                          {emojiPickerFor === "edit" && (
                            <div className="absolute z-20 mt-1 bg-[#131b2e] border border-slate-700 rounded-xl p-2 shadow-2xl w-64">
                              <div className="flex gap-1 mb-2 flex-wrap">
                                {EMOJI_CATEGORIES.map((cat, i) => (
                                  <button key={i} onClick={() => setEmojiPickerCategory(i)}
                                    className={"text-[10px] px-1.5 py-0.5 rounded font-semibold cursor-pointer " + (emojiPickerCategory === i ? "bg-amber-500 text-black" : "bg-[#0f172a] text-slate-400")}
                                  >{cat.label}</button>
                                ))}
                              </div>
                              <div className="grid grid-cols-7 gap-1">
                                {EMOJI_CATEGORIES[emojiPickerCategory].emojis.map((e) => (
                                  <button key={e} onClick={() => { setEditingProduct({ ...editingProduct, emoji: e }); setEmojiPickerFor(null); }}
                                    className="text-xl p-1 rounded hover:bg-[#1e2d4a] cursor-pointer"
                                  >{e}</button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500 font-semibold uppercase">
                            {"Nom"}
                          </label>
                          <input
                            value={editingProduct.name}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                name: e.target.value,
                              })
                            }
                            className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm px-3 outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500 font-semibold uppercase">
                            {"Prix vente"}
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={editingProduct.price}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                price: Math.max(0, parseFloat(e.target.value) || 0),
                              })
                            }
                            className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-500 font-semibold uppercase">
                            {"Prix achat"}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={editingProduct.cost || 0}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                cost: Math.max(0, parseFloat(e.target.value) || 0),
                              })
                            }
                            className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-emerald-400 text-sm text-center outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 col-span-2">
                          <label className="text-[10px] text-slate-500 font-semibold uppercase">
                            {"Stock frigo / service"}
                          </label>
                          <input
                            type="number"
                            value={editingProduct.stock}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                stock: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1 col-span-2">
                          <label className="text-[10px] text-slate-500 font-semibold uppercase">
                            {"Stock placard reserve"}
                          </label>
                          <input
                            type="number"
                            value={editingProduct.stockReserve ?? 0}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                stockReserve: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-purple-300 text-sm text-center outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={saveEditProduct}
                          className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer"
                        >
                          {"\u2713 Enregistrer"}
                        </button>
                        <button
                          onClick={() => setEditingProduct(null)}
                          className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 text-sm font-bold cursor-pointer"
                        >
                          {"Annuler"}
                        </button>
                      </div>
                    </div>
                  );
                return (
                  <div
                    key={p.id}
                    className={
                      "flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border " +
                      (p.archived
                        ? "opacity-40 bg-[#0f172a] border-slate-800 grayscale"
                        : p.stock <= 5 && (p.stockReserve ?? 0) === 0
                          ? "bg-red-950/40 border-red-800"
                          : p.stock <= 5
                            ? "bg-orange-950/30 border-orange-800"
                            : "bg-[#131b2e] border-[#1e2d4a]")
                    }
                  >
                    <span className="text-2xl w-9 text-center">{p.emoji}</span>
                    <div className="flex-1 flex flex-col">
                      <span className="text-sm font-bold">{p.name}</span>
                      <span className="text-xs text-amber-500 font-semibold">
                        {formatPrice(p.price)}
                        <span className="text-slate-600">
                          {" / cout: " + formatPrice(p.cost || 0)}
                        </span>
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400">
                          {"🧊 Frigo : "}
                          <span
                            className={
                              p.stock <= 5
                                ? "text-orange-400 font-bold"
                                : "text-white"
                            }
                          >
                            {p.stock}
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {"•"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {"📦 Réserve : "}
                          <span
                            className={
                              (p.stockReserve ?? 0) === 0 && p.stock <= 5
                                ? "text-red-400 font-bold"
                                : "text-purple-300"
                            }
                          >
                            {p.stockReserve ?? 0}
                          </span>
                        </span>
                        {p.stock <= 5 && (p.stockReserve ?? 0) === 0 && (
                          <span className="text-[10px] text-red-400 font-bold">
                            {"⚠ Réappro!"}
                          </span>
                        )}
                        {p.stock <= 5 && (p.stockReserve ?? 0) > 0 && (
                          <span className="text-[10px] text-orange-400">
                            {"↻ Réappro dispo"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-[9px] text-slate-600 uppercase font-semibold">
                        Frigo
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => adjustStock(p.id, -1)}
                          className="w-8 h-8 rounded-lg border border-slate-700 bg-[#0f172a] text-red-500 text-lg font-bold flex items-center justify-center cursor-pointer"
                        >
                          {"\u2212"}
                        </button>
                        <input
                          type="number"
                          value={p.stock}
                          onChange={(e) => setStockDirect(p.id, e.target.value)}
                          className="w-12 h-8 rounded-lg border border-slate-700 bg-[#0f172a] text-white text-sm font-bold text-center outline-none"
                        />
                        <button
                          onClick={() => adjustStock(p.id, 1)}
                          className="w-8 h-8 rounded-lg border border-slate-700 bg-[#0f172a] text-emerald-500 text-lg font-bold flex items-center justify-center cursor-pointer"
                        >
                          {"+"}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-[9px] text-purple-400 uppercase font-semibold">
                        Reserve
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setProducts((prev) =>
                              prev.map((x) =>
                                x.id === p.id
                                  ? {
                                      ...x,
                                      stockReserve: Math.max(
                                        0,
                                        (x.stockReserve ?? 0) - 1,
                                      ),
                                    }
                                  : x,
                              ),
                            )
                          }
                          className="w-8 h-8 rounded-lg border border-slate-700 bg-[#0f172a] text-red-500 text-lg font-bold flex items-center justify-center cursor-pointer"
                        >
                          {"\u2212"}
                        </button>
                        <input
                          type="number"
                          value={p.stockReserve ?? 0}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (!isNaN(n) && n >= 0)
                              setProducts((prev) =>
                                prev.map((x) =>
                                  x.id === p.id ? { ...x, stockReserve: n } : x,
                                ),
                              );
                          }}
                          className="w-12 h-8 rounded-lg border border-purple-900 bg-[#0f172a] text-purple-300 text-sm font-bold text-center outline-none"
                        />
                        <button
                          onClick={() =>
                            setProducts((prev) =>
                              prev.map((x) =>
                                x.id === p.id
                                  ? {
                                      ...x,
                                      stockReserve: (x.stockReserve ?? 0) + 1,
                                    }
                                  : x,
                              ),
                            )
                          }
                          className="w-8 h-8 rounded-lg border border-slate-700 bg-[#0f172a] text-emerald-500 text-lg font-bold flex items-center justify-center cursor-pointer"
                        >
                          {"+"}
                        </button>
                        {(p.stockReserve ?? 0) > 0 && (
                          <button
                            onClick={() =>
                              setProducts((prev) =>
                                prev.map((x) =>
                                  x.id === p.id
                                    ? { ...x, stock: x.stock + (x.stockReserve ?? 0), stockReserve: 0 }
                                    : x,
                                ),
                              )
                            }
                            className="ml-1 px-2 h-8 rounded-lg border border-purple-700 bg-purple-900/30 text-purple-300 text-xs font-bold cursor-pointer hover:bg-purple-800/40"
                          >
                            {"\u2192 Frigo"}
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setRestockingProduct(p);
                        setRestockForm({ qty: 1, newPrice: p.price, newCost: p.cost, method: "especes" });
                      }}
                      className="text-[10px] px-2 py-1 rounded-lg border border-emerald-700 bg-emerald-900/20 text-emerald-400 font-bold cursor-pointer hover:bg-emerald-800/30"
                      title="Réapprovisionner"
                    >
                      {"+ Réappro"}
                    </button>
                    <button
                      onClick={() => setEditingProduct({ ...p })}
                      className="opacity-50 hover:opacity-100 text-sm cursor-pointer"
                    >
                      {"\u270F\uFE0F"}
                    </button>
                    {p.stock === 0 && !p.archived && (
                      <button
                        onClick={() => setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, archived: true } : x))}
                        className="text-[10px] px-1.5 py-1 rounded border border-slate-600 text-slate-500 cursor-pointer hover:text-orange-400 hover:border-orange-600"
                        title="Archiver (masquer de la vente)"
                      >
                        {"📦"}
                      </button>
                    )}
                    {p.archived && (
                      <button
                        onClick={() => setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, archived: false } : x))}
                        className="text-[10px] px-1.5 py-1 rounded border border-amber-700 text-amber-500 font-bold cursor-pointer hover:bg-amber-900/20"
                        title="Réactiver"
                      >
                        {"↩"}
                      </button>
                    )}
                    <button
                      onClick={() => removeProduct(p.id)}
                      className="opacity-40 hover:opacity-80 text-base cursor-pointer"
                    >
                      {"\uD83D\uDDD1"}
                    </button>
                  </div>
                );
              })}
              {!showAddProduct ? (
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="border-2 border-dashed border-[#1e2d4a] text-slate-500 py-3.5 rounded-xl text-sm font-semibold hover:border-slate-600 transition cursor-pointer"
                >
                  {"+ Ajouter un produit"}
                </button>
              ) : (
                <div className="bg-[#0f172a] border-2 border-emerald-500 rounded-xl p-4">
                  <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-3 block">
                    {"Nouveau produit"}
                  </span>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        {"Emoji"}
                      </label>
                      <button
                        onClick={() => setEmojiPickerFor(emojiPickerFor === "new" ? null : "new")}
                        className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-3xl cursor-pointer hover:border-amber-500"
                      >
                        {newProduct.emoji}
                      </button>
                      {emojiPickerFor === "new" && (
                        <div className="absolute z-20 mt-1 bg-[#131b2e] border border-slate-700 rounded-xl p-2 shadow-2xl w-64">
                          <div className="flex gap-1 mb-2 flex-wrap">
                            {EMOJI_CATEGORIES.map((cat, i) => (
                              <button key={i} onClick={() => setEmojiPickerCategory(i)}
                                className={"text-[10px] px-1.5 py-0.5 rounded font-semibold cursor-pointer " + (emojiPickerCategory === i ? "bg-amber-500 text-black" : "bg-[#0f172a] text-slate-400")}
                              >{cat.label}</button>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {EMOJI_CATEGORIES[emojiPickerCategory].emojis.map((e) => (
                              <button key={e} onClick={() => { setNewProduct({ ...newProduct, emoji: e }); setEmojiPickerFor(null); }}
                                className="text-xl p-1 rounded hover:bg-[#1e2d4a] cursor-pointer"
                              >{e}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        {"Nom"}
                      </label>
                      <input
                        placeholder="ex: Jus"
                        value={newProduct.name}
                        onChange={(e) =>
                          setNewProduct({ ...newProduct, name: e.target.value })
                        }
                        className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm px-3 outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        {"Prix vente"}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={newProduct.price}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            price: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        {"Prix achat"}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newProduct.cost}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            cost: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-emerald-400 text-sm text-center outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        {"Stock frigo / service"}
                      </label>
                      <input
                        type="number"
                        value={newProduct.stock}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            stock: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        {"Stock placard reserve"}
                      </label>
                      <input
                        type="number"
                        value={newProduct.stockReserve}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            stockReserve: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-purple-300 text-sm text-center outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={addProduct}
                      className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer"
                    >
                      {"\u2713 Ajouter"}
                    </button>
                    <button
                      onClick={() => setShowAddProduct(false)}
                      className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 text-sm font-bold cursor-pointer"
                    >
                      {"Annuler"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeAdminTab === "finance" && (
            <div className="flex flex-col gap-3">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl p-4 border bg-[#131b2e] border-[#1e2d4a]">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                    {"Chiffre d\u0027affaires total"}
                  </span>
                  <span className="text-xl font-extrabold text-amber-500">
                    {formatPrice(totalRevenue)}
                  </span>
                </div>
                <div className="rounded-xl p-4 border bg-[#131b2e] border-[#1e2d4a]">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                    {"Cout total"}
                  </span>
                  <span className="text-xl font-extrabold text-red-400">
                    {formatPrice(totalCost)}
                  </span>
                </div>
                <div className="rounded-xl p-4 border bg-[#131b2e] border-emerald-800">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                    {"Benefice total"}
                  </span>
                  <span
                    className={
                      "text-xl font-extrabold " +
                      (totalProfit >= 0 ? "text-emerald-400" : "text-red-400")
                    }
                  >
                    {formatPrice(totalProfit)}
                  </span>
                </div>
                <div className="rounded-xl p-4 border bg-[#131b2e] border-[#1e2d4a]">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                    {"Marge"}
                  </span>
                  <span
                    className={
                      "text-xl font-extrabold " +
                      (marginPct >= 0 ? "text-emerald-400" : "text-red-400")
                    }
                  >
                    {marginPct + "%"}
                  </span>
                </div>
              </div>

              {/* Recettes nettes */}
              {(() => {
                const cashNet = (settings.cashInBox || 0) - (settings.cashInitialFund || 0);
                const cbNet = (settings.cbReceived || 0) - (settings.cbInitialFund || 0);
                const totalNet = cashNet + cbNet;
                return (
                  <>
                    <div className="rounded-xl p-4 border-2 bg-[#131b2e] border-amber-500">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                        {"Recettes nettes"}
                      </span>
                      <span className="text-2xl font-extrabold text-amber-500">
                        {formatPrice(totalNet)}
                      </span>
                      <span className="text-[10px] text-slate-600 block mt-1">
                        {"Hors fonds initiaux"}
                      </span>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                            {"Especes"}
                          </span>
                          <span className="text-xl font-extrabold text-amber-500">
                            {formatPrice(settings.cashInBox || 0)}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                            {"+" + formatPrice(cashNet) + " net"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                            {"CB"}
                          </span>
                          <span className="text-xl font-extrabold text-blue-400">
                            {formatPrice(settings.cbReceived || 0)}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                            {"+" + formatPrice(cbNet) + " net"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                            {"Avoirs"}
                          </span>
                          <span className="text-xl font-extrabold text-emerald-400">
                            {formatPrice(
                              members.reduce((s, m) => s + Math.max(0, m.balance), 0),
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Today */}
              <div className="bg-[#0f172a] border border-[#1e2d4a] rounded-xl p-4">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block mb-2">
                  {"Aujourd\u0027hui"}
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      {"Recettes"}
                    </span>
                    <span className="text-sm font-bold text-amber-500">
                      {formatPrice(todayRevenue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      {"Couts"}
                    </span>
                    <span className="text-sm font-bold text-red-400">
                      {formatPrice(todayCost)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      {"Benefice"}
                    </span>
                    <span
                      className={
                        "text-sm font-bold " +
                        (todayProfit >= 0 ? "text-emerald-400" : "text-red-400")
                      }
                    >
                      {formatPrice(todayProfit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Per product */}
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">
                {"Marge par produit"}
              </span>
              <div className="flex flex-col gap-1.5">
                {products.map((p) => {
                  const margin = p.price - (p.cost || 0);
                  const marginP =
                    p.price > 0 ? Math.round((margin / p.price) * 100) : 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3.5 py-2"
                    >
                      <span className="text-xl">{p.emoji}</span>
                      <span className="text-sm font-semibold flex-1">
                        {p.name}
                      </span>
                      <div className="text-right">
                        <span className="text-xs text-slate-500 block">
                          {"Achat " +
                            formatPrice(p.cost || 0) +
                            " \u2192 Vente " +
                            formatPrice(p.price)}
                        </span>
                        <span
                          className={
                            "text-sm font-bold " +
                            (margin >= 0 ? "text-emerald-400" : "text-red-400")
                          }
                        >
                          {"+" + formatPrice(margin) + " (" + marginP + "%)"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Achats fournisseurs */}
              {procurements.length > 0 && (() => {
                const totalSpent = procurements.reduce((s, p) => s + p.totalCost, 0);
                const shown = procurements.slice(0, 10);
                return (
                  <div className="bg-[#0f172a] border border-red-900/40 rounded-xl p-4 mt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {"Achats fournisseurs"}
                      </span>
                      <span className="text-sm font-extrabold text-red-400">
                        {"- " + formatPrice(totalSpent)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      {shown.map((pr) => {
                        const prod = products.find((p) => p.id === pr.productId);
                        return (
                          <div key={pr.id} className="flex items-center justify-between text-xs text-slate-400">
                            <span>
                              {(prod?.emoji || "📦") + " " + pr.productName + " ×" + pr.qty}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-600">
                                {new Date(pr.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                              </span>
                              <span className={pr.method === "especes" ? "text-emerald-400" : "text-blue-400"}>
                                {pr.method === "especes" ? "💵" : "💳"}
                              </span>
                              <span className="font-bold text-red-400">{"- " + formatPrice(pr.totalCost)}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Stock value */}
              <div className="bg-[#0f172a] border border-[#1e2d4a] rounded-xl p-4 mt-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  {"Valeur du stock actuel"}
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      {"Au prix d\u0027achat"}
                    </span>
                    <span className="text-sm font-bold text-red-400">
                      {formatPrice(
                        products.reduce(
                          (s, p) => s + (p.cost || 0) * p.stock,
                          0,
                        ),
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      {"Au prix de vente"}
                    </span>
                    <span className="text-sm font-bold text-amber-500">
                      {formatPrice(
                        products.reduce((s, p) => s + p.price * p.stock, 0),
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeAdminTab === "history" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Filtrer par nom..."
                  value={filterBuyer}
                  onChange={(e) => setFilterBuyer(e.target.value)}
                  className="flex-1 h-10 rounded-xl border border-slate-700 bg-[#131b2e] text-white text-sm px-3 outline-none focus:border-amber-500 transition"
                />
                {filterBuyer && (
                  <button
                    onClick={() => setFilterBuyer("")}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    {"Effacer"}
                  </button>
                )}
              </div>
              {uniqueBuyers.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {uniqueBuyers.slice(0, 10).map((b) => (
                    <button
                      key={b}
                      onClick={() => setFilterBuyer(filterBuyer === b ? "" : b)}
                      className={
                        "text-[11px] px-2.5 py-1 rounded-full font-semibold transition cursor-pointer " +
                        (filterBuyer === b
                          ? "bg-amber-500 text-black"
                          : "bg-[#1e2d4a] text-slate-400 hover:text-white")
                      }
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5 flex-wrap">
                {(["espèces", "carte", "avoir", "offert", "bureau"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setFilterMethod((prev) => (prev === m ? null : m))}
                    className={
                      "text-[11px] px-2.5 py-1 rounded-full font-semibold transition cursor-pointer capitalize " +
                      (filterMethod === m
                        ? "bg-blue-500 text-white"
                        : "bg-[#1e2d4a] text-slate-400 hover:text-white")
                    }
                  >
                    {m}
                  </button>
                ))}
                {(filterBuyer || filterMethod) && (
                  <button
                    onClick={() => { setFilterBuyer(""); setFilterMethod(null); }}
                    className="text-[11px] px-2.5 py-1 rounded-full font-semibold transition cursor-pointer bg-slate-700 text-slate-300 hover:text-white"
                  >
                    {"Tout"}
                  </button>
                )}
              </div>
              {filteredTx.length === 0 ? (
                <p className="text-slate-600 text-center py-10 text-sm">
                  {filterBuyer || filterMethod
                    ? "Aucune transaction pour ce filtre"
                    : "Aucune transaction"}
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredTx.slice(0, 100).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center gap-2 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3.5 py-2.5"
                    >
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-sm font-semibold">
                          {tx.items}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {(tx.buyer || "\u2014") +
                            " \u2022 " +
                            (tx.method === "especes"
                              ? "\uD83D\uDCB0"
                              : tx.method === "avoir"
                                ? "\uD83D\uDCB3 avoir"
                                : tx.method === "offert"
                                  ? "\uD83C\uDF81 offert"
                                  : "\uD83D\uDCB3") +
                            " " +
                            tx.method}
                        </span>
                      </div>
                      <span
                        className={
                          "text-sm font-bold min-w-[50px] text-right " +
                          (tx.total === 0
                            ? "text-purple-400"
                            : "text-amber-500")
                        }
                      >
                        {tx.total === 0 ? "Offert" : formatPrice(tx.total)}
                      </span>
                      <span className="text-[11px] text-slate-500 min-w-[90px] text-right">
                        {formatDate(tx.date)}
                      </span>
                      <button
                        onClick={() => editTransaction(tx)}
                        className="text-amber-500 opacity-40 hover:opacity-100 text-sm cursor-pointer shrink-0"
                      >
                        {"\u270F\uFE0F"}
                      </button>
                      <button
                        onClick={() => deleteTransaction(tx)}
                        className="text-red-500 opacity-40 hover:opacity-100 text-sm cursor-pointer shrink-0"
                      >
                        {"\u2715"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {transactions.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("Effacer tout l\u0027historique ?")) {
                      setTransactions([]);
                      showToast("Historique efface", "info");
                    }
                  }}
                  className="self-center mt-2 px-4 py-2.5 rounded-lg bg-[#1c1917] border border-red-900 text-red-300 text-sm font-semibold hover:bg-red-950 transition cursor-pointer"
                >
                  {"Effacer l\u0027historique"}
                </button>
              )}
            </div>
          )}

          {activeAdminTab === "members" && (
            <div className="flex flex-col gap-2">
              {/* Cash in box */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-[#0f172a] border border-[#1e2d4a] rounded-xl p-4">
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block mb-2">
                    {"Caisse especes"}
                  </span>
                  <span className="text-2xl font-extrabold text-amber-500">
                    {formatPrice(settings.cashInBox || 0)}
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Ajuster..."
                    className="w-full h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none mt-2"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = parseFloat(
                          (e.target as HTMLInputElement).value,
                        );
                        if (!isNaN(v)) {
                          setSettings((prev) => ({ ...prev, cashInBox: v }));
                          (e.target as HTMLInputElement).value = "";
                          showToast("Caisse mise a jour");
                        }
                      }
                    }}
                  />
                </div>
                <div className="bg-[#0f172a] border border-blue-900 rounded-xl p-4">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-2">
                    {"Recu par CB"}
                  </span>
                  <span className="text-2xl font-extrabold text-blue-400">
                    {formatPrice(settings.cbReceived || 0)}
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Ajuster..."
                    className="w-full h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none mt-2"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = parseFloat(
                          (e.target as HTMLInputElement).value,
                        );
                        if (!isNaN(v)) {
                          setSettings((prev) => ({ ...prev, cbReceived: v }));
                          (e.target as HTMLInputElement).value = "";
                          showToast("CB mise a jour");
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    {"Fond initial especes"}
                  </span>
                  <span className="text-lg font-extrabold text-slate-300">
                    {formatPrice(settings.cashInitialFund || 0)}
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Fond de depart..."
                    className="w-full h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none mt-2"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = parseFloat(
                          (e.target as HTMLInputElement).value,
                        );
                        if (!isNaN(v)) {
                          setSettings((prev) => ({ ...prev, cashInitialFund: v }));
                          (e.target as HTMLInputElement).value = "";
                          showToast("Fond initial especes mis a jour");
                        }
                      }
                    }}
                  />
                </div>
                <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    {"Fond initial CB"}
                  </span>
                  <span className="text-lg font-extrabold text-slate-300">
                    {formatPrice(settings.cbInitialFund || 0)}
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Fond de depart..."
                    className="w-full h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none mt-2"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = parseFloat(
                          (e.target as HTMLInputElement).value,
                        );
                        if (!isNaN(v)) {
                          setSettings((prev) => ({ ...prev, cbInitialFund: v }));
                          (e.target as HTMLInputElement).value = "";
                          showToast("Fond initial CB mis a jour");
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => {
                    fetch("/api/fridge?action=trigger&lock=cafe").catch(
                      () => {},
                    );
                    showToast("Cafe ouvert 15s !");
                  }}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-amber-700 text-white active:scale-95 cursor-pointer"
                >
                  {"\u2615 Ouvrir cafe"}
                </button>
                <button
                  onClick={() => {
                    fetch("/api/fridge?action=trigger&lock=frigo").catch(
                      () => {},
                    );
                    showToast("Frigo ouvert 15s !");
                  }}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white active:scale-95 cursor-pointer"
                >
                  {"\uD83E\uDDCA Ouvrir frigo"}
                </button>
                <button
                  onClick={() => {
                    fetch("/api/fridge?action=trigger&lock=both").catch(
                      () => {},
                    );
                    showToast("Tout ouvert 15s !");
                  }}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-emerald-600 text-white active:scale-95 cursor-pointer"
                >
                  {"\uD83D\uDD13 Ouvrir tout"}
                </button>
              </div>

              {/* Member accounts */}
              {/* Member accounts */}
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {"Tous les membres"}
              </span>
              {(() => {
                const allNamesRaw = [
                  ...members.map((m) => m.name),
                  ...transactions.map((t) => t.buyer).filter(Boolean),
                ];
                const seen = new Map<string, string>();
                for (const n of allNamesRaw) {
                  const key = normalizeNameFuzzy(n);
                  if (!seen.has(key)) seen.set(key, n);
                }
                const allNames = [...seen.values()].sort((a, b) =>
                  a.toLowerCase().localeCompare(b.toLowerCase()),
                );
                return allNames.length === 0 ? (
                  <p className="text-slate-600 text-center py-6 text-sm">
                    {"Aucun membre"}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {allNames.map((name) => {
                      const bal = getMemberBalance(name);
                      return (
                        <div
                          key={name}
                          className="flex items-center gap-2 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3.5 py-2.5"
                        >
                          <span className="text-sm font-semibold flex-1">
                            {name}
                          </span>
                          {bal !== 0 && (
                            <span
                              className={
                                "text-sm font-bold " +
                                (bal > 0 ? "text-emerald-400" : "text-red-400")
                              }
                            >
                              {formatPrice(bal)}
                            </span>
                          )}
                          {bal === 0 && (
                            <span className="text-xs text-slate-600">
                              {"Pas d\u0027avoir"}
                            </span>
                          )}
                          <button
                            onClick={() => renameMember(name)}
                            className="text-xs text-slate-500 hover:text-blue-400 cursor-pointer"
                            title="Renommer"
                          >
                            {"\u270F\uFE0F"}
                          </button>
                          <button
                            onClick={() => {
                              const v = prompt(
                                "Nouveau solde pour " +
                                  name +
                                  " (actuel: " +
                                  bal +
                                  ") :",
                              );
                              if (v !== null) {
                                const n = parseFloat(v);
                                if (!isNaN(n)) {
                                  const existing = members.find(
                                    (m) =>
                                      normalizeNameFuzzy(m.name) ===
                                      normalizeNameFuzzy(name),
                                  );
                                  if (existing) {
                                    setMembers((prev) =>
                                      prev.map((x) =>
                                        x.name === existing.name
                                          ? { ...x, balance: n }
                                          : x,
                                      ),
                                    );
                                  } else {
                                    setMembers((prev) => [
                                      ...prev,
                                      { name, balance: n },
                                    ]);
                                  }
                                  showToast("Solde modifie");
                                }
                              }
                            }}
                            className="text-xs text-slate-500 hover:text-amber-500 cursor-pointer"
                            title="Modifier solde"
                          >
                            {"\uD83D\uDCB0"}
                          </button>
                          <button
                            onClick={() => deleteMember(name)}
                            className="text-red-500 opacity-40 hover:opacity-100 text-sm cursor-pointer"
                            title="Supprimer"
                          >
                            {"\u2715"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div className="text-right mt-1">
                <span className="text-xs text-slate-500">
                  {"Total avoirs : "}
                </span>
                <span className="text-sm font-bold text-emerald-400">
                  {formatPrice(
                    members.reduce((s, m) => s + Math.max(0, m.balance), 0),
                  )}
                </span>
              </div>
            </div>
          )}

          {activeAdminTab === "suggestions" && (
            <div className="flex flex-col gap-2">
              {suggestions.length === 0 ? (
                <p className="text-slate-600 text-center py-10 text-sm">
                  {"Aucune suggestion pour le moment"}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {suggestions.map((s) => (
                    <div
                      key={s.id}
                      className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm text-slate-200">{s.text}</p>
                          <p className="text-[11px] text-slate-500 mt-1.5">
                            {s.author + " \u2022 " + formatDate(s.date)}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteSuggestion(s.id)}
                          className="text-red-500 opacity-50 hover:opacity-100 text-sm cursor-pointer shrink-0"
                        >
                          {"\u2715"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {suggestions.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("Effacer toutes les suggestions ?")) {
                      setSuggestions([]);
                      showToast("Suggestions effacees", "info");
                    }
                  }}
                  className="self-center mt-2 px-4 py-2.5 rounded-lg bg-[#1c1917] border border-red-900 text-red-300 text-sm font-semibold hover:bg-red-950 transition cursor-pointer"
                >
                  {"Effacer toutes les suggestions"}
                </button>
              )}
            </div>
          )}

          {activeAdminTab === "settings" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {"Nom du club"}
                </label>
                <input
                  value={settings.clubName}
                  onChange={(e) =>
                    setSettings({ ...settings, clubName: e.target.value })
                  }
                  className="h-10 rounded-xl border border-slate-700 bg-[#131b2e] text-white text-sm px-3.5 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {"Code PIN admin"}
                </label>
                <input
                  type="password"
                  value={settings.adminPin}
                  onChange={(e) =>
                    setSettings({ ...settings, adminPin: e.target.value })
                  }
                  className="h-10 rounded-xl border border-slate-700 bg-[#131b2e] text-white text-sm px-3.5 outline-none"
                  maxLength={6}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {"Code PIN Bureau"}
                </label>
                <input
                  type="password"
                  value={settings.bureauPin || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, bureauPin: e.target.value })
                  }
                  className="h-10 rounded-xl border border-slate-700 bg-[#131b2e] text-white text-sm px-3.5 outline-none"
                  maxLength={6}
                />
              </div>
              <div className="h-px bg-[#1e2d4a] my-3" />
              <h3 className="text-base font-bold">
                {"\uD83D\uDCB3 SumUp API"}
              </h3>
              <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-4 text-sm text-slate-400 leading-relaxed">
                <p className="font-semibold text-slate-200 mb-2">
                  {"Configuration :"}
                </p>
                <p>
                  {
                    "Les variables sont dans Vercel > Settings > Environment Variables :"
                  }
                </p>
                <pre className="bg-black/30 rounded-lg p-3 mt-2 text-xs text-amber-400 overflow-x-auto">
                  {
                    "SUMUP_API_KEY=sup_sk_xxx\nSUMUP_MERCHANT_CODE=MQxxxxxx\nNEXT_PUBLIC_APP_URL=https://votre-app.vercel.app"
                  }
                </pre>
              </div>
              <div className="h-px bg-[#1e2d4a] my-3" />
              <h3 className="text-base font-bold">{"\uD83D\uDCC8 Export"}</h3>
              <button
                onClick={() => {
                  const csv = [
                    "Date,Articles,Total,Cout,Benefice,Acheteur,Methode",
                    ...transactions.map(
                      (t) =>
                        t.date +
                        ',"' +
                        t.items +
                        '",' +
                        t.total +
                        "," +
                        (t.totalCost || 0) +
                        "," +
                        (t.total - (t.totalCost || 0)) +
                        ',"' +
                        (t.buyer || "") +
                        '",' +
                        t.method,
                    ),
                  ].join("\n");
                  const blob = new Blob([csv], {
                    type: "text/csv;charset=utf-8;",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "aeroclub-transactions-" + todayStr + ".csv";
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast("Export CSV telecharge !");
                }}
                className="self-start px-4 py-2.5 rounded-lg bg-[#1e2d4a] text-amber-500 text-sm font-semibold hover:bg-[#253550] transition cursor-pointer"
              >
                {"Exporter en CSV"}
              </button>
              <div className="h-px bg-[#1e2d4a] my-3" />
              <button
                onClick={() => {
                  if (confirm("Remettre les produits par defaut ?")) {
                    setProducts(DEFAULT_PRODUCTS);
                    showToast("Produits reinitialises", "info");
                  }
                }}
                className="self-start px-4 py-2.5 rounded-lg bg-[#1c1917] border border-red-900 text-red-300 text-sm font-semibold cursor-pointer"
              >
                {"Reinitialiser les produits"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modale réapprovisionnement */}
      {restockingProduct && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-4"
          onClick={() => setRestockingProduct(null)}
        >
          <div
            className="w-full max-w-sm bg-[#131b2e] rounded-2xl p-5 flex flex-col gap-4 border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-white text-base">
              {restockingProduct.emoji + " " + restockingProduct.name + " — Réappro"}
            </h3>

            <div className="flex flex-col gap-3">
              {/* Quantité */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-semibold">{"Quantité achetée"}</label>
                <input
                  type="number"
                  min="1"
                  value={restockForm.qty}
                  onChange={(e) => setRestockForm((f) => ({ ...f, qty: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="h-11 rounded-xl border border-slate-700 bg-[#0f172a] text-white text-center text-base outline-none"
                />
              </div>

              {/* Prix de vente */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-semibold">
                  {"Prix de vente (actuel : " + formatPrice(restockingProduct.price) + ")"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={restockForm.newPrice}
                  onChange={(e) => setRestockForm((f) => ({ ...f, newPrice: Math.max(0, parseFloat(e.target.value) || 0) }))}
                  className={"h-11 rounded-xl border text-white text-center text-base outline-none bg-[#0f172a] " + (restockForm.newPrice !== restockingProduct.price ? "border-amber-500" : "border-slate-700")}
                />
                {restockForm.newPrice !== restockingProduct.price && (
                  <span className="text-[10px] text-amber-400">{"⚠ Prix modifié — l'ancien stock sera vendu à " + formatPrice(restockingProduct.price)}</span>
                )}
              </div>

              {/* Coût d'achat unitaire */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-semibold">{"Coût d'achat unitaire"}</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={restockForm.newCost}
                  onChange={(e) => setRestockForm((f) => ({ ...f, newCost: Math.max(0, parseFloat(e.target.value) || 0) }))}
                  className="h-11 rounded-xl border border-slate-700 bg-[#0f172a] text-white text-center text-base outline-none"
                />
              </div>

              {/* Méthode de paiement */}
              <div className="flex gap-2">
                {(["especes", "carte"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setRestockForm((f) => ({ ...f, method: m }))}
                    className={"flex-1 py-2 rounded-xl text-sm font-semibold cursor-pointer transition " + (restockForm.method === m ? "bg-amber-500 text-black" : "bg-[#0f172a] text-slate-400 border border-slate-700")}
                  >
                    {m === "especes" ? "💵 Espèces" : "💳 Carte"}
                  </button>
                ))}
              </div>

              {/* Total */}
              <div className="bg-[#0f172a] rounded-xl p-3 flex justify-between items-center border border-slate-700">
                <span className="text-sm text-slate-400">{"Total achat"}</span>
                <span className="text-base font-extrabold text-red-400">{formatPrice(restockForm.qty * restockForm.newCost)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setRestockingProduct(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1e2d4a] text-slate-300 text-sm font-semibold cursor-pointer"
              >
                {"Annuler"}
              </button>
              <button
                onClick={confirmRestock}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer active:scale-95"
              >
                {"✓ Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
