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
  coffeeServings?: number;
  legacyStock?: number;
  legacyPrice?: number;
  archived?: boolean;
  category?: string;
  location?: "frigo" | "cafe" | "congelateur";
}

interface Batch {
  id: string;
  productId: string;
  qty: number;
  location: "frigo" | "reserve";
  purchaseDate: string;
  expiryDate?: string;
  unitCost: number;
}

interface Category {
  id: string;
  label: string;
  emoji: string;
  hasCupCost?: boolean;
}

const EMOJI_CATEGORIES = [
  { label: "🥤", title: "Soft / eau", emojis: ["🥤","🧃","💧","🫙","🧋","🍵","☕","🫖","🥛","🫗","🧊","🍶","🍼"] },
  { label: "🍺", title: "Alcool", emojis: ["🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🫗","🥴"] },
  { label: "🍦", title: "Glaces", emojis: ["🍦","🍧","🍨","🍡","🍢","🍣","🧊","🫐","🍓"] },
  { label: "🍫", title: "Choco & bonbons", emojis: ["🍫","🍬","🍭","🍮","🍯","🍩","🍪","🧁","🎂","🍰","🥧","🍮"] },
  { label: "🥐", title: "Viennoiseries", emojis: ["🥐","🥖","🍞","🥨","🥯","🧇","🥞","🧆","🫓","🥚","🍳"] },
  { label: "🍿", title: "Snacks salés", emojis: ["🍿","🥜","🌰","🧀","🥪","🌮","🌯","🥙","🫔","🍱","🥗","🍟","🍔","🌭"] },
  { label: "🍎", title: "Fruits", emojis: ["🍎","🍊","🍋","🍇","🍓","🫐","🍌","🍉","🍑","🍒","🥝","🍍","🥭","🍐","🍈","🫒","🥥"] },
  { label: "🧴", title: "Hygiène / divers", emojis: ["🧴","🧻","🪥","🧼","💊","🩺","🌡️","🔑","🎫","🪙","💵","🛒","📦","🎁","⭐","🏷️"] },
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
  cashInBox?: number;       // reprise trésorerie espèces
  cbReceived?: number;      // reprise trésorerie CB
  cashInitialFund?: number; // reprise CA espèces
  cbInitialFund?: number;   // reprise CA CB
  costReprise?: number;     // reprise coûts (avant suivi)
  cupCost?: number;
  sumupFeeRate?: number;
  categories?: Category[];
  supportPhone?: string;
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

const DEFAULT_CATEGORIES: Category[] = [
  { id: "boissons", label: "Boissons", emoji: "🍺" },
  { id: "cafe", label: "Café", emoji: "☕", hasCupCost: true },
  { id: "nourriture", label: "Bouffe", emoji: "🍫" },
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
async function loadFromServer(): Promise<{ data: Record<string, unknown> | null; ok: boolean }> {
  try {
    const res = await fetch("/api/data");
    if (!res.ok) return { data: null, ok: false };
    const json = await res.json();
    if (json.error) return { data: null, ok: false };
    return { data: json, ok: true };
  } catch {
    return { data: null, ok: false };
  }
}

async function loadFromServerWithRetry(maxRetries = 3): Promise<{ data: Record<string, unknown> | null; ok: boolean }> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await loadFromServer();
    if (result.ok) return result;
    // Wait before retrying (1s, 2s, 4s)
    await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, i), 4000)));
  }
  return { data: null, ok: false };
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

// LocalStorage backup keys
const LS_BACKUP_PREFIX = "aeroclub-backup-";
function backupToLocalStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(LS_BACKUP_PREFIX + key, JSON.stringify(value));
    localStorage.setItem(LS_BACKUP_PREFIX + key + "-ts", Date.now().toString());
  } catch { /* quota exceeded — ignore */ }
}
function restoreFromLocalStorage(key: string): unknown | null {
  try {
    const raw = localStorage.getItem(LS_BACKUP_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
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
    lockType: string;
  } | null>(null);
  const [sumupLoading, setSumupLoading] = useState(false);
  const [sumupError, setSumupError] = useState<string | null>(null);
  const [sumupCheckoutId, setSumupCheckoutId] = useState<string | null>(null);
  const [sumupPolling, setSumupPolling] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<{ name: string; emoji: string; price: number; cost: number; stock: number; stockReserve: number; coffeeServings?: number; location?: "frigo" | "cafe" | "congelateur" }>({
    name: "",
    emoji: "\uD83E\uDD64",
    price: 1.0,
    cost: 0.5,
    stock: 20,
    stockReserve: 0,
    location: "frigo",
  });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingTxFull, setEditingTxFull] = useState<{ tx: Transaction; lines: { productId: string; qty: number }[] } | null>(null);
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [restockForm, setRestockForm] = useState<{ qty: number; newPrice: number; newCost: number; method: "especes" | "carte"; expiryDate?: string }>({ qty: 1, newPrice: 0, newCost: 0, method: "especes" });
  const [lockRetriggerCountdown, setLockRetriggerCountdown] = useState<number | null>(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState<"new" | "edit" | null>(null);
  const [emojiPickerCategory, setEmojiPickerCategory] = useState(0);
  const [saleCategory, setSaleCategory] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryForm, setNewCategoryForm] = useState<{ label: string; emoji: string; hasCupCost: boolean } | null>(null);
  const [coffeeCredits, setCoffeeCredits] = useState<Record<string, number>>({});
  const [coffeeModal, setCoffeeModal] = useState<{ buyer: string; totalServings: number; lockType: "cafe" | "both"; productId: string } | null>(null);
  const [coffeeAvoirUsedInCheckout, setCoffeeAvoirUsedInCheckout] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [editingMember, setEditingMember] = useState<{ name: string; newName: string; balance: number; coffee: number } | null>(null);
  const saveTimeout = useRef<Record<string, NodeJS.Timeout>>({});
  const hasLoaded = useRef(false);
  const sumupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sumupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockRetriggerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Debounced save to avoid too many API calls
  // CRITICAL: never save if load never succeeded (prevents overwriting real data with defaults)
  const debouncedSave = useCallback((key: string, value: unknown) => {
    if (!hasLoaded.current) return;
    if (saveTimeout.current[key]) clearTimeout(saveTimeout.current[key]);
    setSaveStatus("saving");
    saveTimeout.current[key] = setTimeout(async () => {
      const ok = await saveToServer(key, value);
      setSaveStatus(ok ? "idle" : "error");
      // Backup to localStorage on every successful save
      if (ok) backupToLocalStorage(key, value);
    }, 1000);
  }, []);

  // Load data from server with retry + localStorage fallback
  useEffect(() => {
    (async () => {
      const { data, ok } = await loadFromServerWithRetry(3);
      if (ok && data) {
        // Server load succeeded — apply data
        if (data.products) setProducts(data.products as Product[]);
        if (data.transactions) setTransactions(data.transactions as Transaction[]);
        if (data.settings) setSettings(data.settings as Settings);
        if (data.suggestions) setSuggestions(data.suggestions as Suggestion[]);
        if (data.members) setMembers(data.members as MemberAccount[]);
        if (data.procurements) setProcurements(data.procurements as Procurement[]);
        if (data.coffeeCredits) setCoffeeCredits(data.coffeeCredits as Record<string, number>);
        if (data.batches) setBatches(data.batches as Batch[]);
        // Immediately backup to localStorage
        if (data.products) backupToLocalStorage("aeroclub-products", data.products);
        if (data.transactions) backupToLocalStorage("aeroclub-transactions", data.transactions);
        if (data.settings) backupToLocalStorage("aeroclub-settings", data.settings);
        if (data.suggestions) backupToLocalStorage("aeroclub-suggestions", data.suggestions);
        if (data.members) backupToLocalStorage("aeroclub-members", data.members);
        if (data.procurements) backupToLocalStorage("aeroclub-procurements", data.procurements);
        if (data.coffeeCredits) backupToLocalStorage("aeroclub-coffee-credits", data.coffeeCredits);
        if (data.batches) backupToLocalStorage("aeroclub-batches", data.batches);
        setLoading(false);
        // Enable saves only after successful load + small delay for React state to settle
        setTimeout(() => { hasLoaded.current = true; }, 2000);
      } else {
        // Server load FAILED — try localStorage backup
        console.error("Server load failed after 3 retries, trying localStorage backup...");
        const lsProducts = restoreFromLocalStorage("aeroclub-products");
        const lsTransactions = restoreFromLocalStorage("aeroclub-transactions");
        const lsSettings = restoreFromLocalStorage("aeroclub-settings");
        const lsSuggestions = restoreFromLocalStorage("aeroclub-suggestions");
        const lsMembers = restoreFromLocalStorage("aeroclub-members");
        const lsProcurements = restoreFromLocalStorage("aeroclub-procurements");
        const lsCoffeeCredits = restoreFromLocalStorage("aeroclub-coffee-credits");
        const lsBatches = restoreFromLocalStorage("aeroclub-batches");
        if (lsProducts) setProducts(lsProducts as Product[]);
        if (lsTransactions) setTransactions(lsTransactions as Transaction[]);
        if (lsSettings) setSettings(lsSettings as Settings);
        if (lsSuggestions) setSuggestions(lsSuggestions as Suggestion[]);
        if (lsMembers) setMembers(lsMembers as MemberAccount[]);
        if (lsProcurements) setProcurements(lsProcurements as Procurement[]);
        if (lsCoffeeCredits) setCoffeeCredits(lsCoffeeCredits as Record<string, number>);
        if (lsBatches) setBatches(lsBatches as Batch[]);
        setLoadFailed(true);
        setLoading(false);
        // CRITICAL: hasLoaded stays FALSE — saves are BLOCKED to prevent overwriting server data
      }
    })();
  }, []);

  // Auto-migration: create legacy batches from existing stock for products that have no batches
  useEffect(() => {
    if (loading) return;
    setBatches((prev) => {
      if (prev.length > 0) return prev;
      const migrated: Batch[] = [];
      for (const p of products) {
        if (p.stock > 0) {
          migrated.push({
            id: "legacy-frigo-" + p.id,
            productId: p.id,
            qty: p.stock,
            location: "frigo",
            purchaseDate: new Date().toISOString(),
            unitCost: p.cost,
          });
        }
        if ((p.stockReserve ?? 0) > 0) {
          migrated.push({
            id: "legacy-reserve-" + p.id,
            productId: p.id,
            qty: p.stockReserve!,
            location: "reserve",
            purchaseDate: new Date().toISOString(),
            unitCost: p.cost,
          });
        }
      }
      return migrated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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
  useEffect(() => {
    if (!loading) debouncedSave("aeroclub-coffee-credits", coffeeCredits);
  }, [coffeeCredits, loading, debouncedSave]);
  useEffect(() => {
    if (!loading) debouncedSave("aeroclub-batches", batches);
  }, [batches, loading, debouncedSave]);

  // Auto-backup vers Redis toutes les 5 minutes (clé séparée, ne peut pas être écrasée par la race condition)
  useEffect(() => {
    if (!hasLoaded.current && !loading) return;
    const backupInterval = setInterval(() => {
      if (!hasLoaded.current) return;
      fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save" }),
      }).catch(() => {});
    }, 5 * 60 * 1000); // 5 minutes
    // Premier backup 30s après le chargement
    const initialBackup = setTimeout(() => {
      if (hasLoaded.current) {
        fetch("/api/backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save" }),
        }).catch(() => {});
      }
    }, 30000);
    return () => { clearInterval(backupInterval); clearTimeout(initialBackup); };
  }, [loading]);

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

  const getCategories = () => settings.categories || DEFAULT_CATEGORIES;
  const effectiveStock = (p: Product) => Math.floor(p.stock / (p.coffeeServings || 1));

  // Batch helpers — DLC alerts
  const batchesForProduct = useCallback((pid: string) => batches.filter(b => b.productId === pid && b.qty > 0), [batches]);
  const expiredBatches = batches.filter(b => b.expiryDate && new Date(b.expiryDate) < new Date() && b.qty > 0);
  const expiringBatches = batches.filter(b => {
    if (!b.expiryDate || b.qty <= 0) return false;
    const exp = new Date(b.expiryDate);
    const now = new Date();
    return exp >= now && exp <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  });

  const cartTotal = cart.reduce((s, i) => s + getFifoTotal(i.product, i.qty), 0);
  const cartTotalCost = cart.reduce(
    (s, i) => {
      const cat = getCategories().find((c) => c.id === i.product.category);
      return s + ((i.product.cost || 0) + (cat?.hasCupCost ? (settings.cupCost || 0) : 0)) * i.qty;
    },
    0,
  );
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // Normalize a full name by sorting tokens alphabetically so
  // Rendu de l'icône produit : emoji texte OU image si l'emoji est une URL http
  const renderProductIcon = (emoji: string, className: string, imgSize = "w-8 h-8") => {
    if (emoji.startsWith("http")) {
      return <img src={emoji} alt="" className={imgSize + " object-contain rounded"} />;
    }
    return <span className={className}>{emoji}</span>;
  };

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
    if (effectiveStock(p) <= 0) return;
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === p.id);
      if (ex) {
        if (ex.qty >= effectiveStock(p)) return prev;
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
    setCoffeeAvoirUsedInCheckout(false);
  };
  const getCartQty = (pid: string) => {
    const i = cart.find((c) => c.product.id === pid);
    return i ? i.qty : 0;
  };

  const confirmRestock = () => {
    if (!restockingProduct || restockForm.qty <= 0) return;
    const p = restockingProduct;
    // newCost = prix total d'achat (saisi par l'utilisateur)
    const totalCost = Math.round(restockForm.newCost * 100) / 100;
    const unitCost = Math.round((restockForm.newCost / restockForm.qty) * 100) / 100;
    const priceChanged = restockForm.newPrice !== p.price;

    setProducts((prev) =>
      prev.map((x) => {
        if (x.id !== p.id) return x;
        const existingLegacy = x.legacyStock || 0;
        const existingLegacyPrice = x.legacyPrice;
        // Si le prix change : tout le stock frigo devient legacy au prix courant
        // (le réappro va en réserve, pas en frigo)
        const newLegacyStock = priceChanged
          ? x.stock
          : existingLegacy;
        const newLegacyPrice = priceChanged
          ? x.price
          : existingLegacyPrice;
        return {
          ...x,
          stockReserve: (x.stockReserve ?? 0) + restockForm.qty,
          cost: unitCost,
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
      unitCost,
      totalCost,
      method: restockForm.method,
    };
    setProcurements((prev) => [entry, ...prev]);

    // Create batch for DLC tracking
    const newBatch: Batch = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      productId: p.id,
      qty: restockForm.qty,
      location: "reserve",
      purchaseDate: new Date().toISOString(),
      expiryDate: restockForm.expiryDate ? restockForm.expiryDate + "T23:59:59" : undefined,
      unitCost,
    };
    setBatches((prev) => [...prev, newBatch]);

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
    // Déduire le stock via updater fonctionnel (évite d'écraser un state modifié entre-temps)
    const cartSnapshot = [...cart];
    setProducts((prev) => {
      let updated = prev;
      for (const item of cartSnapshot) {
        updated = updated.map((p) => {
          if (p.id !== item.product.id) return p;
          // Produits café : la déduction est reportée dans handleCoffeeChoice (selon servings utilisés)
          if (item.product.coffeeServings && item.product.coffeeServings > 1) return p;
          let newLegacyStock = p.legacyStock || 0;
          const fromLegacy = Math.min(newLegacyStock, item.qty);
          newLegacyStock = Math.max(0, newLegacyStock - fromLegacy);
          return { ...p, stock: Math.max(0, p.stock - item.qty), legacyStock: newLegacyStock };
        });
      }
      // Alertes Telegram sur les produits mis à jour
      const cartProductIds = cartSnapshot.map((c) => c.product.id);
      for (const p of updated) {
        if (!cartProductIds.includes(p.id)) continue;
        if (p.stock === 0) {
          fetch("/api/alert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productName: p.name, stock: 0, level: "critical" }),
          }).catch(() => {});
        } else if (p.stock <= 2) {
          fetch("/api/alert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productName: p.name, stock: p.stock, level: "alert" }),
          }).catch(() => {});
        } else if (p.stock <= 5) {
          fetch("/api/alert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productName: p.name, stock: p.stock, level: "info" }),
          }).catch(() => {});
        }
      }
      return updated;
    });

    // Handle member balance
    if (method === "avoir") {
      updateMemberBalance(canonicalBuyer, -cartTotal);
    } else if (method === "especes" && amountPaid !== undefined) {
      const change = amountPaid - cartTotal;
      if (change > 0) {
        updateMemberBalance(canonicalBuyer, change);
      }
    }

    // Deverrouille la bonne serrure selon le champ location de chaque produit
    const locationsNeeded = new Set<string>();
    for (const c of cart) {
      const loc = c.product.location || "frigo"; // défaut = frigo
      locationsNeeded.add(loc);
    }
    const hasCafe = locationsNeeded.has("cafe");
    const hasFrigo = locationsNeeded.has("frigo");
    const hasCongelateur = locationsNeeded.has("congelateur");
    // lockType simplifié pour l'affichage du retrigger
    const lockType: string = locationsNeeded.size > 1 ? "both" : [...locationsNeeded][0] || "frigo";

    // Ouvrir TOUTES les serrures nécessaires immédiatement
    if (locationsNeeded.size > 1) {
      fetch("/api/fridge?action=trigger&lock=both").catch(() => {});
    } else {
      fetch("/api/fridge?action=trigger&lock=" + ([...locationsNeeded][0] || "frigo")).catch(() => {});
    }

    // Détecter produits multi-portions café (ex: "2x Cafés") → modal pour les avoirs
    const totalCoffeeServings = cart.reduce(
      (s, c) => s + ((c.product.coffeeServings && c.product.coffeeServings > 1) ? c.qty * c.product.coffeeServings : 0),
      0,
    );
    if (totalCoffeeServings > 0) {
      const coffeeCartItem = cart.find((c) => c.product.coffeeServings && c.product.coffeeServings > 1);
      setCoffeeModal({ buyer: canonicalBuyer, totalServings: totalCoffeeServings, lockType: lockType as "cafe" | "both", productId: coffeeCartItem?.product.id || "" });
    }

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
      lockType,
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

  const handleCoffeeChoice = (usedNow: number) => {
    if (!coffeeModal) return;
    const remaining = coffeeModal.totalServings - usedNow;
    if (remaining > 0) {
      setCoffeeCredits((prev) => ({
        ...prev,
        [coffeeModal.buyer]: (prev[coffeeModal.buyer] || 0) + remaining,
      }));
      showToast(coffeeModal.buyer.split(" ")[0] + " a " + ((coffeeCredits[coffeeModal.buyer] || 0) + remaining) + " avoir(s) café ☕");
    }
    // Déduire uniquement les capsules réellement consommées maintenant
    if (coffeeModal.productId) {
      setProducts((prev) => prev.map((p) => {
        if (p.id !== coffeeModal.productId) return p;
        const fromLegacy = Math.min(p.legacyStock || 0, usedNow);
        return { ...p, stock: Math.max(0, p.stock - usedNow), legacyStock: Math.max(0, (p.legacyStock || 0) - fromLegacy) };
      }));
    }
    setCoffeeModal(null);
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

  const openMemberModal = (name: string) => {
    const bal = getMemberBalance(name);
    const coffee = coffeeCredits[name] || 0;
    setEditingMember({ name, newName: name, balance: bal, coffee });
  };

  const saveMember = () => {
    if (!editingMember) return;
    const { name: oldName, newName, balance, coffee } = editingMember;
    const trimmedNew = newName.trim();
    if (!trimmedNew) { showToast("Nom requis", "error"); return; }
    const oldKey = normalizeNameFuzzy(oldName);

    // Update or create member with new balance
    const existingMember = members.find((m) => normalizeNameFuzzy(m.name) === oldKey);
    if (existingMember) {
      setMembers((prev) => prev.map((m) =>
        normalizeNameFuzzy(m.name) === oldKey ? { ...m, name: trimmedNew, balance } : m
      ));
    } else {
      setMembers((prev) => [...prev, { name: trimmedNew, balance }]);
    }

    // Rename in transactions if name changed
    if (trimmedNew !== oldName) {
      setTransactions((prev) => prev.map((t) =>
        normalizeNameFuzzy(t.buyer) === oldKey ? { ...t, buyer: trimmedNew } : t
      ));
    }

    // Update coffee credits
    setCoffeeCredits((prev) => {
      const next = { ...prev };
      // Remove old name entry
      if (oldName in next) delete next[oldName];
      // Set new value (or remove if 0)
      if (coffee > 0) {
        next[trimmedNew] = coffee;
      } else {
        delete next[trimmedNew];
      }
      return next;
    });

    setEditingMember(null);
    showToast(trimmedNew !== oldName ? "Membre modifie : " + trimmedNew : "Membre modifie");
  };

  const deleteMember = (name: string) => {
    const nameKey = normalizeNameFuzzy(name);
    setMembers((prev) =>
      prev.filter((m) => normalizeNameFuzzy(m.name) !== nameKey),
    );
    setTransactions((prev) =>
      prev.filter((t) => normalizeNameFuzzy(t.buyer || "") !== nameKey),
    );
    setCoffeeCredits((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setEditingMember(null);
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
          u = u.map((p) => {
            if (p.name !== name) return p;
            // Pour les produits café (coffeeServings > 1), la déduction était en capsules
            const restoreQty = qty * (p.coffeeServings || 1);
            return { ...p, stock: p.stock + restoreQty };
          });
        }
      }
      return u;
    });
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
    showToast("Vente supprimee, stock restaure", "info");
  };

  const parseTxItems = (itemsStr: string): { productId: string; qty: number }[] => {
    return itemsStr
      .split(", ")
      .map((part) => {
        const m = part.match(/^(\d+)x (.+)$/);
        if (!m) return null;
        const qty = parseInt(m[1], 10);
        const name = m[2];
        const product = products.find((p) => p.name === name);
        return product ? { productId: product.id, qty } : null;
      })
      .filter((x): x is { productId: string; qty: number } => x !== null);
  };

  const editTransaction = (tx: Transaction) => {
    setEditingTxFull({ tx, lines: parseTxItems(tx.items) });
  };

  const saveTxEdit = () => {
    if (!editingTxFull) return;
    const { tx, lines } = editingTxFull;
    const validLines = lines.filter((l) => l.qty > 0);
    if (validLines.length === 0) {
      showToast("Au moins une ligne requise", "error");
      return;
    }
    // Calcul du delta de stock : restore l'ancien, déduit le nouveau
    const oldLines = parseTxItems(tx.items);
    const stockDelta: Record<string, number> = {};
    for (const old of oldLines) {
      const p = products.find((pr) => pr.id === old.productId);
      if (!p) continue;
      stockDelta[old.productId] = (stockDelta[old.productId] || 0) + old.qty * (p.coffeeServings || 1);
    }
    for (const nl of validLines) {
      const p = products.find((pr) => pr.id === nl.productId);
      if (!p) continue;
      stockDelta[nl.productId] = (stockDelta[nl.productId] || 0) - nl.qty * (p.coffeeServings || 1);
    }
    setProducts((prev) =>
      prev.map((p) => {
        const d = stockDelta[p.id] || 0;
        if (d === 0) return p;
        return { ...p, stock: Math.max(0, p.stock + d) };
      }),
    );
    // Recalcul items, total, totalCost
    const newItemsStr = validLines
      .map((l) => {
        const p = products.find((pr) => pr.id === l.productId);
        return p ? l.qty + "x " + p.name : "";
      })
      .filter(Boolean)
      .join(", ");
    const newTotal = validLines.reduce((s, l) => {
      const p = products.find((pr) => pr.id === l.productId);
      return s + (p ? getFifoTotal(p, l.qty) : 0);
    }, 0);
    const newTotalCost = validLines.reduce((s, l) => {
      const p = products.find((pr) => pr.id === l.productId);
      if (!p) return s;
      const cat = (settings.categories || DEFAULT_CATEGORIES).find((c) => c.id === p.category);
      const cupCost = cat?.hasCupCost ? settings.cupCost || 0 : 0;
      return s + l.qty * ((p.cost || 0) + cupCost);
    }, 0);
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === tx.id
          ? {
              ...t,
              items: newItemsStr,
              total: Math.round(newTotal * 100) / 100,
              totalCost: Math.round(newTotalCost * 100) / 100,
              method: newTotal === 0 ? "offert" : t.method,
            }
          : t,
      ),
    );
    setEditingTxFull(null);
    showToast("Transaction modifiée, stock ajusté");
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTx = transactions.filter((t) => t.date.slice(0, 10) === todayStr);
  const todayRevenue = todayTx.reduce((s, t) => s + t.total, 0);
  const totalRevenue = transactions.reduce((s, t) => s + t.total, 0);
  const totalCost = transactions.reduce((s, t) => s + (t.totalCost || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const sumupRate = (settings.sumupFeeRate ?? 2.5) / 100;
  const totalSumupFees = Math.round(transactions.filter((t) => t.method === "carte").reduce((s, t) => s + t.total * sumupRate, 0) * 100) / 100;
  const totalProfitNet = Math.round((totalProfit - totalSumupFees) * 100) / 100;
  const todayCost = todayTx.reduce((s, t) => s + (t.totalCost || 0), 0);
  const todayProfit = todayRevenue - todayCost;
  const lowStock = products.filter((p) => effectiveStock(p) <= 5);
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

  // ── CA calculé (reprise CA + ventes) ──
  const txCashRevenue = transactions.filter((t) => t.method === "especes").reduce((s, t) => s + t.total, 0);
  const txCBRevenue = transactions.filter((t) => t.method === "carte").reduce((s, t) => s + t.total, 0);
  const caEspeces = (settings.cashInitialFund || 0) + txCashRevenue;
  const caCB = (settings.cbInitialFund || 0) + txCBRevenue;
  const caTotal = caEspeces + caCB;
  // ── Coûts calculés (reprise coûts + coûts des ventes) ──
  const trackedCosts = transactions.reduce((s, t) => s + (t.totalCost || 0), 0);
  const totalCostsWithReprise = (settings.costReprise || 0) + trackedCosts;
  // ── Trésorerie calculée (reprise tréso + encaissements - achats fournisseurs) ──
  const cashFromSales = transactions.filter((t) => t.method === "especes").reduce((s, t) => s + (t.amountPaid || t.total), 0);
  const cashFromRestocks = procurements.filter((p) => p.method === "especes").reduce((s, p) => s + p.totalCost, 0);
  const cbFromRestocks = procurements.filter((p) => p.method === "carte").reduce((s, p) => s + p.totalCost, 0);
  const treasuryCash = (settings.cashInBox || 0) + cashFromSales - cashFromRestocks;
  const treasuryCB = (settings.cbReceived || 0) + txCBRevenue - cbFromRestocks;
  const treasuryTotal = treasuryCash + treasuryCB;
  const marginPct = caTotal > 0 ? Math.round(((caTotal - totalCostsWithReprise) / caTotal) * 100) : 0;

  if (loading)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0f1c]">
        <div className="w-10 h-10 border-[3px] border-slate-700 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm mt-4">{"Chargement..."}</p>
      </div>
    );

  // Retry loading from server (e.g. after a failed load)
  const retryLoad = async () => {
    setLoading(true);
    setLoadFailed(false);
    const { data, ok } = await loadFromServerWithRetry(3);
    if (ok && data) {
      if (data.products) setProducts(data.products as Product[]);
      if (data.transactions) setTransactions(data.transactions as Transaction[]);
      if (data.settings) setSettings(data.settings as Settings);
      if (data.suggestions) setSuggestions(data.suggestions as Suggestion[]);
      if (data.members) setMembers(data.members as MemberAccount[]);
      if (data.procurements) setProcurements(data.procurements as Procurement[]);
      if (data.coffeeCredits) setCoffeeCredits(data.coffeeCredits as Record<string, number>);
      if (data.batches) setBatches(data.batches as Batch[]);
      setLoading(false);
      setTimeout(() => { hasLoaded.current = true; }, 2000);
    } else {
      setLoadFailed(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-slate-200 relative overflow-hidden">
      {/* CRITICAL: Warning banner when data load failed — saves are blocked */}
      {loadFailed && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex-1">
            <p className="font-bold text-sm">{"⚠️ Connexion serveur échouée"}</p>
            <p className="text-xs text-red-100">{"Les données affichées peuvent être obsolètes. Les modifications ne seront PAS sauvegardées tant que la connexion n'est pas rétablie."}</p>
          </div>
          <button
            onClick={retryLoad}
            className="px-4 py-2 bg-white text-red-600 rounded-lg text-sm font-bold whitespace-nowrap cursor-pointer active:scale-95"
          >
            {"🔄 Réessayer"}
          </button>
        </div>
      )}
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

          {/* Filtres catégorie */}
          {products.some((p) => p.category) && (
            <div className="flex items-center gap-0 w-full max-w-lg bg-[#0d1525] rounded-2xl p-1 mb-2 shadow-inner">
              <button
                onClick={() => setSaleCategory(null)}
                className={"flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer " + (saleCategory === null ? "bg-amber-500 text-black shadow-md" : "text-slate-500 hover:text-slate-300")}
              >{"Tout"}</button>
              {getCategories().filter((c) => products.some((p) => !p.archived && p.category === c.id)).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSaleCategory(cat.id)}
                  className={"flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer " + (saleCategory === cat.id ? "bg-amber-500 text-black shadow-md" : "text-slate-500 hover:text-slate-300")}
                >
                  {cat.emoji + " " + cat.label}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-3xl">
            {products.filter((p) => !p.archived && (!saleCategory || p.category === saleCategory)).map((p) => {
              const out = effectiveStock(p) <= 0;
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
                  {renderProductIcon(p.emoji, "text-3xl", "w-8 h-8")}
                  <span className="text-[11px] font-bold text-center leading-tight">{p.name}</span>
                  <span className="text-sm font-extrabold text-amber-500">
                    {formatPrice(p.price)}
                  </span>
                  {!out && (
                    <span className={"text-[9px] font-semibold " + (effectiveStock(p) <= 5 ? "text-orange-400" : "text-slate-500")}>
                      {effectiveStock(p) <= 5 ? effectiveStock(p) + " restants" : effectiveStock(p)}
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
                      {renderProductIcon(item.product.emoji, "text-lg", "w-6 h-6")}
                      <span className="text-xs font-semibold">
                        {(item.qty > 1 ? item.qty + "x " : "") +
                          item.product.name}
                      </span>
                      <span className="text-xs text-amber-500 font-bold">
                        {formatPrice(getFifoTotal(item.product, item.qty))}
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
                            {renderProductIcon(item.product.emoji, "text-xl", "w-7 h-7")}
                            <span className="text-sm font-semibold">
                              {item.product.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                removeFromCart(item.product.id);
                                if (cart.length === 1 && item.qty === 1) clearCart();
                              }}
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
                              {formatPrice(getFifoTotal(item.product, item.qty))}
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

                    {/* ── Bloc paiement : avoir café prioritaire ou paiement normal ── */}
                    {(() => {
                      const buyerKey = normalizeNameFuzzy(buyerName.trim());
                      const canonical = buyerName.trim() ? (members.find((m) => normalizeNameFuzzy(m.name) === buyerKey)?.name || buyerName.trim()) : "";
                      const cafCredit = canonical ? (coffeeCredits[canonical] || 0) : 0;
                      const cartHasCafe = cart.some((c) =>
                        c.product.name.toLowerCase().includes("café") ||
                        c.product.name.toLowerCase().includes("cafe") ||
                        !!(c.product.coffeeServings && c.product.coffeeServings > 1),
                      );
                      const cartHasFrigo = cart.some((c) =>
                        !c.product.name.toLowerCase().includes("café") &&
                        !c.product.name.toLowerCase().includes("cafe"),
                      );

                      // ── Étape avoir café — uniquement si le panier contient un produit café ──
                      if (cafCredit > 0 && buyerName.trim() && !coffeeAvoirUsedInCheckout && cartHasCafe) {
                        return (
                          <div className="flex flex-col gap-3">
                            {cartHasFrigo && cart.length > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="flex-1 h-px bg-[#1e2d4a]" />
                                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">
                                  {"Étape 1/2 — Café"}
                                </span>
                                <span className="flex-1 h-px bg-[#1e2d4a]" />
                              </div>
                            )}
                            <p className="text-xs text-amber-400 font-semibold text-center">
                              {"☕ " + canonical.split(" ")[0] + " a " + cafCredit + " avoir" + (cafCredit > 1 ? "s" : "") + " café"}
                            </p>
                            <button
                              onClick={() => {
                                fetch("/api/fridge?action=trigger&lock=cafe").catch(() => {});
                                setCoffeeCredits((prev) => {
                                  const next = { ...prev, [canonical]: cafCredit - 1 };
                                  if (next[canonical] <= 0) delete next[canonical];
                                  return next;
                                });
                                // Déduire 1 capsule du produit café
                                setProducts((prev) => {
                                  const cp = prev.find((p) => p.coffeeServings && p.coffeeServings > 1);
                                  if (!cp) return prev;
                                  return prev.map((p) => p.id !== cp.id ? p : {
                                    ...p, stock: Math.max(0, p.stock - 1),
                                    legacyStock: Math.max(0, (p.legacyStock || 0) - Math.min(p.legacyStock || 0, 1)),
                                  });
                                });
                                // Retirer les produits café du panier — couverts par l'avoir
                                const isCafe = (name: string) =>
                                  name.toLowerCase().includes("café") || name.toLowerCase().includes("cafe");
                                const remaining = cart.filter((c) => !isCafe(c.product.name));
                                setCart(remaining);
                                if (remaining.length > 0) {
                                  setCoffeeAvoirUsedInCheckout(true);
                                  showToast("☕ Café déverrouillé — passez au paiement");
                                } else {
                                  showToast("☕ Tiroir café déverrouillé !");
                                  clearCart();
                                  setBuyerName("");
                                }
                              }}
                              className="w-full py-4 rounded-xl font-extrabold text-lg bg-amber-500 text-black active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                            >
                              {"☕ Utiliser mon avoir café"}
                              {cafCredit > 1 && <span className="block text-sm font-semibold opacity-70 mt-0.5">{"(" + cafCredit + " restant" + (cafCredit > 1 ? "s" : "") + ")"}</span>}
                            </button>
                            {cart.length === 0 && (
                              <p className="text-[11px] text-slate-600 text-center">{"Ouvre le tiroir café sans paiement"}</p>
                            )}
                          </div>
                        );
                      }

                      // ── Paiement normal (ou étape 2/2) ──
                      return (
                        <div className="flex flex-col gap-0">
                          {coffeeAvoirUsedInCheckout && cartHasFrigo && (
                            <div className="flex items-center gap-2 mb-3">
                              <span className="flex-1 h-px bg-[#1e2d4a]" />
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                {"Étape 2/2 — Paiement"}
                              </span>
                              <span className="flex-1 h-px bg-[#1e2d4a]" />
                            </div>
                          )}
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
                            onClick={() => { clearCart(); }}
                            className="mt-3 px-5 py-2.5 rounded-lg border border-slate-700 text-slate-400 text-sm font-semibold hover:border-slate-500 transition cursor-pointer"
                          >
                            {"Retour"}
                          </button>
                        </div>
                      );
                    })()}
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
                              {renderProductIcon(item.product.emoji, "text-lg", "w-6 h-6")}
                              <span className="text-sm">
                                {item.qty > 1 ? item.qty + "x " : ""}
                                {item.product.name}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-amber-500">
                              {formatPrice(getFifoTotal(item.product, item.qty))}
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
                            : lastOrder.lockType === "congelateur"
                              ? "\u2744\uFE0F Cong\u00e9lateur d\u00e9verrouill\u00e9 !"
                              : "\uD83D\uDD13 Serrures d\u00e9verrouill\u00e9es !"}
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
            <div className="flex flex-col gap-3">
              {/* DLC Alerts */}
              {expiredBatches.length > 0 && (
                <div className="bg-red-950/50 border border-red-700 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-lg">{"\u26A0\uFE0F"}</span>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-red-400 block">
                      {expiredBatches.length + " lot(s) \u00E9rim\u00E9(s)"}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[...new Set(expiredBatches.map(b => b.productId))].map((pid) => {
                        const p = products.find(x => x.id === pid);
                        return p ? (
                          <button key={pid} onClick={() => setDetailProduct(p)}
                            className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 cursor-pointer hover:bg-red-800/50">
                            {p.name}
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
              )}
              {expiringBatches.length > 0 && (
                <div className="bg-orange-950/40 border border-orange-700 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-lg">{"\uD83D\uDD51"}</span>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-orange-400 block">
                      {expiringBatches.length + " lot(s) expirent dans 7 jours"}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[...new Set(expiringBatches.map(b => b.productId))].map((pid) => {
                        const p = products.find(x => x.id === pid);
                        return p ? (
                          <button key={pid} onClick={() => setDetailProduct(p)}
                            className="text-xs px-2 py-0.5 rounded-full bg-orange-900/50 text-orange-300 cursor-pointer hover:bg-orange-800/50">
                            {p.name}
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Product list — tappable rows */}
              {products.filter(p => !p.archived).map((p, idx) => {
                const pBatches = batchesForProduct(p.id);
                const hasExpired = pBatches.some(b => b.expiryDate && new Date(b.expiryDate) < new Date());
                const hasExpiring = pBatches.some(b => {
                  if (!b.expiryDate) return false;
                  const exp = new Date(b.expiryDate);
                  const now = new Date();
                  return exp >= now && exp <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                });
                return (
                  <div key={p.id} className="flex flex-col rounded-xl border overflow-hidden bg-[#131b2e] border-[#1e2d4a]">
                    <button
                      onClick={() => setDetailProduct(p)}
                      className="flex items-center gap-3 px-3 py-3 w-full text-left cursor-pointer active:bg-[#1e2d4a] transition"
                    >
                      {/* Reorder number */}
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min={1}
                          max={products.filter(x => !x.archived).length}
                          value={idx + 1}
                          onChange={(e) => {
                            const target = parseInt(e.target.value) - 1;
                            if (isNaN(target) || target < 0 || target >= products.filter(x => !x.archived).length) return;
                            setProducts((prev) => {
                              const active = prev.filter(x => !x.archived);
                              const archived = prev.filter(x => x.archived);
                              const item = active[idx];
                              const without = [...active.slice(0, idx), ...active.slice(idx + 1)];
                              without.splice(target, 0, item);
                              return [...without, ...archived];
                            });
                          }}
                          className="w-8 h-8 rounded-lg bg-[#0f172a] border border-slate-700 text-center text-xs font-bold text-slate-400 outline-none focus:border-blue-500 focus:text-white"
                        />
                      </div>
                      {/* Icon */}
                      <span className="w-10 h-10 flex items-center justify-center shrink-0">
                        {renderProductIcon(p.emoji, "text-2xl", "w-10 h-10")}
                      </span>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold block truncate">{p.name}</span>
                        <span className="text-xs text-amber-500 font-semibold">
                          {formatPrice(p.price)}
                          <span className="text-slate-600">{" \u00B7 " + formatPrice(p.cost || 0)}</span>
                        </span>
                      </div>
                      {/* DLC indicator */}
                      {hasExpired && <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" title="Lot(s) p\u00E9rim\u00E9(s)" />}
                      {!hasExpired && hasExpiring && <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0" title="Lot(s) bient\u00F4t p\u00E9rim\u00E9(s)" />}
                      {/* Stock summary */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <span className={p.stock <= 2 ? "text-red-400" : p.stock <= 5 ? "text-orange-400" : "text-white"}>
                            {"\uD83E\uDDCA " + p.stock}
                          </span>
                          <span className="text-slate-600">{"\u00B7"}</span>
                          <span className="text-purple-300">
                            {"\uD83D\uDCE6 " + (p.stockReserve ?? 0)}
                          </span>
                        </div>
                        {p.stock <= 5 && (p.stockReserve ?? 0) === 0 && (
                          <span className="text-[9px] text-red-400 font-bold">{"\u26A0 R\u00E9appro!"}</span>
                        )}
                      </div>
                      {/* Chevron */}
                      <span className="text-slate-600 text-sm shrink-0">{"\u203A"}</span>
                    </button>
                    {/* Quick action bar */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/20 border-t border-white/5">
                      <div className="flex-1 flex items-center gap-1 flex-wrap">
                        {getCategories().map((cat) => (
                          <button key={cat.id}
                            onClick={() => setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, category: x.category === cat.id ? undefined : cat.id } : x))}
                            className={"text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer " + (p.category === cat.id ? "bg-blue-600 text-white" : "bg-[#0f172a] text-slate-500 hover:text-slate-300")}
                          >{cat.emoji}</button>
                        ))}
                        <span className="text-slate-700 mx-0.5">{"|"}</span>
                        {([["frigo", "\uD83E\uDDCA"], ["cafe", "\u2615"], ["congelateur", "\u2744\uFE0F"]] as const).map(([loc, emoji]) => (
                          <button key={loc}
                            onClick={() => setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, location: loc } : x))}
                            className={"text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer " + ((p.location || "frigo") === loc ? "bg-cyan-600 text-white" : "bg-[#0f172a] text-slate-500 hover:text-slate-300")}
                            title={loc === "frigo" ? "Frigo" : loc === "cafe" ? "Caf\u00E9" : "Cong\u00E9lateur"}
                          >{emoji}</button>
                        ))}
                      </div>
                      <button
                        onClick={() => { setRestockingProduct(p); setRestockForm({ qty: 1, newPrice: p.price, newCost: p.cost, method: "especes" }); }}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-emerald-700 bg-emerald-900/20 text-emerald-400 font-bold cursor-pointer"
                      >{"+ R\u00E9appro"}</button>
                    </div>
                  </div>
                );
              })}

              {/* Archived products */}
              {products.filter(p => p.archived).length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 font-semibold">
                    {"\uD83D\uDCE6 Produits archiv\u00E9s (" + products.filter(p => p.archived).length + ")"}
                  </summary>
                  <div className="flex flex-col gap-1 mt-2">
                    {products.filter(p => p.archived).map((p) => (
                      <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0f172a] border border-slate-800 opacity-60">
                        <span className="w-6 h-6 flex items-center justify-center">{renderProductIcon(p.emoji, "text-lg", "w-6 h-6")}</span>
                        <span className="text-sm flex-1">{p.name}</span>
                        <button onClick={() => setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, archived: false } : x))}
                          className="text-xs px-2 py-1 rounded border border-amber-700 text-amber-400 cursor-pointer">{"\u21A9 R\u00E9activer"}</button>
                        <button onClick={() => removeProduct(p.id)}
                          className="text-base opacity-40 hover:opacity-80 cursor-pointer">{"\uD83D\uDDD1"}</button>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Add product */}
              {!showAddProduct ? (
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="border-2 border-dashed border-[#1e2d4a] text-slate-500 py-4 rounded-xl text-sm font-semibold hover:border-slate-600 transition cursor-pointer"
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
                        {"Emoji / URL image"}
                      </label>
                      <button
                        onClick={() => setEmojiPickerFor(emojiPickerFor === "new" ? null : "new")}
                        className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-3xl cursor-pointer hover:border-amber-500 flex items-center justify-center"
                      >
                        {renderProductIcon(newProduct.emoji, "text-3xl", "w-8 h-8")}
                      </button>
                      {emojiPickerFor === "new" && (
                        <div className="absolute z-20 mt-1 bg-[#131b2e] border border-slate-700 rounded-xl p-2 shadow-2xl w-72">
                          <div className="flex gap-1 mb-2 flex-wrap">
                            {EMOJI_CATEGORIES.map((cat, i) => (
                              <button key={i} onClick={() => setEmojiPickerCategory(i)}
                                className={"text-base px-1.5 py-0.5 rounded cursor-pointer " + (emojiPickerCategory === i ? "bg-amber-500" : "bg-[#0f172a] hover:bg-[#1e2d4a]")}
                                title={cat.title}
                              >{cat.label}</button>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-500 mb-1">{EMOJI_CATEGORIES[emojiPickerCategory].title}</p>
                          <div className="grid grid-cols-8 gap-1 mb-2">
                            {EMOJI_CATEGORIES[emojiPickerCategory].emojis.map((e) => (
                              <button key={e} onClick={() => { setNewProduct({ ...newProduct, emoji: e }); setEmojiPickerFor(null); }}
                                className="text-xl p-1 rounded hover:bg-[#1e2d4a] cursor-pointer"
                              >{e}</button>
                            ))}
                          </div>
                          <div className="border-t border-slate-700 pt-2 mt-1">
                            <p className="text-[10px] text-slate-500 mb-1">{"\uD83D\uDD17 URL d'image"}</p>
                            <input type="url" placeholder="https://..."
                              className="w-full h-8 text-xs rounded-lg border border-slate-700 bg-[#0f172a] text-white px-2 outline-none"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const val = (e.target as HTMLInputElement).value.trim();
                                  if (val.startsWith("http")) { setNewProduct({ ...newProduct, emoji: val }); setEmojiPickerFor(null); }
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Nom"}</label>
                      <input placeholder="ex: Jus" value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm px-3 outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Prix vente"}</label>
                      <input type="number" step="0.1" value={newProduct.price}
                        onChange={(e) => setNewProduct({ ...newProduct, price: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Prix achat"}</label>
                      <input type="number" step="0.01" value={newProduct.cost}
                        onChange={(e) => setNewProduct({ ...newProduct, cost: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-emerald-400 text-sm text-center outline-none" />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Stock frigo"}</label>
                      <input type="number" value={newProduct.stock}
                        onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value, 10) || 0 })}
                        className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none" />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Stock r\u00E9serve"}</label>
                      <input type="number" value={newProduct.stockReserve}
                        onChange={(e) => setNewProduct({ ...newProduct, stockReserve: parseInt(e.target.value, 10) || 0 })}
                        className="h-12 rounded-lg border border-slate-700 bg-[#131b2e] text-purple-300 text-sm text-center outline-none" />
                    </div>
                  </div>
                  {/* Emplacement */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">{"Emplacement :"}</span>
                    {([["frigo", "\uD83E\uDDCA"], ["cafe", "\u2615"], ["congelateur", "\u2744\uFE0F"]] as const).map(([loc, emoji]) => (
                      <button key={loc}
                        onClick={() => setNewProduct({ ...newProduct, location: loc })}
                        className={"text-xs px-2 py-1 rounded font-bold cursor-pointer " + ((newProduct.location || "frigo") === loc ? "bg-cyan-600 text-white" : "bg-[#0f172a] text-slate-500 border border-slate-700")}
                      >{emoji + " " + (loc === "frigo" ? "Frigo" : loc === "cafe" ? "Caf\u00E9" : "Cong\u00E9lo")}</button>
                    ))}
                  </div>
                  <label className="flex items-center gap-3 bg-amber-900/20 border border-amber-700/40 rounded-lg px-3 py-2.5 cursor-pointer mb-2">
                    <input type="checkbox" checked={(newProduct.coffeeServings || 1) >= 2}
                      onChange={(e) => setNewProduct({ ...newProduct, coffeeServings: e.target.checked ? 2 : undefined })}
                      className="w-4 h-4 accent-amber-500" />
                    <span className="text-xs text-amber-400 font-semibold">{"\u2615 Double portion caf\u00E9"}</span>
                  </label>
                  <div className="flex gap-2">
                    <button onClick={addProduct}
                      className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer">
                      {"\u2713 Ajouter"}
                    </button>
                    <button onClick={() => setShowAddProduct(false)}
                      className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 text-sm font-bold cursor-pointer">
                      {"Annuler"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeAdminTab === "finance" && (
            <div className="flex flex-col gap-3">
              {/* ── CHIFFRE D'AFFAIRES ── */}
              <div className="rounded-xl border-2 bg-[#131b2e] border-amber-500/60 overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{"Chiffre d\u0027affaires total"}</span>
                  <span className="text-2xl font-extrabold text-amber-500">{formatPrice(caTotal)}</span>
                </div>
                <div className="grid grid-cols-2 gap-0 divide-x divide-white/5 border-t border-white/5">
                  <div className="p-3">
                    <span className="text-[9px] text-slate-600 block">{"Espèces"}</span>
                    <span className="text-lg font-bold text-amber-400">{formatPrice(caEspeces)}</span>
                    <span className="text-[9px] text-slate-600 block">{"Reprise " + formatPrice(settings.cashInitialFund || 0) + " + ventes " + formatPrice(txCashRevenue)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[9px] text-slate-600 block">{"CB"}</span>
                    <span className="text-lg font-bold text-blue-400">{formatPrice(caCB)}</span>
                    <span className="text-[9px] text-slate-600 block">{"Reprise " + formatPrice(settings.cbInitialFund || 0) + " + ventes " + formatPrice(txCBRevenue)}</span>
                  </div>
                </div>
              </div>

              {/* ── BÉNÉFICE ── */}
              <div className="rounded-xl border bg-[#131b2e] border-emerald-800 overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{"Bénéfice"}</span>
                  <span className={"text-2xl font-extrabold " + ((caTotal - totalCostsWithReprise) >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {formatPrice(caTotal - totalCostsWithReprise)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-0 divide-x divide-white/5 border-t border-white/5">
                  <div className="p-3">
                    <span className="text-[9px] text-slate-600 block">{"CA"}</span>
                    <span className="text-sm font-bold text-amber-400">{formatPrice(caTotal)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[9px] text-slate-600 block">{"Coûts"}</span>
                    <span className="text-sm font-bold text-red-400">{formatPrice(totalCostsWithReprise)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[9px] text-slate-600 block">{"Marge"}</span>
                    <span className={"text-sm font-bold " + (marginPct >= 0 ? "text-emerald-400" : "text-red-400")}>{marginPct + "%"}</span>
                  </div>
                </div>
              </div>

              {/* ── TRÉSORERIE ── */}
              <div className="rounded-xl border bg-[#131b2e] border-[#1e2d4a] overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{"Trésorerie disponible"}</span>
                  <span className="text-2xl font-extrabold text-amber-500">{formatPrice(treasuryTotal)}</span>
                </div>
                <div className="grid grid-cols-3 gap-0 divide-x divide-white/5 border-t border-white/5">
                  <div className="p-3">
                    <span className="text-[9px] text-slate-600 block">{"Espèces"}</span>
                    <span className="text-sm font-bold text-amber-400">{formatPrice(treasuryCash)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[9px] text-slate-600 block">{"CB"}</span>
                    <span className="text-sm font-bold text-blue-400">{formatPrice(treasuryCB)}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[9px] text-slate-600 block">{"Avoirs membres"}</span>
                    <span className="text-sm font-bold text-emerald-400">{formatPrice(members.reduce((s, m) => s + Math.max(0, m.balance), 0))}</span>
                  </div>
                </div>
              </div>

              {/* ── REPRISES (saisie initiale) ── */}
              <details className="rounded-xl border bg-[#0f172a] border-[#1e2d4a] overflow-hidden">
                <summary className="px-4 py-3 cursor-pointer text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-white">
                  {"\u270F\uFE0F Modifier les reprises (valeurs avant suivi)"}
                </summary>
                <div className="px-4 pb-4 flex flex-col gap-3">
                  <span className="text-[9px] text-slate-600">{"Entrez les montants d\u0027avant la remise à zéro. Modifier remplace la valeur."}</span>

                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-2">{"Reprise CA"}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-600 block mb-1">{"CA Espèces"}</label>
                        <input type="number" step="0.5"
                          defaultValue={settings.cashInitialFund || 0}
                          key={"rca-cash-" + (settings.cashInitialFund || 0)}
                          onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setSettings((prev) => ({ ...prev, cashInitialFund: v })); showToast("Reprise CA espèces : " + formatPrice(v)); } }}
                          onKeyDown={(e) => { if (e.key === "Enter") { const v = parseFloat((e.target as HTMLInputElement).value); if (!isNaN(v)) { setSettings((prev) => ({ ...prev, cashInitialFund: v })); showToast("Reprise CA espèces : " + formatPrice(v)); } } }}
                          className="w-full h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-amber-400 text-sm text-center font-bold outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-600 block mb-1">{"CA CB"}</label>
                        <input type="number" step="0.5"
                          defaultValue={settings.cbInitialFund || 0}
                          key={"rca-cb-" + (settings.cbInitialFund || 0)}
                          onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setSettings((prev) => ({ ...prev, cbInitialFund: v })); showToast("Reprise CA CB : " + formatPrice(v)); } }}
                          onKeyDown={(e) => { if (e.key === "Enter") { const v = parseFloat((e.target as HTMLInputElement).value); if (!isNaN(v)) { setSettings((prev) => ({ ...prev, cbInitialFund: v })); showToast("Reprise CA CB : " + formatPrice(v)); } } }}
                          className="w-full h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-blue-400 text-sm text-center font-bold outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-2">{"Reprise Coûts"}</span>
                    <input type="number" step="0.5"
                      defaultValue={settings.costReprise || 0}
                      key={"rcost-" + (settings.costReprise || 0)}
                      onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setSettings((prev) => ({ ...prev, costReprise: v })); showToast("Reprise coûts : " + formatPrice(v)); } }}
                      onKeyDown={(e) => { if (e.key === "Enter") { const v = parseFloat((e.target as HTMLInputElement).value); if (!isNaN(v)) { setSettings((prev) => ({ ...prev, costReprise: v })); showToast("Reprise coûts : " + formatPrice(v)); } } }}
                      className="w-full h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-red-400 text-sm text-center font-bold outline-none focus:border-red-500"
                    />
                    <span className="text-[9px] text-slate-600 block mt-1">{"Total coûts d\u0027achat avant suivi (déduit du CA pour le bénéfice)"}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block mb-2">{"Reprise Trésorerie"}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-600 block mb-1">{"Espèces en caisse"}</label>
                        <input type="number" step="0.5"
                          defaultValue={settings.cashInBox || 0}
                          key={"rtreso-cash-" + (settings.cashInBox || 0)}
                          onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setSettings((prev) => ({ ...prev, cashInBox: v })); showToast("Tréso espèces : " + formatPrice(v)); } }}
                          onKeyDown={(e) => { if (e.key === "Enter") { const v = parseFloat((e.target as HTMLInputElement).value); if (!isNaN(v)) { setSettings((prev) => ({ ...prev, cashInBox: v })); showToast("Tréso espèces : " + formatPrice(v)); } } }}
                          className="w-full h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-amber-400 text-sm text-center font-bold outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-600 block mb-1">{"CB disponible"}</label>
                        <input type="number" step="0.5"
                          defaultValue={settings.cbReceived || 0}
                          key={"rtreso-cb-" + (settings.cbReceived || 0)}
                          onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { setSettings((prev) => ({ ...prev, cbReceived: v })); showToast("Tréso CB : " + formatPrice(v)); } }}
                          onKeyDown={(e) => { if (e.key === "Enter") { const v = parseFloat((e.target as HTMLInputElement).value); if (!isNaN(v)) { setSettings((prev) => ({ ...prev, cbReceived: v })); showToast("Tréso CB : " + formatPrice(v)); } } }}
                          className="w-full h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-blue-400 text-sm text-center font-bold outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-600 block mt-1">{"Argent disponible au moment de la reprise. Les ventes ajoutent, les réappros déduisent."}</span>
                  </div>
                </div>
              </details>

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
                      {renderProductIcon(p.emoji, "text-xl", "w-6 h-6")}
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
                        products.reduce((s, p) => {
                          const total = effectiveStock(p) + Math.floor((p.stockReserve || 0) / (p.coffeeServings || 1));
                          const legacy = Math.min(p.legacyStock || 0, total);
                          const regular = total - legacy;
                          return s + legacy * (p.legacyPrice || p.cost || 0) + regular * (p.cost || 0);
                        }, 0),
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      {"Au prix de vente"}
                    </span>
                    <span className="text-sm font-bold text-amber-500">
                      {formatPrice(
                        products.reduce((s, p) => s + p.price * (effectiveStock(p) + Math.floor((p.stockReserve || 0) / (p.coffeeServings || 1))), 0),
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
              {/* Résumé CA rapide */}
              <div className="rounded-xl border bg-[#131b2e] border-[#1e2d4a] p-4 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{"Chiffre d\u0027affaires"}</span>
                  <span className="text-lg font-extrabold text-amber-500">{formatPrice(caTotal)}</span>
                </div>
                <div className="grid grid-cols-3 gap-0 divide-x divide-white/5">
                  <div>
                    <span className="text-[9px] text-slate-600 block">{"Espèces"}</span>
                    <span className="text-sm font-bold text-amber-400">{formatPrice(caEspeces)}</span>
                  </div>
                  <div className="pl-3">
                    <span className="text-[9px] text-slate-600 block">{"CB"}</span>
                    <span className="text-sm font-bold text-blue-400">{formatPrice(caCB)}</span>
                  </div>
                  <div className="pl-3">
                    <span className="text-[9px] text-slate-600 block">{"Avoirs"}</span>
                    <span className="text-sm font-bold text-emerald-400">{formatPrice(members.reduce((s, m) => s + Math.max(0, m.balance), 0))}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => { fetch("/api/fridge?action=trigger&lock=cafe").catch(() => {}); showToast("Caf\u00E9 ouvert !"); }}
                  className="py-3 rounded-xl font-bold text-sm bg-amber-700 text-white active:scale-95 cursor-pointer"
                >{"\u2615 Ouvrir caf\u00E9"}</button>
                <button
                  onClick={() => { fetch("/api/fridge?action=trigger&lock=frigo").catch(() => {}); showToast("Frigo ouvert !"); }}
                  className="py-3 rounded-xl font-bold text-sm bg-blue-600 text-white active:scale-95 cursor-pointer"
                >{"\uD83E\uDDCA Ouvrir frigo"}</button>
                <button
                  onClick={() => { fetch("/api/fridge?action=trigger&lock=congelateur").catch(() => {}); showToast("Cong\u00E9lateur ouvert !"); }}
                  className="py-3 rounded-xl font-bold text-sm bg-cyan-600 text-white active:scale-95 cursor-pointer"
                >{"\u2744\uFE0F Ouvrir cong\u00E9lateur"}</button>
                <button
                  onClick={() => { fetch("/api/fridge?action=trigger&lock=both").catch(() => {}); showToast("Tout ouvert !"); }}
                  className="py-3 rounded-xl font-bold text-sm bg-emerald-600 text-white active:scale-95 cursor-pointer"
                >{"\uD83D\uDD13 Ouvrir tout"}</button>
              </div>

              {/* Créer un membre */}
              <div className="bg-[#0f172a] border border-emerald-800 rounded-xl p-4">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-3">{"+ Ajouter un membre"}</span>
                <div className="flex gap-2">
                  <input
                    id="new-member-name"
                    type="text"
                    placeholder="Nom du membre"
                    className="flex-1 h-10 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm px-3 outline-none"
                  />
                  <input
                    id="new-member-balance"
                    type="number"
                    step="0.5"
                    placeholder="Avoir (€)"
                    className="w-24 h-10 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none"
                  />
                  <button
                    onClick={() => {
                      const nameEl = document.getElementById("new-member-name") as HTMLInputElement;
                      const balEl = document.getElementById("new-member-balance") as HTMLInputElement;
                      const name = nameEl?.value?.trim();
                      const bal = parseFloat(balEl?.value) || 0;
                      if (!name) { showToast("Nom requis", "error"); return; }
                      const existing = members.find((m) => normalizeNameFuzzy(m.name) === normalizeNameFuzzy(name));
                      if (existing) {
                        setMembers((prev) => prev.map((m) => normalizeNameFuzzy(m.name) === normalizeNameFuzzy(name) ? { ...m, balance: m.balance + bal } : m));
                        showToast(name + " : avoir ajusté de " + formatPrice(bal));
                      } else {
                        setMembers((prev) => [...prev, { name, balance: bal }]);
                        showToast(name + " ajouté" + (bal ? " avec " + formatPrice(bal) + " d'avoir" : ""));
                      }
                      nameEl.value = "";
                      balEl.value = "";
                    }}
                    className="px-4 h-10 rounded-lg bg-emerald-600 text-white text-sm font-bold cursor-pointer active:scale-95"
                  >{"+"}</button>
                </div>
              </div>

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
                      const cof = coffeeCredits[name] || 0;
                      return (
                        <button
                          key={name}
                          onClick={() => openMemberModal(name)}
                          className="flex items-center gap-2.5 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3.5 py-3 w-full text-left cursor-pointer active:bg-[#1e2d4a] transition hover:border-[#2a3f6a]"
                        >
                          <span className="w-8 h-8 rounded-full bg-[#0a1628] flex items-center justify-center text-sm font-bold text-slate-400 shrink-0">
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-sm font-semibold flex-1 truncate">
                            {name}
                          </span>
                          {bal !== 0 && (
                            <span className={"text-sm font-bold " + (bal > 0 ? "text-emerald-400" : "text-red-400")}>
                              {formatPrice(bal)}
                            </span>
                          )}
                          {cof > 0 && (
                            <span className="flex items-center gap-1 text-xs bg-amber-900/30 border border-amber-700/40 text-amber-400 font-semibold px-2 py-0.5 rounded-lg">
                              {"☕ " + cof}
                            </span>
                          )}
                          {bal === 0 && cof === 0 && (
                            <span className="text-xs text-slate-600">{"Pas d'avoir"}</span>
                          )}
                          <span className="text-slate-600 text-sm shrink-0">{"›"}</span>
                        </button>
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
                    setSettings((prev) => ({ ...prev, clubName: e.target.value }))
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
                    setSettings((prev) => ({ ...prev, adminPin: e.target.value }))
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
                    setSettings((prev) => ({ ...prev, bureauPin: e.target.value }))
                  }
                  className="h-10 rounded-xl border border-slate-700 bg-[#131b2e] text-white text-sm px-3.5 outline-none"
                  maxLength={6}
                />
              </div>
              <div className="h-px bg-[#1e2d4a] my-3" />
              {/* Support WhatsApp */}
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold">{"📞 Support WhatsApp"}</h3>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{"Numéro (format international, ex: 33756919167)"}</label>
                  <input
                    value={settings.supportPhone || ""}
                    onChange={(e) => setSettings((prev) => ({ ...prev, supportPhone: e.target.value.replace(/\D/g, "") }))}
                    placeholder="33756919167"
                    className="h-10 rounded-xl border border-slate-700 bg-[#131b2e] text-white text-sm px-3.5 outline-none"
                  />
                </div>
                {settings.supportPhone && (() => {
                  const msg = "Bonjour j'ai un problème avec le bar de l'aéroclub.";
                  const waUrl = `https://wa.me/${settings.supportPhone}?text=${encodeURIComponent(msg)}`;
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&color=000000&data=${encodeURIComponent(waUrl)}`;
                  return (
                    <div className="flex flex-col items-center gap-3 bg-white rounded-2xl p-4">
                      <img src={qrUrl} alt="QR Code WhatsApp Support" className="w-48 h-48 rounded-xl" />
                      <p className="text-[11px] text-slate-600 text-center font-semibold">{"Scanner pour contacter le support"}</p>
                      <p className="text-[10px] text-slate-400 text-center break-all">{waUrl}</p>
                      <a
                        href={qrUrl}
                        download="support-qr.png"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 rounded-xl bg-green-600 text-white text-xs font-bold text-center cursor-pointer"
                      >{"⬇️ Télécharger le QR code"}</a>
                    </div>
                  );
                })()}
              </div>
              <div className="h-px bg-[#1e2d4a] my-3" />
              <h3 className="text-base font-bold">{"🏷️ Catégories"}</h3>
              <div className="flex flex-col gap-2">
                {getCategories().map((cat) => (
                  editingCategory?.id === cat.id ? (
                    <div key={cat.id} className="bg-[#0f172a] border border-blue-700 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <input
                          value={editingCategory.emoji}
                          onChange={(e) => setEditingCategory((prev) => prev && ({ ...prev, emoji: e.target.value }))}
                          className="w-14 h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none"
                          placeholder="emoji"
                        />
                        <input
                          value={editingCategory.label}
                          onChange={(e) => setEditingCategory((prev) => prev && ({ ...prev, label: e.target.value }))}
                          className="flex-1 h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm px-3 outline-none"
                          placeholder="Nom"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingCategory.hasCupCost || false}
                          onChange={(e) => setEditingCategory((prev) => prev && ({ ...prev, hasCupCost: e.target.checked }))}
                          className="w-4 h-4 accent-amber-500"
                        />
                        {"Utilise le coût gobelet (☕)"}
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (!editingCategory.label.trim()) return;
                            setSettings((prev) => ({ ...prev, categories: (prev.categories || DEFAULT_CATEGORIES).map((c) => c.id === editingCategory.id ? editingCategory : c) }));
                            setEditingCategory(null);
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold cursor-pointer"
                        >{"✓ Enregistrer"}</button>
                        <button onClick={() => setEditingCategory(null)} className="flex-1 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs font-bold cursor-pointer">{"Annuler"}</button>
                      </div>
                    </div>
                  ) : (
                    <div key={cat.id} className="flex items-center gap-2 bg-[#0f172a] border border-[#1e2d4a] rounded-xl px-3 py-2.5">
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button onClick={() => setSettings((prev) => { const cats = [...(prev.categories || DEFAULT_CATEGORIES)]; const i = cats.findIndex(c => c.id === cat.id); if (i > 0) { [cats[i-1],cats[i]]=[cats[i],cats[i-1]]; } return {...prev, categories: cats}; })} className="w-5 h-4 rounded text-[9px] text-slate-500 hover:text-white bg-[#131b2e] flex items-center justify-center cursor-pointer">{"▲"}</button>
                        <button onClick={() => setSettings((prev) => { const cats = [...(prev.categories || DEFAULT_CATEGORIES)]; const i = cats.findIndex(c => c.id === cat.id); if (i < cats.length-1) { [cats[i],cats[i+1]]=[cats[i+1],cats[i]]; } return {...prev, categories: cats}; })} className="w-5 h-4 rounded text-[9px] text-slate-500 hover:text-white bg-[#131b2e] flex items-center justify-center cursor-pointer">{"▼"}</button>
                      </div>
                      <span className="text-xl w-7 text-center">{cat.emoji}</span>
                      <span className="flex-1 text-sm font-semibold text-white">{cat.label}</span>
                      {cat.hasCupCost && <span className="text-[10px] text-amber-500 font-semibold">{"+ gobelet"}</span>}
                      <button onClick={() => setEditingCategory({ ...cat })} className="text-slate-500 hover:text-white text-sm cursor-pointer px-1">{"✏️"}</button>
                      <button
                        onClick={() => {
                          if (products.some((p) => p.category === cat.id)) {
                            showToast("Retirez d'abord cette catégorie des produits", "error");
                            return;
                          }
                          setSettings((prev) => ({ ...prev, categories: (prev.categories || DEFAULT_CATEGORIES).filter((c) => c.id !== cat.id) }));
                        }}
                        className="text-slate-600 hover:text-red-400 text-sm cursor-pointer px-1"
                      >{"🗑"}</button>
                    </div>
                  )
                ))}
                {newCategoryForm ? (
                  <div className="bg-[#0f172a] border border-emerald-700 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        value={newCategoryForm.emoji}
                        onChange={(e) => setNewCategoryForm((prev) => prev && ({ ...prev, emoji: e.target.value }))}
                        className="w-14 h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none"
                        placeholder="emoji"
                      />
                      <input
                        value={newCategoryForm.label}
                        onChange={(e) => setNewCategoryForm((prev) => prev && ({ ...prev, label: e.target.value }))}
                        className="flex-1 h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm px-3 outline-none"
                        placeholder="Nom de la catégorie"
                        autoFocus
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCategoryForm.hasCupCost}
                        onChange={(e) => setNewCategoryForm((prev) => prev && ({ ...prev, hasCupCost: e.target.checked }))}
                        className="w-4 h-4 accent-amber-500"
                      />
                      {"Utilise le coût gobelet (☕)"}
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (!newCategoryForm.label.trim()) return;
                          const newCat: Category = {
                            id: Date.now().toString(36),
                            label: newCategoryForm.label.trim(),
                            emoji: newCategoryForm.emoji || "📁",
                            hasCupCost: newCategoryForm.hasCupCost,
                          };
                          setSettings((prev) => ({ ...prev, categories: [...(prev.categories || DEFAULT_CATEGORIES), newCat] }));
                          setNewCategoryForm(null);
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                      >{"+ Créer"}</button>
                      <button onClick={() => setNewCategoryForm(null)} className="flex-1 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs font-bold cursor-pointer">{"Annuler"}</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setNewCategoryForm({ label: "", emoji: "📁", hasCupCost: false })}
                    className="py-2 border-2 border-dashed border-[#1e2d4a] text-slate-500 rounded-xl text-sm font-semibold hover:border-slate-600 cursor-pointer"
                  >{"+ Nouvelle catégorie"}</button>
                )}
              </div>
              <div className="h-px bg-[#1e2d4a] my-3" />
              <h3 className="text-base font-bold">{"☕ Café & Comptabilité"}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {"Coût gobelet (€)"}
                  </label>
                  <input
                    type="number" step="0.01" min="0" placeholder="ex: 0.03"
                    value={settings.cupCost ?? ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setSettings((prev) => ({ ...prev, cupCost: isNaN(v) ? undefined : v }));
                    }}
                    className="h-10 rounded-xl border border-slate-700 bg-[#131b2e] text-white text-sm px-3.5 outline-none"
                  />
                  <span className="text-[10px] text-slate-600">{"Ajouté au coût de chaque ☕ vendu"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {"Frais SumUp (%)"}
                  </label>
                  <input
                    type="number" step="0.1" min="0" max="10" placeholder="2.5"
                    value={settings.sumupFeeRate ?? ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setSettings((prev) => ({ ...prev, sumupFeeRate: isNaN(v) ? undefined : v }));
                    }}
                    className="h-10 rounded-xl border border-slate-700 bg-[#131b2e] text-white text-sm px-3.5 outline-none"
                  />
                  <span className="text-[10px] text-slate-600">{"Défaut : 2,5% — déduit du bénéfice CB"}</span>
                </div>
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
              <h3 className="text-base font-bold">{"\uD83D\uDCB0 Correction financi\u00E8re"}</h3>
              <p className="text-xs text-slate-500 mb-2">{"Cr\u00E9er une transaction de correction pour ajuster le CA (ex: apr\u00E8s une perte de donn\u00E9es)"}</p>
              <div className="bg-[#0f172a] border border-amber-800/50 rounded-xl p-4 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Montant CA (\u20AC)"}</label>
                    <input id="correction-total" type="number" step="0.01" placeholder="ex: 150.00" className="h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Co\u00FBt total (\u20AC)"}</label>
                    <input id="correction-cost" type="number" step="0.01" placeholder="ex: 80.00" className="h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-semibold uppercase">{"M\u00E9thode"}</label>
                    <select id="correction-method" className="h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm text-center outline-none">
                      <option value="especes">{"Esp\u00E8ces"}</option>
                      <option value="carte">{"Carte"}</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Note"}</label>
                    <input id="correction-note" type="text" placeholder="Correction manuelle" className="h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-sm px-3 outline-none" />
                  </div>
                </div>
                <button
                  onClick={() => {
                    const total = parseFloat((document.getElementById("correction-total") as HTMLInputElement)?.value);
                    const cost = parseFloat((document.getElementById("correction-cost") as HTMLInputElement)?.value) || 0;
                    const method = (document.getElementById("correction-method") as HTMLSelectElement)?.value || "especes";
                    const note = (document.getElementById("correction-note") as HTMLInputElement)?.value || "Correction manuelle";
                    if (isNaN(total) || total === 0) { showToast("Montant requis", "error"); return; }
                    if (!confirm("Cr\u00E9er une transaction de correction de " + formatPrice(total) + " ?")) return;
                    const tx: Transaction = {
                      id: "correction-" + Date.now().toString(36),
                      items: "\uD83D\uDCDD " + note,
                      total: Math.round(total * 100) / 100,
                      totalCost: Math.round(cost * 100) / 100,
                      buyer: "CORRECTION",
                      date: new Date().toISOString(),
                      method,
                    };
                    setTransactions((prev) => [tx, ...prev]);
                    (document.getElementById("correction-total") as HTMLInputElement).value = "";
                    (document.getElementById("correction-cost") as HTMLInputElement).value = "";
                    (document.getElementById("correction-note") as HTMLInputElement).value = "";
                    showToast("Correction de " + formatPrice(total) + " ajout\u00E9e");
                  }}
                  className="py-2.5 rounded-xl bg-amber-600 text-black text-sm font-bold cursor-pointer active:scale-95"
                >{"Cr\u00E9er la correction"}</button>
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
              <h3 className="text-base font-bold">{"\uD83D\uDCBE Sauvegarde compl\u00E8te"}</h3>
              <p className="text-xs text-slate-500 mb-2">{"Un backup automatique est sauv\u00E9 dans la base toutes les 5 min. Tu peux aussi sauvegarder/restaurer manuellement."}</p>

              {/* Backup Redis (dans la base de donn\u00E9es) */}
              <div className="bg-[#0f172a] border border-emerald-800/50 rounded-xl p-4 flex flex-col gap-3">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{"Backup serveur (Redis)"}</span>
                <p className="text-[11px] text-slate-500">{"Sauvegard\u00E9 automatiquement toutes les 5 min. Si on perd les donn\u00E9es, on peut restaurer depuis ce backup."}</p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save" }) });
                        const d = await res.json();
                        if (d.ok) showToast("Backup serveur cr\u00E9\u00E9 !");
                        else showToast("Erreur: " + (d.error || "?"), "error");
                      } catch { showToast("Erreur r\u00E9seau", "error"); }
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold cursor-pointer active:scale-95"
                  >{"\uD83D\uDCBE Sauvegarder maintenant"}</button>
                  <button
                    onClick={async () => {
                      if (!confirm("Restaurer le dernier backup serveur ?\n\nCela remplacera TOUTES les donn\u00E9es actuelles par le backup.")) return;
                      try {
                        const res = await fetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore" }) });
                        const d = await res.json();
                        if (d.ok) {
                          showToast("Backup restaur\u00E9 ! Rechargement...");
                          setTimeout(() => window.location.reload(), 1500);
                        } else showToast("Erreur: " + (d.error || "Aucun backup trouv\u00E9"), "error");
                      } catch { showToast("Erreur r\u00E9seau", "error"); }
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 text-black text-sm font-bold cursor-pointer active:scale-95"
                  >{"\uD83D\uDD04 Restaurer backup"}</button>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/backup");
                      if (!res.ok) { showToast("Aucun backup trouv\u00E9", "error"); return; }
                      const backup = await res.json();
                      showToast("Backup du " + (backup._backupDate ? new Date(backup._backupDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "?"));
                    } catch { showToast("Erreur r\u00E9seau", "error"); }
                  }}
                  className="py-1.5 text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer"
                >{"\u2139\uFE0F Voir la date du dernier backup"}</button>
              </div>

              {/* Backup fichier JSON (t\u00E9l\u00E9chargeable) */}
              <div className="bg-[#0f172a] border border-[#1e2d4a] rounded-xl p-4 flex flex-col gap-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{"Backup fichier (JSON)"}</span>
                <p className="text-[11px] text-slate-500">{"T\u00E9l\u00E9charger un fichier avec toutes les donn\u00E9es. Tu peux le r\u00E9injecter plus tard."}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const backup = {
                        exportDate: new Date().toISOString(),
                        version: 1,
                        products,
                        transactions,
                        settings,
                        suggestions,
                        members,
                        procurements,
                        coffeeCredits,
                        batches,
                      };
                      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "aeroclub-backup-" + todayStr + ".json";
                      a.click();
                      URL.revokeObjectURL(url);
                      showToast("Fichier backup t\u00E9l\u00E9charg\u00E9 !");
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#1e2d4a] text-emerald-400 text-sm font-bold cursor-pointer hover:bg-[#253550]"
                  >{"\u2B07\uFE0F T\u00E9l\u00E9charger"}</button>
                  <button
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".json";
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        try {
                          const text = await file.text();
                          const backup = JSON.parse(text);
                          if (!backup.products || !backup.version) {
                            showToast("Fichier invalide", "error");
                            return;
                          }
                          if (!confirm("Restaurer le backup du " + (backup.exportDate ? new Date(backup.exportDate).toLocaleDateString("fr-FR") : "?") + " ?\n\nCela remplacera TOUTES les donn\u00E9es actuelles dans la base.")) return;
                          // Envoyer \u00E0 l'API pour \u00E9crire directement dans Redis
                          const res = await fetch("/api/backup", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "restore-upload", data: backup }),
                          });
                          const d = await res.json();
                          if (d.ok) {
                            showToast("Backup inject\u00E9 ! Rechargement...");
                            setTimeout(() => window.location.reload(), 1500);
                          } else showToast("Erreur: " + (d.error || "?"), "error");
                        } catch { showToast("Erreur de lecture du fichier", "error"); }
                      };
                      input.click();
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#1e2d4a] text-amber-400 text-sm font-bold cursor-pointer hover:bg-[#253550]"
                  >{"\u2B06\uFE0F Injecter fichier"}</button>
                </div>
              </div>

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
      {editingTxFull && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setEditingTxFull(null)}
        >
          <div
            className="w-full max-w-md bg-[#131b2e] rounded-2xl p-5 flex flex-col gap-3 border border-slate-700 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-white text-base">{"Modifier la vente"}</h3>
            <p className="text-[11px] text-slate-500">{"Le stock sera ajusté automatiquement (ancien restauré, nouveau déduit)."}</p>
            <div className="flex flex-col gap-2">
              {editingTxFull.lines.map((line, idx) => {
                const prod = products.find((p) => p.id === line.productId);
                return (
                  <div key={idx} className="flex items-center gap-2 bg-[#0f172a] border border-[#1e2d4a] rounded-xl p-2">
                    <select
                      value={line.productId}
                      onChange={(e) =>
                        setEditingTxFull((prev) =>
                          prev
                            ? {
                                ...prev,
                                lines: prev.lines.map((l, i) => (i === idx ? { ...l, productId: e.target.value } : l)),
                              }
                            : prev,
                        )
                      }
                      className="flex-1 h-9 rounded-lg border border-slate-700 bg-[#131b2e] text-white text-xs px-2 outline-none cursor-pointer"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.emoji.startsWith("http") ? "🖼" : p.emoji} {p.name} ({formatPrice(p.price)})
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setEditingTxFull((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  lines: prev.lines.map((l, i) => (i === idx ? { ...l, qty: Math.max(0, l.qty - 1) } : l)),
                                }
                              : prev,
                          )
                        }
                        className="w-7 h-7 rounded-lg bg-[#131b2e] border border-slate-700 text-red-500 font-bold cursor-pointer text-sm"
                      >
                        {"−"}
                      </button>
                      <span className="text-sm font-bold text-white w-6 text-center">{line.qty}</span>
                      <button
                        onClick={() =>
                          setEditingTxFull((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  lines: prev.lines.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l)),
                                }
                              : prev,
                          )
                        }
                        className="w-7 h-7 rounded-lg bg-[#131b2e] border border-slate-700 text-emerald-500 font-bold cursor-pointer text-sm"
                      >
                        {"+"}
                      </button>
                    </div>
                    <span className="text-xs font-bold text-amber-500 min-w-[50px] text-right">
                      {prod ? formatPrice(getFifoTotal(prod, line.qty)) : "—"}
                    </span>
                    <button
                      onClick={() =>
                        setEditingTxFull((prev) =>
                          prev ? { ...prev, lines: prev.lines.filter((_, i) => i !== idx) } : prev,
                        )
                      }
                      className="text-red-500 text-base cursor-pointer px-1"
                    >
                      {"🗑"}
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() =>
                  setEditingTxFull((prev) =>
                    prev && products[0]
                      ? { ...prev, lines: [...prev.lines, { productId: products[0].id, qty: 1 }] }
                      : prev,
                  )
                }
                className="text-xs py-2 rounded-lg border border-dashed border-slate-700 text-slate-400 font-semibold cursor-pointer"
              >
                {"+ Ajouter une ligne"}
              </button>
            </div>
            <div className="bg-[#0f172a] rounded-xl p-3 flex justify-between items-center border border-amber-700">
              <span className="text-sm text-slate-400 font-bold">{"Nouveau total"}</span>
              <span className="text-base font-extrabold text-amber-500">
                {formatPrice(
                  editingTxFull.lines.reduce((s, l) => {
                    const p = products.find((pr) => pr.id === l.productId);
                    return s + (p ? getFifoTotal(p, l.qty) : 0);
                  }, 0),
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingTxFull(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm font-bold cursor-pointer"
              >
                {"Annuler"}
              </button>
              <button
                onClick={saveTxEdit}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer"
              >
                {"✓ Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Product Modal ── */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setEditingProduct(null)}>
          <div className="w-full max-w-lg bg-[#131b2e] rounded-t-3xl border-t border-x border-slate-700 max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-bold text-amber-500">{"\u270F\uFE0F Modifier le produit"}</span>
              <button onClick={() => setEditingProduct(null)} className="w-10 h-10 rounded-full bg-[#1e2d4a] text-slate-400 flex items-center justify-center text-lg cursor-pointer">{"\u2715"}</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Emoji / URL image"}</label>
                <button onClick={() => setEmojiPickerFor(emojiPickerFor === "edit" ? null : "edit")}
                  className="h-14 rounded-xl border border-slate-700 bg-[#0f172a] text-3xl cursor-pointer hover:border-amber-500 flex items-center justify-center">
                  {renderProductIcon(editingProduct.emoji, "text-3xl", "w-10 h-10")}
                </button>
                {emojiPickerFor === "edit" && (
                  <div className="absolute z-20 mt-1 bg-[#131b2e] border border-slate-700 rounded-xl p-2 shadow-2xl w-72">
                    <div className="flex gap-1 mb-2 flex-wrap">
                      {EMOJI_CATEGORIES.map((cat, i) => (
                        <button key={i} onClick={() => setEmojiPickerCategory(i)}
                          className={"text-base px-1.5 py-0.5 rounded cursor-pointer " + (emojiPickerCategory === i ? "bg-amber-500" : "bg-[#0f172a] hover:bg-[#1e2d4a]")}
                          title={cat.title}>{cat.label}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-8 gap-1 mb-2">
                      {EMOJI_CATEGORIES[emojiPickerCategory].emojis.map((e) => (
                        <button key={e} onClick={() => { setEditingProduct({ ...editingProduct, emoji: e }); setEmojiPickerFor(null); }}
                          className="text-xl p-1 rounded hover:bg-[#1e2d4a] cursor-pointer">{e}</button>
                      ))}
                    </div>
                    <div className="border-t border-slate-700 pt-2 mt-1">
                      <input type="url" placeholder="https://..."
                        className="w-full h-8 text-xs rounded-lg border border-slate-700 bg-[#0f172a] text-white px-2 outline-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val.startsWith("http")) { setEditingProduct({ ...editingProduct, emoji: val }); setEmojiPickerFor(null); }
                          }
                        }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Nom"}</label>
                <input value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="h-14 rounded-xl border border-slate-700 bg-[#0f172a] text-white text-sm px-3 outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Prix vente"}</label>
                <input type="number" step="0.1" value={editingProduct.price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="h-14 rounded-xl border border-slate-700 bg-[#0f172a] text-white text-sm text-center outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Prix achat"}</label>
                <input type="number" step="0.01" value={editingProduct.cost || 0}
                  onChange={(e) => setEditingProduct({ ...editingProduct, cost: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="h-14 rounded-xl border border-slate-700 bg-[#0f172a] text-emerald-400 text-sm text-center outline-none" />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Stock frigo"}</label>
                <input type="number" value={editingProduct.stock}
                  onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value, 10) || 0 })}
                  className="h-14 rounded-xl border border-slate-700 bg-[#0f172a] text-white text-sm text-center outline-none" />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[10px] text-slate-500 font-semibold uppercase">{"Stock r\u00E9serve"}</label>
                <input type="number" value={editingProduct.stockReserve ?? 0}
                  onChange={(e) => setEditingProduct({ ...editingProduct, stockReserve: parseInt(e.target.value, 10) || 0 })}
                  className="h-14 rounded-xl border border-slate-700 bg-[#0f172a] text-purple-300 text-sm text-center outline-none" />
              </div>
            </div>
            {/* Emplacement (serrure) */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-slate-400 font-semibold">{"Emplacement :"}</span>
              {([["frigo", "\uD83E\uDDCA Frigo"], ["cafe", "\u2615 Caf\u00E9"], ["congelateur", "\u2744\uFE0F Cong\u00E9lateur"]] as const).map(([loc, label]) => (
                <button key={loc}
                  onClick={() => setEditingProduct({ ...editingProduct, location: loc })}
                  className={"text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer transition " + ((editingProduct.location || "frigo") === loc ? "bg-cyan-600 text-white" : "bg-[#0f172a] text-slate-500 border border-slate-700")}
                >{label}</button>
              ))}
            </div>
            <label className="flex items-center gap-3 bg-amber-900/20 border border-amber-700/40 rounded-xl px-3 py-3 cursor-pointer mb-3">
              <input type="checkbox" checked={(editingProduct.coffeeServings || 1) >= 2}
                onChange={(e) => setEditingProduct({ ...editingProduct, coffeeServings: e.target.checked ? 2 : undefined })}
                className="w-5 h-5 accent-amber-500" />
              <span className="text-xs text-amber-400 font-semibold">{"\u2615 Double portion caf\u00E9 (2 tasses)"}</span>
            </label>
            <div className="flex gap-2">
              <button onClick={saveEditProduct}
                className="flex-1 py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer active:scale-95">
                {"\u2713 Enregistrer"}
              </button>
              <button onClick={() => setEditingProduct(null)}
                className="flex-1 py-3.5 rounded-xl border border-slate-700 text-slate-400 text-sm font-bold cursor-pointer">
                {"Annuler"}
              </button>
            </div>
          </div>
        </div>
      )}

            {/* ── Product Detail Bottom Sheet ── */}
      {detailProduct && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={() => setDetailProduct(null)}
        >
          <div
            className="w-full max-w-lg bg-[#131b2e] rounded-t-3xl border-t border-x border-slate-700 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#131b2e] border-b border-[#1e2d4a] px-5 py-4 flex items-center gap-3 z-10">
              <span className="w-12 h-12 flex items-center justify-center">
                {renderProductIcon(detailProduct.emoji, "text-3xl", "w-12 h-12")}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-lg font-bold block truncate">{detailProduct.name}</span>
                <span className="text-sm text-amber-500 font-semibold">
                  {formatPrice(detailProduct.price)}
                  <span className="text-slate-600">{" \u00B7 co\u00FBt " + formatPrice(detailProduct.cost || 0)}</span>
                </span>
              </div>
              <button onClick={() => setDetailProduct(null)}
                className="w-10 h-10 rounded-full bg-[#1e2d4a] text-slate-400 flex items-center justify-center text-lg cursor-pointer hover:text-white">
                {"\u2715"}
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-5">
              {/* ── Stock Overview ── */}
              <div className="bg-[#0f172a] rounded-2xl border border-[#1e2d4a] overflow-hidden">
                {/* Frigo + Reserve side by side */}
                <div className="grid grid-cols-2 divide-x divide-[#1e2d4a]">
                  <div className="flex flex-col items-center py-4 gap-1">
                    <span className="text-xs text-slate-500 font-semibold">{"\uD83E\uDDCA Frigo"}</span>
                    <input type="number" value={detailProduct.stock}
                      onChange={(e) => { const n = parseInt(e.target.value,10); if (!isNaN(n) && n >= 0) { setStockDirect(detailProduct.id, e.target.value); setDetailProduct(prev => prev ? {...prev, stock: n} : null); }}}
                      className={"w-20 h-14 rounded-xl border bg-[#131b2e] text-center text-2xl font-extrabold outline-none " + (detailProduct.stock <= 5 ? "border-orange-600 text-orange-400" : "border-slate-700 text-white")}
                    />
                    <div className="flex gap-1.5 mt-1">
                      <button onClick={() => { adjustStock(detailProduct.id, -1); setDetailProduct(prev => prev ? {...prev, stock: Math.max(0, prev.stock-1)} : null); }}
                        className="w-11 h-11 rounded-xl border border-slate-700 bg-[#131b2e] text-red-500 text-lg font-bold flex items-center justify-center cursor-pointer active:scale-90">{"\u2212"}</button>
                      <button onClick={() => { adjustStock(detailProduct.id, 1); setDetailProduct(prev => prev ? {...prev, stock: prev.stock+1} : null); }}
                        className="w-11 h-11 rounded-xl border border-slate-700 bg-[#131b2e] text-emerald-500 text-lg font-bold flex items-center justify-center cursor-pointer active:scale-90">{"+"}</button>
                    </div>
                  </div>
                  <div className="flex flex-col items-center py-4 gap-1">
                    <span className="text-xs text-purple-400 font-semibold">{"\uD83D\uDCE6 R\u00E9serve"}</span>
                    <input type="number" value={detailProduct.stockReserve ?? 0}
                      onChange={(e) => { const n = parseInt(e.target.value,10); if (!isNaN(n) && n >= 0) { setProducts(prev => prev.map(x => x.id === detailProduct.id ? {...x, stockReserve: n} : x)); setDetailProduct(prev => prev ? {...prev, stockReserve: n} : null); }}}
                      className="w-20 h-14 rounded-xl border border-purple-900 bg-[#131b2e] text-purple-300 text-center text-2xl font-extrabold outline-none"
                    />
                    <div className="flex gap-1.5 mt-1">
                      <button onClick={() => { setProducts(prev => prev.map(x => x.id === detailProduct.id ? {...x, stockReserve: Math.max(0,(x.stockReserve??0)-1)} : x)); setDetailProduct(prev => prev ? {...prev, stockReserve: Math.max(0,(prev.stockReserve??0)-1)} : null); }}
                        className="w-11 h-11 rounded-xl border border-slate-700 bg-[#131b2e] text-red-500 text-lg font-bold flex items-center justify-center cursor-pointer active:scale-90">{"\u2212"}</button>
                      <button onClick={() => { setProducts(prev => prev.map(x => x.id === detailProduct.id ? {...x, stockReserve: (x.stockReserve??0)+1} : x)); setDetailProduct(prev => prev ? {...prev, stockReserve: (prev.stockReserve??0)+1} : null); }}
                        className="w-11 h-11 rounded-xl border border-slate-700 bg-[#131b2e] text-emerald-500 text-lg font-bold flex items-center justify-center cursor-pointer active:scale-90">{"+"}</button>
                    </div>
                  </div>
                </div>

                {/* Transfer section */}
                {((detailProduct.stockReserve ?? 0) > 0 || detailProduct.stock > 0) && (
                  <div className="border-t border-[#1e2d4a] px-3 py-3 flex flex-col gap-2">
                    {(detailProduct.stockReserve ?? 0) > 0 && (
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">{"\uD83D\uDCE6 \u2192 \uD83E\uDDCA R\u00E9serve vers frigo"}</span>
                        <div className="flex gap-1.5">
                          {[1, 2, 3].map((n) => (
                            <button key={n} disabled={n > (detailProduct.stockReserve ?? 0)}
                              onClick={() => {
                                const t = Math.min(n, detailProduct.stockReserve ?? 0);
                                setProducts(prev => prev.map(x => x.id === detailProduct.id ? {...x, stock: x.stock+t, stockReserve: Math.max(0,(x.stockReserve??0)-t)} : x));
                                setBatches(prev => { const res: Batch[] = []; let rem = t; for (const b of prev) { if (b.productId !== detailProduct.id || b.location !== "reserve" || b.qty <= 0 || rem <= 0) { res.push(b); continue; } const take = Math.min(b.qty, rem); rem -= take; if (take === b.qty) { res.push({...b, location:"frigo"}); } else { res.push({...b, qty: b.qty-take}); res.push({...b, id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), qty: take, location:"frigo"}); } } return res; });
                                setDetailProduct(prev => prev ? {...prev, stock: prev.stock+t, stockReserve: Math.max(0,(prev.stockReserve??0)-t)} : null);
                              }}
                              className="flex-1 py-2.5 rounded-xl border border-purple-700 bg-purple-900/20 text-purple-300 text-sm font-bold cursor-pointer active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed"
                            >{String(n)}</button>
                          ))}
                          <button onClick={() => {
                              const t = detailProduct.stockReserve ?? 0;
                              setProducts(prev => prev.map(x => x.id === detailProduct.id ? {...x, stock: x.stock+t, stockReserve: 0} : x));
                              setBatches(prev => prev.map(b => b.productId === detailProduct.id && b.location === "reserve" ? {...b, location:"frigo" as const} : b));
                              setDetailProduct(prev => prev ? {...prev, stock: prev.stock+t, stockReserve: 0} : null);
                            }}
                            className="flex-1 py-2.5 rounded-xl border border-purple-700 bg-purple-900/20 text-purple-300 text-sm font-bold cursor-pointer active:scale-95"
                          >{"Tout"}</button>
                          <button onClick={() => {
                              const val = prompt("Quantit\u00E9 \u00E0 transf\u00E9rer ?");
                              if (!val) return;
                              const n = parseInt(val, 10);
                              if (isNaN(n) || n <= 0) return;
                              const t = Math.min(n, detailProduct.stockReserve ?? 0);
                              setProducts(prev => prev.map(x => x.id === detailProduct.id ? {...x, stock: x.stock+t, stockReserve: Math.max(0,(x.stockReserve??0)-t)} : x));
                              setBatches(prev => { const res: Batch[] = []; let rem = t; for (const b of prev) { if (b.productId !== detailProduct.id || b.location !== "reserve" || b.qty <= 0 || rem <= 0) { res.push(b); continue; } const take = Math.min(b.qty, rem); rem -= take; if (take === b.qty) { res.push({...b, location:"frigo"}); } else { res.push({...b, qty: b.qty-take}); res.push({...b, id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), qty: take, location:"frigo"}); } } return res; });
                              setDetailProduct(prev => prev ? {...prev, stock: prev.stock+t, stockReserve: Math.max(0,(prev.stockReserve??0)-t)} : null);
                            }}
                            className="flex-1 py-2.5 rounded-xl border border-amber-700 bg-amber-900/20 text-amber-400 text-sm font-bold cursor-pointer active:scale-95"
                          >{"Autre"}</button>
                        </div>
                      </div>
                    )}
                    {detailProduct.stock > 0 && (
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">{"\uD83E\uDDCA \u2192 \uD83D\uDCE6 Frigo vers r\u00E9serve"}</span>
                        <div className="flex gap-1.5">
                          {[1, 2, 3].map((n) => (
                            <button key={n} disabled={n > detailProduct.stock}
                              onClick={() => {
                                const t = Math.min(n, detailProduct.stock);
                                setProducts(prev => prev.map(x => x.id === detailProduct.id ? {...x, stock: Math.max(0, x.stock-t), stockReserve: (x.stockReserve??0)+t} : x));
                                setBatches(prev => { const res: Batch[] = []; let rem = t; for (const b of prev) { if (b.productId !== detailProduct.id || b.location !== "frigo" || b.qty <= 0 || rem <= 0) { res.push(b); continue; } const take = Math.min(b.qty, rem); rem -= take; if (take === b.qty) { res.push({...b, location:"reserve"}); } else { res.push({...b, qty: b.qty-take}); res.push({...b, id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), qty: take, location:"reserve"}); } } return res; });
                                setDetailProduct(prev => prev ? {...prev, stock: Math.max(0, prev.stock-t), stockReserve: (prev.stockReserve??0)+t} : null);
                              }}
                              className="flex-1 py-2.5 rounded-xl border border-blue-800 bg-blue-900/20 text-blue-300 text-sm font-bold cursor-pointer active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed"
                            >{String(n)}</button>
                          ))}
                          <button onClick={() => {
                              const val = prompt("Quantit\u00E9 \u00E0 transf\u00E9rer ?");
                              if (!val) return;
                              const n = parseInt(val, 10);
                              if (isNaN(n) || n <= 0) return;
                              const t = Math.min(n, detailProduct.stock);
                              setProducts(prev => prev.map(x => x.id === detailProduct.id ? {...x, stock: Math.max(0, x.stock-t), stockReserve: (x.stockReserve??0)+t} : x));
                              setBatches(prev => { const res: Batch[] = []; let rem = t; for (const b of prev) { if (b.productId !== detailProduct.id || b.location !== "frigo" || b.qty <= 0 || rem <= 0) { res.push(b); continue; } const take = Math.min(b.qty, rem); rem -= take; if (take === b.qty) { res.push({...b, location:"reserve"}); } else { res.push({...b, qty: b.qty-take}); res.push({...b, id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), qty: take, location:"reserve"}); } } return res; });
                              setDetailProduct(prev => prev ? {...prev, stock: Math.max(0, prev.stock-t), stockReserve: (prev.stockReserve??0)+t} : null);
                            }}
                            className="flex-1 py-2.5 rounded-xl border border-amber-700 bg-amber-900/20 text-amber-400 text-sm font-bold cursor-pointer active:scale-95"
                          >{"Autre"}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Lots / DLC ── */}
              {(() => {
                const pBatches = batchesForProduct(detailProduct.id);
                if (pBatches.length === 0) return null;
                const now = new Date();
                const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                return (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {"Lots / DLC (" + pBatches.length + ")"}
                    </span>
                    {pBatches
                      .sort((a, b) => (a.expiryDate || "9").localeCompare(b.expiryDate || "9"))
                      .map((b) => {
                        const exp = b.expiryDate ? new Date(b.expiryDate) : null;
                        const isExpired = exp && exp < now;
                        const isExpiring = exp && !isExpired && exp <= soon;
                        return (
                          <div key={b.id}
                            className={"flex items-center gap-3 rounded-xl px-3 py-2.5 border " +
                              (isExpired ? "bg-red-950/40 border-red-800" :
                               isExpiring ? "bg-orange-950/30 border-orange-800" :
                               "bg-[#0f172a] border-[#1e2d4a]")}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={"text-xs font-bold px-2 py-0.5 rounded " + (b.location === "frigo" ? "bg-blue-900/40 text-blue-300" : "bg-purple-900/40 text-purple-300")}>
                                  {b.location === "frigo" ? "\uD83E\uDDCA Frigo" : "\uD83D\uDCE6 R\u00E9serve"}
                                </span>
                                <span className="text-sm font-bold text-white">{b.qty + " unit\u00E9(s)"}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                                <span>{"Achat : " + new Date(b.purchaseDate).toLocaleDateString("fr-FR")}</span>
                                <span className="text-slate-600">{"\u00B7"}</span>
                                <span>{formatPrice(b.unitCost) + "/u"}</span>
                              </div>
                              {exp ? (
                                <div className="mt-1">
                                  <span className={"text-[11px] font-semibold " + (isExpired ? "text-red-400" : isExpiring ? "text-orange-400" : "text-slate-400")}>
                                    {isExpired ? "\u26A0 P\u00E9rim\u00E9 le " : isExpiring ? "\uD83D\uDD51 Expire le " : "DLC : "}
                                    {exp.toLocaleDateString("fr-FR")}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-600 mt-1 block">{"Pas de DLC"}</span>
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              <input type="date"
                                value={b.expiryDate ? b.expiryDate.slice(0, 10) : ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBatches((prev) => prev.map((x) => x.id === b.id ? { ...x, expiryDate: val ? val + "T23:59:59" : undefined } : x));
                                }}
                                className="h-8 text-[10px] rounded-lg border border-slate-700 bg-[#131b2e] text-white px-1.5 outline-none w-28"
                                title="Modifier DLC"
                              />
                              <button onClick={() => setBatches((prev) => prev.filter((x) => x.id !== b.id))}
                                className="text-[10px] text-red-500 hover:text-red-300 cursor-pointer text-center">
                                {"Supprimer"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })()}

              {/* ── Actions ── */}
              <div className="flex flex-col gap-2 pb-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{"Actions"}</span>
                <button
                  onClick={() => { setRestockingProduct(detailProduct); setRestockForm({ qty: 1, newPrice: detailProduct.price, newCost: detailProduct.cost, method: "especes" }); setDetailProduct(null); }}
                  className="w-full py-3.5 rounded-xl bg-emerald-900/30 border border-emerald-700 text-emerald-400 text-sm font-bold cursor-pointer active:scale-95"
                >{"+ R\u00E9approvisionner"}</button>
                <button
                  onClick={() => { setEditingProduct({ ...detailProduct }); setDetailProduct(null); }}
                  className="w-full py-3.5 rounded-xl bg-[#1e2d4a] border border-slate-700 text-slate-300 text-sm font-bold cursor-pointer active:scale-95"
                >{"\u270F\uFE0F Modifier le produit"}</button>
                <div className="flex gap-2">
                  {!detailProduct.archived ? (
                    <button
                      onClick={() => { setProducts((prev) => prev.map((x) => x.id === detailProduct.id ? { ...x, archived: true } : x)); setDetailProduct(null); }}
                      className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-semibold cursor-pointer"
                    >{"\uD83D\uDCE6 Archiver"}</button>
                  ) : (
                    <button
                      onClick={() => { setProducts((prev) => prev.map((x) => x.id === detailProduct.id ? { ...x, archived: false } : x)); setDetailProduct(null); }}
                      className="flex-1 py-3 rounded-xl border border-amber-700 text-amber-400 text-sm font-semibold cursor-pointer"
                    >{"\u21A9 R\u00E9activer"}</button>
                  )}
                  <button
                    onClick={() => { if (confirm("Supprimer ce produit ?")) { removeProduct(detailProduct.id); setDetailProduct(null); } }}
                    className="flex-1 py-3 rounded-xl border border-red-800 text-red-400 text-sm font-semibold cursor-pointer"
                  >{"\uD83D\uDDD1 Supprimer"}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  onChange={(e) => { const newQty = Math.max(1, parseInt(e.target.value) || 1); setRestockForm((f) => ({ ...f, qty: newQty, newCost: Math.round(newQty * (restockingProduct?.cost || 0) * 100) / 100 })); }}
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

              {/* Prix total d'achat */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-semibold">{"Prix total d'achat"}</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={restockForm.newCost}
                  onChange={(e) => setRestockForm((f) => ({ ...f, newCost: Math.max(0, parseFloat(e.target.value) || 0) }))}
                  className="h-11 rounded-xl border border-slate-700 bg-[#0f172a] text-white text-center text-base outline-none"
                />
                {restockForm.qty > 0 && (
                  <span className="text-[10px] text-emerald-400">{"→ Prix unitaire : " + formatPrice(Math.round((restockForm.newCost / restockForm.qty) * 100) / 100)}</span>
                )}
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

              {/* DLC */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-semibold">{"Date limite de consommation (optionnel)"}</label>
                <input
                  type="date"
                  value={restockForm.expiryDate || ""}
                  onChange={(e) => setRestockForm((f) => ({ ...f, expiryDate: e.target.value || undefined }))}
                  className="h-11 rounded-xl border border-slate-700 bg-[#0f172a] text-white text-center text-base outline-none"
                />
              </div>

              {/* Total */}
              <div className="bg-[#0f172a] rounded-xl p-3 flex justify-between items-center border border-slate-700">
                <span className="text-sm text-slate-400">{"Total achat"}</span>
                <span className="text-base font-extrabold text-red-400">{formatPrice(restockForm.newCost)}</span>
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

      {/* ── Modal membre : édition complète ── */}
      {editingMember && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4" onClick={() => setEditingMember(null)}>
          <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-2xl p-6 max-w-sm w-full flex flex-col gap-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-[#0a1628] flex items-center justify-center text-xl font-bold text-slate-300">
                {editingMember.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-white">{"Modifier membre"}</h2>
                <p className="text-xs text-slate-500">{editingMember.name}</p>
              </div>
              <button onClick={() => setEditingMember(null)} className="text-slate-500 hover:text-white text-xl cursor-pointer">{"✕"}</button>
            </div>

            {/* Nom */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{"Nom"}</label>
              <input
                type="text"
                value={editingMember.newName}
                onChange={(e) => setEditingMember({ ...editingMember, newName: e.target.value })}
                className="w-full h-11 rounded-lg border border-slate-700 bg-[#0a1628] text-white text-sm px-3 outline-none focus:border-blue-500"
              />
            </div>

            {/* Avoir € */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{"Avoir (€)"}</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingMember({ ...editingMember, balance: editingMember.balance - 0.5 })}
                  className="w-9 h-9 rounded-lg bg-red-900/30 border border-red-700/40 text-red-400 font-bold text-lg flex items-center justify-center cursor-pointer">
                  {"-"}
                </button>
                <input
                  type="number"
                  step="0.5"
                  value={editingMember.balance}
                  onChange={(e) => setEditingMember({ ...editingMember, balance: parseFloat(e.target.value) || 0 })}
                  className={"flex-1 h-11 rounded-lg border text-center text-lg font-bold outline-none " + (editingMember.balance > 0 ? "border-emerald-700/50 bg-emerald-900/20 text-emerald-400" : editingMember.balance < 0 ? "border-red-700/50 bg-red-900/20 text-red-400" : "border-slate-700 bg-[#0a1628] text-white")}
                />
                <button onClick={() => setEditingMember({ ...editingMember, balance: editingMember.balance + 0.5 })}
                  className="w-9 h-9 rounded-lg bg-emerald-900/30 border border-emerald-700/40 text-emerald-400 font-bold text-lg flex items-center justify-center cursor-pointer">
                  {"+"}
                </button>
              </div>
            </div>

            {/* Avoir café */}
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{"☕ Avoirs café"}</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingMember({ ...editingMember, coffee: Math.max(0, editingMember.coffee - 1) })}
                  className="w-9 h-9 rounded-lg bg-red-900/30 border border-red-700/40 text-red-400 font-bold text-lg flex items-center justify-center cursor-pointer">
                  {"-"}
                </button>
                <input
                  type="number"
                  min="0"
                  value={editingMember.coffee}
                  onChange={(e) => setEditingMember({ ...editingMember, coffee: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="flex-1 h-11 rounded-lg border border-amber-700/50 bg-amber-900/20 text-amber-400 text-center text-lg font-bold outline-none"
                />
                <button onClick={() => setEditingMember({ ...editingMember, coffee: editingMember.coffee + 1 })}
                  className="w-9 h-9 rounded-lg bg-amber-900/30 border border-amber-700/40 text-amber-400 font-bold text-lg flex items-center justify-center cursor-pointer">
                  {"+"}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { if (confirm("Supprimer " + editingMember.name + " et tout son historique ?")) deleteMember(editingMember.name); }}
                className="px-3 h-10 rounded-lg border border-red-700/40 bg-red-900/20 text-red-400 text-xs font-bold cursor-pointer hover:bg-red-900/40"
              >{"Supprimer"}</button>
              <div className="flex-1" />
              <button
                onClick={() => setEditingMember(null)}
                className="px-4 h-10 rounded-lg border border-slate-700 text-slate-400 text-sm font-bold cursor-pointer hover:bg-slate-800"
              >{"Annuler"}</button>
              <button
                onClick={saveMember}
                className="px-5 h-10 rounded-lg bg-blue-600 text-white text-sm font-bold cursor-pointer active:scale-95 hover:bg-blue-500"
              >{"Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal café : choisir combien de portions utiliser ── */}
      {coffeeModal && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-amber-700/40 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 shadow-2xl">
            <div className="text-4xl text-center">{"☕"}</div>
            <h2 className="text-lg font-bold text-white text-center">
              {"Combien de cafés maintenant ?"}
            </h2>
            <p className="text-sm text-slate-400 text-center">
              {coffeeModal.buyer.split(" ")[0]}
              {" a acheté "}
              <span className="text-amber-400 font-bold">{coffeeModal.totalServings + " café" + (coffeeModal.totalServings > 1 ? "s" : "")}</span>
              {"."}
              {(coffeeCredits[coffeeModal.buyer] || 0) > 0 && (
                <span className="block mt-1 text-emerald-400 font-semibold">
                  {"☕ " + (coffeeCredits[coffeeModal.buyer] || 0) + " avoir(s) café existant(s)"}
                </span>
              )}
            </p>
            <div className="flex flex-col gap-2">
              {Array.from({ length: coffeeModal.totalServings }, (_, i) => i + 1).map((n) => {
                const leftover = coffeeModal.totalServings - n;
                return (
                  <button
                    key={n}
                    onClick={() => handleCoffeeChoice(n)}
                    className={
                      "w-full py-3.5 rounded-xl font-bold text-sm cursor-pointer active:scale-95 flex items-center justify-between px-5 " +
                      (n === coffeeModal.totalServings
                        ? "bg-emerald-600 text-white"
                        : "border border-amber-600 bg-amber-900/20 text-amber-300")
                    }
                  >
                    <span>{n === coffeeModal.totalServings ? "☕".repeat(n) + " Les " + n + " cafés" : "☕".repeat(n) + " " + n + " café" + (n > 1 ? "s" : "") + " maintenant"}</span>
                    {leftover > 0 && (
                      <span className="text-xs text-slate-400 font-normal">
                        {"→ +" + leftover + " avoir"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
