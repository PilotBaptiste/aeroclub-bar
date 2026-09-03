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
  coffeeAddon?: boolean;
  coffeeAddonQty?: number;
  coffeeAddonPrice?: number;
  madeleineServings?: number;
  servings?: number;
  ledStart?: number;
  ledEnd?: number;
  ledColor?: string;
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
  costReprise?: number;
  cupCost?: number;
  sumupFeeRate?: number;
  categories?: Category[];
  supportPhone?: string;
  ledEnabled?: boolean;
  ledOnTime?: string;
  ledOffTime?: string;
  ledForceState?: "on" | "off" | "auto";
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: "boissons", label: "Boissons", emoji: "🍺" },
  { id: "cafe", label: "Café", emoji: "☕", hasCupCost: true },
  { id: "nourriture", label: "Bouffe", emoji: "🍫" },
];

const DEFAULT_SETTINGS: Settings = { clubName: "Aero-Club", adminPin: "1234", bureauPin: "1215" };

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

async function loadFromServer() {
  try {
    const res = await fetch("/api/data");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveToServer(key: string, value: unknown) {
  try {
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    return res.ok;
  } catch { return false; }
}

function formatPrice(p: number) {
  return p.toFixed(2).replace(".", ",") + " €";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getServings(p: Product): number {
  return p.servings || p.coffeeServings || p.madeleineServings || 1;
}

function renderProductIcon(emoji: string, textClass: string, imgSize: string) {
  if (emoji.startsWith("/") || emoji.startsWith("http")) {
    return <img src={emoji} alt="" className={imgSize + " object-contain"} />;
  }
  return <span className={textClass}>{emoji}</span>;
}

const NAV_ITEMS = [
  { id: "stock", label: "📦 Stock & Produits" },
  { id: "members", label: "👥 Membres & Avoirs" },
  { id: "finances", label: "💰 Finances" },
  { id: "history", label: "📋 Historique Ventes" },
  { id: "suggestions", label: "💡 Suggestions" },
  { id: "settings", label: "⚙️ Paramètres" },
];

const EMPTY_PRODUCT_FORM = {
  name: "",
  emoji: "🍺",
  price: 0,
  cost: 0,
  stock: 0,
  category: "",
  location: "",
  servings: 1,
  ledStart: 0,
  ledEnd: 0,
  ledColor: "#ff9900",
  coffeeAddon: false,
  coffeeAddonQty: 0,
  coffeeAddonPrice: 0,
};

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const [activeTab, setActiveTab] = useState("stock");

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [members, setMembers] = useState<MemberAccount[]>([]);
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [coffeeCredits, setCoffeeCredits] = useState<Record<string, number>>({});
  const [productCredits, setProductCredits] = useState<Record<string, Record<string, number>>>({});
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [temperatures, setTemperatures] = useState<{ frigo: number | null; congelateur: number | null; lastUpdate: string | null }>({ frigo: null, congelateur: null, lastUpdate: null });

  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productFormData, setProductFormData] = useState({ ...EMPTY_PRODUCT_FORM });
  const [productFormEditId, setProductFormEditId] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiCatIdx, setEmojiCatIdx] = useState(0);

  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState(1);
  const [restockUnitCost, setRestockUnitCost] = useState(0);
  const [restockMethod, setRestockMethod] = useState<"especes" | "carte">("carte");
  const [restockDlc, setRestockDlc] = useState("");

  const [expandedBatchProduct, setExpandedBatchProduct] = useState<string | null>(null);

  const [memberFormMode, setMemberFormMode] = useState<"add" | "edit" | null>(null);
  const [memberFormName, setMemberFormName] = useState("");
  const [memberFormBalance, setMemberFormBalance] = useState(0);
  const [editingMemberOrigName, setEditingMemberOrigName] = useState("");
  const [creditEditMember, setCreditEditMember] = useState<string | null>(null);

  const [txFilterBuyer, setTxFilterBuyer] = useState("");
  const [txFilterMethod, setTxFilterMethod] = useState("all");

  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({ id: "", label: "", emoji: "", hasCupCost: false });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const [dragProductId, setDragProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const saveTimeout = useRef<Record<string, NodeJS.Timeout>>({});
  const hasLoaded = useRef(false);
  const toastTimeout = useRef<NodeJS.Timeout | null>(null);

  const categories = settings.categories || DEFAULT_CATEGORIES;

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, type });
    toastTimeout.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const debouncedSave = useCallback((key: string, value: unknown) => {
    if (!hasLoaded.current) return;
    if (saveTimeout.current[key]) clearTimeout(saveTimeout.current[key]);
    setSaveStatus("saving");
    saveTimeout.current[key] = setTimeout(async () => {
      const ok = await saveToServer(key, value);
      setSaveStatus(ok ? "saved" : "error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 1000);
  }, []);

  useEffect(() => {
    (async () => {
      const data = await loadFromServer();
      if (data) {
        if (data.products) setProducts(data.products);
        if (data.transactions) setTransactions(data.transactions);
        if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        if (data.suggestions) setSuggestions(data.suggestions);
        if (data.members) setMembers(data.members);
        if (data.procurements) setProcurements(data.procurements);
        if (data.coffeeCredits) setCoffeeCredits(data.coffeeCredits);
        if (data.productCredits) setProductCredits(data.productCredits);
        if (data.batches) setBatches(data.batches);
        hasLoaded.current = true;
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (!loading) debouncedSave("aeroclub-products", products); }, [products, loading, debouncedSave]);
  useEffect(() => { if (!loading) debouncedSave("aeroclub-transactions", transactions); }, [transactions, loading, debouncedSave]);
  useEffect(() => { if (!loading) debouncedSave("aeroclub-settings", settings); }, [settings, loading, debouncedSave]);
  useEffect(() => { if (!loading) debouncedSave("aeroclub-suggestions", suggestions); }, [suggestions, loading, debouncedSave]);
  useEffect(() => { if (!loading) debouncedSave("aeroclub-members", members); }, [members, loading, debouncedSave]);
  useEffect(() => { if (!loading) debouncedSave("aeroclub-procurements", procurements); }, [procurements, loading, debouncedSave]);
  useEffect(() => { if (!loading) debouncedSave("aeroclub-coffee-credits", coffeeCredits); }, [coffeeCredits, loading, debouncedSave]);
  useEffect(() => { if (!loading) debouncedSave("aeroclub-product-credits", productCredits); }, [productCredits, loading, debouncedSave]);
  useEffect(() => { if (!loading) debouncedSave("aeroclub-batches", batches); }, [batches, loading, debouncedSave]);

  useEffect(() => {
    if (!authenticated) return;
    const fetchTemp = async () => {
      try {
        const res = await fetch("/api/fridge?action=status");
        if (res.ok) {
          const data = await res.json();
          setTemperatures({
            frigo: data.temperatures?.frigo ?? null,
            congelateur: data.temperatures?.congelateur ?? null,
            lastUpdate: data.temperatures?.lastUpdate ?? null,
          });
        }
      } catch {}
    };
    fetchTemp();
    const interval = setInterval(fetchTemp, 30000);
    return () => clearInterval(interval);
  }, [authenticated]);

  const getMemberProductCredit = (productId: string, name: string) => productCredits[productId]?.[name] || 0;

  const addProductCredit = (productId: string, name: string, qty: number) => {
    setProductCredits(prev => {
      const updated = { ...prev };
      if (!updated[productId]) updated[productId] = {};
      updated[productId] = { ...updated[productId], [name]: (updated[productId][name] || 0) + qty };
      if (updated[productId][name] <= 0) {
        const { [name]: _, ...rest } = updated[productId];
        updated[productId] = rest;
      }
      return updated;
    });
  };

  const getMemberTotalCredits = (name: string) => {
    let total = 0;
    for (const pid in productCredits) {
      total += productCredits[pid]?.[name] || 0;
    }
    return total;
  };

  const updateProductStock = (productId: string, delta: number, absolute?: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const newStock = absolute !== undefined ? absolute : p.stock + delta;
      return { ...p, stock: Math.max(0, newStock) };
    }));
  };

  const openAddProduct = () => {
    setProductFormData({ ...EMPTY_PRODUCT_FORM });
    setProductFormEditId(null);
    setEmojiPickerOpen(false);
    setProductFormOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setProductFormData({
      name: p.name,
      emoji: p.emoji,
      price: p.price,
      cost: p.cost,
      stock: p.stock,
      category: p.category || "",
      location: p.location || "",
      servings: getServings(p),
      ledStart: p.ledStart || 0,
      ledEnd: p.ledEnd || 0,
      ledColor: p.ledColor || "#ff9900",
      coffeeAddon: p.coffeeAddon || false,
      coffeeAddonQty: p.coffeeAddonQty || 0,
      coffeeAddonPrice: p.coffeeAddonPrice || 0,
    });
    setProductFormEditId(p.id);
    setEmojiPickerOpen(false);
    setProductFormOpen(true);
  };

  const saveProductForm = () => {
    if (!productFormData.name.trim()) {
      showToast("Le nom est requis", "error");
      return;
    }
    if (productFormEditId) {
      setProducts(prev => prev.map(p => {
        if (p.id !== productFormEditId) return p;
        return {
          ...p,
          name: productFormData.name,
          emoji: productFormData.emoji,
          price: productFormData.price,
          cost: productFormData.cost,
          stock: productFormData.stock,
          category: productFormData.category || undefined,
          location: (productFormData.location as Product["location"]) || undefined,
          servings: productFormData.servings,
          ledStart: productFormData.ledStart || undefined,
          ledEnd: productFormData.ledEnd || undefined,
          ledColor: productFormData.ledColor || undefined,
          coffeeAddon: productFormData.coffeeAddon || undefined,
          coffeeAddonQty: productFormData.coffeeAddonQty || undefined,
          coffeeAddonPrice: productFormData.coffeeAddonPrice || undefined,
        };
      }));
      showToast("Produit modifié");
    } else {
      const newProduct: Product = {
        id: Date.now().toString(),
        name: productFormData.name,
        emoji: productFormData.emoji,
        price: productFormData.price,
        cost: productFormData.cost,
        stock: productFormData.stock,
        category: productFormData.category || undefined,
        location: (productFormData.location as Product["location"]) || undefined,
        servings: productFormData.servings,
        ledStart: productFormData.ledStart || undefined,
        ledEnd: productFormData.ledEnd || undefined,
        ledColor: productFormData.ledColor || undefined,
        coffeeAddon: productFormData.coffeeAddon || undefined,
        coffeeAddonQty: productFormData.coffeeAddonQty || undefined,
        coffeeAddonPrice: productFormData.coffeeAddonPrice || undefined,
      };
      setProducts(prev => [...prev, newProduct]);
      showToast("Produit ajouté");
    }
    setProductFormOpen(false);
  };

  const archiveProduct = (id: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, archived: !p.archived } : p));
    showToast("Produit mis à jour");
  };

  const deleteProduct = (id: string, name: string) => {
    setConfirmDialog({
      title: "Supprimer " + name,
      message: "Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.",
      onConfirm: () => {
        setProducts(prev => prev.filter(p => p.id !== id));
        setBatches(prev => prev.filter(b => b.productId !== id));
        showToast("Produit supprimé");
        setConfirmDialog(null);
      },
    });
  };

  const openRestock = (p: Product) => {
    setRestockProduct(p);
    setRestockQty(1);
    setRestockUnitCost(p.cost);
    setRestockMethod("carte");
    setRestockDlc("");
  };

  const submitRestock = () => {
    if (!restockProduct) return;
    const proc: Procurement = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      productId: restockProduct.id,
      productName: restockProduct.name,
      qty: restockQty,
      unitCost: restockUnitCost,
      totalCost: restockQty * restockUnitCost,
      method: restockMethod,
    };
    setProcurements(prev => [...prev, proc]);
    updateProductStock(restockProduct.id, restockQty);
    if (restockDlc) {
      const newBatch: Batch = {
        id: (Date.now() + 1).toString(),
        productId: restockProduct.id,
        qty: restockQty,
        location: "reserve",
        purchaseDate: new Date().toISOString(),
        expiryDate: restockDlc,
        unitCost: restockUnitCost,
      };
      setBatches(prev => [...prev, newBatch]);
    }
    showToast("Restock enregistré : " + restockQty + "x " + restockProduct.name);
    setRestockProduct(null);
  };

  const ledTest = (p: Product) => {
    if (!p.ledStart && !p.ledEnd) return;
    const color = (p.ledColor || "#ff9900").replace("#", "");
    fetch("/api/fridge?action=trigger&lock=" + (p.location || "frigo") + "&leds=" + (p.ledStart || 0) + "-" + (p.ledEnd || 0) + ":" + color);
    showToast("Test LED envoyé");
  };

  const openAddMember = () => {
    setMemberFormMode("add");
    setMemberFormName("");
    setMemberFormBalance(0);
    setEditingMemberOrigName("");
  };

  const openEditMember = (m: MemberAccount) => {
    setMemberFormMode("edit");
    setMemberFormName(m.name);
    setMemberFormBalance(m.balance);
    setEditingMemberOrigName(m.name);
  };

  const saveMemberForm = () => {
    if (!memberFormName.trim()) {
      showToast("Le nom est requis", "error");
      return;
    }
    if (memberFormMode === "add") {
      if (members.some(m => m.name.toLowerCase() === memberFormName.trim().toLowerCase())) {
        showToast("Ce membre existe déjà", "error");
        return;
      }
      setMembers(prev => [...prev, { name: memberFormName.trim(), balance: memberFormBalance }]);
      showToast("Membre ajouté");
    } else if (memberFormMode === "edit") {
      setMembers(prev => prev.map(m => m.name === editingMemberOrigName ? { name: memberFormName.trim(), balance: memberFormBalance } : m));
      if (memberFormName.trim() !== editingMemberOrigName) {
        setProductCredits(prev => {
          const updated = { ...prev };
          for (const pid in updated) {
            if (updated[pid][editingMemberOrigName] !== undefined) {
              updated[pid] = { ...updated[pid], [memberFormName.trim()]: updated[pid][editingMemberOrigName] };
              const { [editingMemberOrigName]: _, ...rest } = updated[pid];
              updated[pid] = rest;
            }
          }
          return updated;
        });
        setCoffeeCredits(prev => {
          if (prev[editingMemberOrigName] === undefined) return prev;
          const updated = { ...prev, [memberFormName.trim()]: prev[editingMemberOrigName] };
          const { [editingMemberOrigName]: _, ...rest } = updated;
          return rest;
        });
      }
      showToast("Membre modifié");
    }
    setMemberFormMode(null);
  };

  const deleteMember = (name: string) => {
    setConfirmDialog({
      title: "Supprimer " + name,
      message: "Êtes-vous sûr de vouloir supprimer ce membre ? Ses avoirs seront perdus.",
      onConfirm: () => {
        setMembers(prev => prev.filter(m => m.name !== name));
        setProductCredits(prev => {
          const updated = { ...prev };
          for (const pid in updated) {
            if (updated[pid][name] !== undefined) {
              const { [name]: _, ...rest } = updated[pid];
              updated[pid] = rest;
            }
          }
          return updated;
        });
        setCoffeeCredits(prev => {
          const { [name]: _, ...rest } = prev;
          return rest;
        });
        showToast("Membre supprimé");
        setConfirmDialog(null);
      },
    });
  };

  const deleteTransaction = (id: string) => {
    setConfirmDialog({
      title: "Supprimer la transaction",
      message: "Êtes-vous sûr de vouloir supprimer cette transaction ?",
      onConfirm: () => {
        setTransactions(prev => prev.filter(t => t.id !== id));
        showToast("Transaction supprimée");
        setConfirmDialog(null);
      },
    });
  };

  const deleteSuggestion = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
    showToast("Suggestion supprimée");
  };

  const updateSettings = (key: string, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const addCategory = () => {
    if (!categoryFormData.label.trim() || !categoryFormData.emoji.trim()) {
      showToast("Label et emoji requis", "error");
      return;
    }
    const newCat: Category = {
      id: categoryFormData.id || Date.now().toString(),
      label: categoryFormData.label,
      emoji: categoryFormData.emoji,
      hasCupCost: categoryFormData.hasCupCost,
    };
    if (editingCategoryId) {
      setSettings(prev => ({
        ...prev,
        categories: (prev.categories || DEFAULT_CATEGORIES).map(c => c.id === editingCategoryId ? newCat : c),
      }));
      showToast("Catégorie modifiée");
    } else {
      setSettings(prev => ({
        ...prev,
        categories: [...(prev.categories || DEFAULT_CATEGORIES), newCat],
      }));
      showToast("Catégorie ajoutée");
    }
    setShowCategoryForm(false);
    setEditingCategoryId(null);
    setCategoryFormData({ id: "", label: "", emoji: "", hasCupCost: false });
  };

  const deleteCategory = (id: string) => {
    setSettings(prev => ({
      ...prev,
      categories: (prev.categories || DEFAULT_CATEGORIES).filter(c => c.id !== id),
    }));
    showToast("Catégorie supprimée");
  };

  const handlePinSubmit = () => {
    if (pinInput === settings.adminPin || pinInput === (settings.bureauPin || "1215")) {
      setAuthenticated(true);
      setPinInput("");
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  const handlePinKey = (key: string) => {
    if (key === "back") {
      setPinInput(prev => prev.slice(0, -1));
      setPinError(false);
    } else if (key === "enter") {
      handlePinSubmit();
    } else {
      if (pinInput.length < Math.max(settings.adminPin.length, (settings.bureauPin || "1215").length, 4)) {
        setPinInput(prev => prev + key);
        setPinError(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f1c] text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">{"✈️"}</div>
          <div className="text-lg text-gray-400">{"Chargement..."}</div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0f1c] text-white">
        <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-2xl p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">{"✈️"}</div>
            <h1 className="text-xl font-bold text-amber-500">{settings.clubName}</h1>
            <p className="text-sm text-gray-400 mt-1">{"Administration"}</p>
          </div>
          <div className="flex justify-center gap-3 mb-6 h-8">
            {Array.from({ length: Math.max(settings.adminPin.length, (settings.bureauPin || "1215").length, 4) }).map((_, i) => (
              <div
                key={i}
                className={"w-3 h-3 rounded-full transition-all " + (i < pinInput.length ? "bg-amber-500 scale-125" : "bg-[#1e2d4a]")}
              />
            ))}
          </div>
          {pinError && (
            <div className="text-center text-red-400 text-sm mb-4">{"Code incorrect"}</div>
          )}
          <div className="grid grid-cols-3 gap-3">
            {["1","2","3","4","5","6","7","8","9"].map(k => (
              <button
                key={k}
                onClick={() => handlePinKey(k)}
                className="h-16 rounded-xl bg-[#1a2340] border border-[#1e2d4a] text-white text-xl font-semibold cursor-pointer hover:bg-[#243052] active:scale-95 transition-all"
              >
                {k}
              </button>
            ))}
            <button
              onClick={() => handlePinKey("back")}
              className="h-16 rounded-xl bg-[#1a2340] border border-[#1e2d4a] text-gray-400 text-lg cursor-pointer hover:bg-[#243052] active:scale-95 transition-all"
            >
              {"⌫"}
            </button>
            <button
              onClick={() => handlePinKey("0")}
              className="h-16 rounded-xl bg-[#1a2340] border border-[#1e2d4a] text-white text-xl font-semibold cursor-pointer hover:bg-[#243052] active:scale-95 transition-all"
            >
              {"0"}
            </button>
            <button
              onClick={() => handlePinKey("enter")}
              className="h-16 rounded-xl bg-amber-500 text-black text-lg font-bold cursor-pointer hover:bg-amber-400 active:scale-95 transition-all"
            >
              {"→"}
            </button>
          </div>
          <a href="/" className="block text-center mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors">
            {"← Retour au bar"}
          </a>
        </div>
      </div>
    );
  }

  const sortedProducts = [...products].sort((a, b) => {
    if (a.archived && !b.archived) return 1;
    if (!a.archived && b.archived) return -1;
    return 0;
  });

  const STOCK_SECTIONS = [
    { id: "frigo", label: "Frigo", emoji: "❄️", cols: 8, border: "border-blue-500/30", bg: "bg-blue-500/5" },
    { id: "cafe", label: "Café", emoji: "☕", cols: 4, border: "border-amber-500/30", bg: "bg-amber-500/5" },
    { id: "congelateur", label: "Congélateur", emoji: "🧊", cols: 6, border: "border-cyan-500/30", bg: "bg-cyan-500/5" },
    { id: "_other", label: "Non assigné", emoji: "📦", cols: 6, border: "border-gray-500/30", bg: "bg-gray-500/5" },
  ];

  const productsBySection = (sectionId: string) => {
    return sortedProducts.filter(p => {
      const loc = p.location || "";
      if (sectionId === "_other") return !loc;
      return loc === sectionId;
    });
  };

  const handleDragStart = (e: React.DragEvent, productId: string) => {
    setDragProductId(productId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDragProductId(null);
    setDragOverProductId(null);
    setDragOverSection(null);
  };

  const handleDropOnProduct = (targetId: string, sectionId: string) => {
    if (!dragProductId || dragProductId === targetId) { handleDragEnd(); return; }
    setProducts(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(p => p.id === dragProductId);
      const toIdx = arr.findIndex(p => p.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const moved = { ...arr[fromIdx], location: sectionId === "_other" ? undefined : sectionId as Product["location"] };
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
    handleDragEnd();
  };

  const handleDropOnSection = (sectionId: string) => {
    if (!dragProductId) return;
    setProducts(prev => {
      const arr = [...prev];
      const idx = arr.findIndex(p => p.id === dragProductId);
      if (idx === -1) return prev;
      arr[idx] = { ...arr[idx], location: sectionId === "_other" ? undefined : sectionId as Product["location"] };
      return arr;
    });
    handleDragEnd();
  };

  const filteredTx = transactions
    .filter(t => {
      if (txFilterBuyer && !t.buyer.toLowerCase().includes(txFilterBuyer.toLowerCase())) return false;
      if (txFilterMethod !== "all" && t.method !== txFilterMethod) return false;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const txCashRevenue = transactions.filter(t => t.method === "especes").reduce((s, t) => s + t.total, 0);
  const txCBRevenue = transactions.filter(t => t.method === "sumup").reduce((s, t) => s + t.total, 0);
  const trackedCosts = procurements.reduce((s, p) => s + p.totalCost, 0);
  const cashFromSales = txCashRevenue;
  const cashFromRestocks = procurements.filter(p => p.method === "especes").reduce((s, p) => s + p.totalCost, 0);
  const cbFromRestocks = procurements.filter(p => p.method === "carte").reduce((s, p) => s + p.totalCost, 0);
  const sumupFees = txCBRevenue * (settings.sumupFeeRate ?? 2.5) / 100;
  const caTotal = (settings.cashInitialFund || 0) + txCashRevenue + (settings.cbInitialFund || 0) + txCBRevenue;
  const totalCostsWithReprise = (settings.costReprise || 0) + trackedCosts;
  const margin = caTotal > 0 ? ((caTotal - totalCostsWithReprise) / caTotal * 100) : 0;
  const treasuryCash = (settings.cashInBox || 0) + cashFromSales - cashFromRestocks;
  const treasuryCB = (settings.cbReceived || 0) + txCBRevenue - cbFromRestocks;

  const inputClass = "bg-[#1a2340] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-amber-500 transition-colors w-full";
  const selectClass = "bg-[#1a2340] border border-[#1e2d4a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-amber-500 transition-colors w-full";
  const btnPrimary = "px-4 py-2 bg-amber-500 text-black rounded-lg font-semibold text-sm cursor-pointer hover:bg-amber-400 transition-colors";
  const btnSecondary = "px-4 py-2 bg-[#1a2340] border border-[#1e2d4a] text-gray-300 rounded-lg text-sm cursor-pointer hover:bg-[#243052] transition-colors";
  const btnDanger = "px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm cursor-pointer hover:bg-red-500/30 transition-colors";
  const cardClass = "bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-6";

  return (
    <div className="flex h-screen bg-[#0a0f1c] text-white overflow-hidden">
      <aside className="w-60 bg-[#131b2e] border-r border-[#1e2d4a] flex flex-col shrink-0">
        <div className="p-5 border-b border-[#1e2d4a]">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{"✈️"}</span>
            <div>
              <div className="font-bold text-amber-500">{settings.clubName}</div>
              <div className="text-xs text-gray-500">{"Administration"}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={"w-full text-left px-5 py-3 text-sm cursor-pointer transition-colors " + (activeTab === item.id ? "bg-amber-500/10 text-amber-500 border-r-2 border-amber-500 font-semibold" : "text-gray-400 hover:text-white hover:bg-[#1a2340]")}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-[#1e2d4a] text-xs text-gray-500">
          <div className="flex items-center gap-2 mb-1">
            <span>{saveStatus === "saving" ? "🔄" : saveStatus === "saved" ? "✅" : saveStatus === "error" ? "❌" : "⭕"}</span>
            <span>{saveStatus === "saving" ? "Sauvegarde..." : saveStatus === "saved" ? "Sauvegardé" : saveStatus === "error" ? "Erreur" : "Prêt"}</span>
          </div>
        </div>
        {(temperatures.frigo !== null || temperatures.congelateur !== null) && (
          <div className="px-5 py-3 border-t border-[#1e2d4a] text-xs">
            {temperatures.frigo !== null && (
              <div className="flex justify-between text-gray-400 mb-1">
                <span>{"🧊 Frigo"}</span>
                <span className={temperatures.frigo > 8 ? "text-red-400" : "text-emerald-400"}>{temperatures.frigo.toFixed(1) + "°C"}</span>
              </div>
            )}
            {temperatures.congelateur !== null && (
              <div className="flex justify-between text-gray-400 mb-1">
                <span>{"❄️ Congél."}</span>
                <span className={temperatures.congelateur > -10 ? "text-red-400" : "text-emerald-400"}>{temperatures.congelateur.toFixed(1) + "°C"}</span>
              </div>
            )}
            {temperatures.lastUpdate && (
              <div className="text-gray-600 text-[10px] mt-1">{formatDate(temperatures.lastUpdate)}</div>
            )}
          </div>
        )}
        <a href="/" className="block px-5 py-4 border-t border-[#1e2d4a] text-sm text-gray-400 hover:text-white transition-colors cursor-pointer">
          {"← Retour au bar"}
        </a>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {activeTab === "stock" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{"📦 Stock & Produits"}</h2>
              <button onClick={openAddProduct} className={btnPrimary}>{"+ Ajouter un produit"}</button>
            </div>

            {STOCK_SECTIONS.map(section => {
              const sectionProducts = productsBySection(section.id);
              if (sectionProducts.length === 0 && section.id !== "_other") return null;
              const gridCols = section.cols === 8 ? "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8" : section.cols === 6 ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
              return (
                <div key={section.id} className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{section.emoji}</span>
                    <h3 className="text-lg font-bold">{section.label}</h3>
                    <span className="text-sm text-gray-500">{"(" + sectionProducts.length + ")"}</span>
                  </div>
                  <div
                    className={"rounded-xl border border-dashed p-3 min-h-[90px] transition-colors " + section.border + " " + section.bg + (dragOverSection === section.id && dragProductId ? " !border-amber-500 !bg-amber-500/10" : "")}
                    onDragOver={(e) => { e.preventDefault(); setDragOverSection(section.id); }}
                    onDragLeave={() => setDragOverSection(null)}
                    onDrop={(e) => { e.preventDefault(); handleDropOnSection(section.id); }}
                  >
                    {sectionProducts.length === 0 ? (
                      <div className="flex items-center justify-center h-16 text-gray-600 text-sm">{"Glissez des produits ici"}</div>
                    ) : (
                      <div className={"grid gap-2 " + gridCols}>
                        {sectionProducts.map(p => {
                          const isSelected = selectedCardId === p.id;
                          const isDragging = dragProductId === p.id;
                          const isDragOver = dragOverProductId === p.id;
                          const stockColor = p.stock <= 0 ? "text-red-500" : p.stock <= 3 ? "text-red-400" : p.stock <= 8 ? "text-orange-400" : "text-emerald-400";
                          return (
                            <div
                              key={p.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, p.id)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverProductId(p.id); setDragOverSection(null); }}
                              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropOnProduct(p.id, section.id); }}
                              onClick={() => setSelectedCardId(isSelected ? null : p.id)}
                              className={"group relative rounded-lg border p-2 text-center cursor-grab active:cursor-grabbing transition-all select-none "
                                + (isDragging ? "opacity-30 scale-95 " : "")
                                + (isDragOver ? "border-amber-500 bg-amber-500/10 scale-105 " : "border-[#1e2d4a] ")
                                + (isSelected ? "bg-[#1a2340] border-amber-500/60 " : "bg-[#141e35] hover:bg-[#1a2340] ")
                                + (p.archived ? "opacity-40 " : "")
                                + (p.stock <= 0 ? "ring-1 ring-red-500/30 " : "")
                              }
                            >
                              <div className="flex items-center justify-center h-9">
                                {renderProductIcon(p.emoji, "text-2xl", "w-8 h-8")}
                              </div>
                              <div className="text-[11px] text-white truncate mt-1 leading-tight" title={p.name}>{p.name}</div>
                              <div className={"text-sm font-bold mt-0.5 tabular-nums " + stockColor}>
                                {p.stock <= 0 ? "Épuisé" : String(p.stock)}
                              </div>
                              <div className="text-[10px] text-gray-500">{formatPrice(p.price)}</div>
                              {isSelected && (
                                <div className="mt-2 flex flex-col gap-1">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); updateProductStock(p.id, -1); }}
                                      className="w-6 h-6 rounded bg-[#0d1526] border border-[#1e2d4a] text-gray-400 hover:text-white cursor-pointer flex items-center justify-center text-xs"
                                    >{"-"}</button>
                                    <span className={"text-sm font-bold tabular-nums " + stockColor}>{String(p.stock)}</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); updateProductStock(p.id, 1); }}
                                      className="w-6 h-6 rounded bg-[#0d1526] border border-[#1e2d4a] text-gray-400 hover:text-white cursor-pointer flex items-center justify-center text-xs"
                                    >{"+"}</button>
                                  </div>
                                  <div className="flex items-center justify-center gap-1 mt-1">
                                    <button onClick={(e) => { e.stopPropagation(); openEditProduct(p); }} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] cursor-pointer hover:bg-blue-500/30" title="Modifier">{"✏️"}</button>
                                    <button onClick={(e) => { e.stopPropagation(); openRestock(p); }} className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] cursor-pointer hover:bg-emerald-500/30" title="Restock">{"📥"}</button>
                                    {(p.ledStart || p.ledEnd) ? (
                                      <button onClick={(e) => { e.stopPropagation(); ledTest(p); }} className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-[10px] cursor-pointer hover:bg-yellow-500/30" title="Test LED">{"💡"}</button>
                                    ) : null}
                                    <button onClick={(e) => { e.stopPropagation(); deleteProduct(p.id, p.name); }} className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] cursor-pointer hover:bg-red-500/30" title="Supprimer">{"🗑"}</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "members" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{"👥 Membres & Avoirs"}</h2>
              <button onClick={openAddMember} className={btnPrimary}>{"+ Ajouter un membre"}</button>
            </div>
            <div className={cardClass}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e2d4a] text-left text-gray-400 text-xs uppercase tracking-wider">
                      <th className="pb-3 font-medium">{"Nom"}</th>
                      <th className="pb-3 font-medium text-right">{"Solde"}</th>
                      <th className="pb-3 font-medium text-center">{"Avoirs café"}</th>
                      <th className="pb-3 font-medium">{"Avoirs produits"}</th>
                      <th className="pb-3 font-medium text-right">{"Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...members].sort((a, b) => a.name.localeCompare(b.name)).map(m => {
                      const coffeeCred = coffeeCredits[m.name] || 0;
                      const totalProductCreds = getMemberTotalCredits(m.name);
                      return (
                        <tr key={m.name} className="border-b border-[#1e2d4a]/50 hover:bg-[#1a2340] transition-colors">
                          <td className="py-3 font-medium">{m.name}</td>
                          <td className={"py-3 text-right font-medium " + (m.balance > 0 ? "text-emerald-400" : m.balance < 0 ? "text-red-400" : "text-gray-400")}>
                            {formatPrice(m.balance)}
                          </td>
                          <td className="py-3 text-center">
                            {coffeeCred > 0 ? (
                              <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-xs">{"☕ " + coffeeCred}</span>
                            ) : (
                              <span className="text-gray-600">{"-"}</span>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1">
                              {products.filter(p => !p.archived && getMemberProductCredit(p.id, m.name) > 0).map(p => (
                                <span key={p.id} className="bg-[#1a2340] border border-[#1e2d4a] px-2 py-0.5 rounded text-xs flex items-center gap-1">
                                  {renderProductIcon(p.emoji, "text-xs", "w-3 h-3")}
                                  <span>{String(getMemberProductCredit(p.id, m.name))}</span>
                                </span>
                              ))}
                              {totalProductCreds === 0 && <span className="text-gray-600 text-xs">{"-"}</span>}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEditMember(m)} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs cursor-pointer hover:bg-blue-500/30 transition-colors">{"✏️"}</button>
                              <button onClick={() => setCreditEditMember(m.name)} className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs cursor-pointer hover:bg-purple-500/30 transition-colors">{"🎁"}</button>
                              <button onClick={() => deleteMember(m.name)} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs cursor-pointer hover:bg-red-500/30 transition-colors">{"🗑"}</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {members.length === 0 && (
                  <div className="text-center py-12 text-gray-500">{"Aucun membre"}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "finances" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{"💰 Finances"}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-amber-500 mb-4">{"Chiffre d'affaires"}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"Espèces"}</span>
                    <span className="font-medium">{formatPrice(txCashRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"CB (SumUp)"}</span>
                    <span className="font-medium">{formatPrice(txCBRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"Frais SumUp (" + (settings.sumupFeeRate ?? 2.5) + "%)"}</span>
                    <span className="font-medium text-red-400">{"-" + formatPrice(sumupFees)}</span>
                  </div>
                  <div className="border-t border-[#1e2d4a] pt-3 flex justify-between">
                    <span className="font-semibold">{"CA Total"}</span>
                    <span className="font-bold text-amber-500 text-lg">{formatPrice(caTotal)}</span>
                  </div>
                </div>
              </div>
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-amber-500 mb-4">{"Rentabilité"}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"Coûts (rachats)"}</span>
                    <span className="font-medium text-red-400">{formatPrice(trackedCosts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"Reprise stock"}</span>
                    <span className="font-medium text-red-400">{formatPrice(settings.costReprise || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"Total coûts"}</span>
                    <span className="font-medium text-red-400">{formatPrice(totalCostsWithReprise)}</span>
                  </div>
                  <div className="border-t border-[#1e2d4a] pt-3 flex justify-between">
                    <span className="font-semibold">{"Profit"}</span>
                    <span className={"font-bold text-lg " + (caTotal - totalCostsWithReprise >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {formatPrice(caTotal - totalCostsWithReprise)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"Marge"}</span>
                    <span className={"font-semibold " + (margin >= 0 ? "text-emerald-400" : "text-red-400")}>{margin.toFixed(1) + "%"}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-emerald-400 mb-4">{"Trésorerie Espèces"}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"Fond initial"}</span>
                    <span>{formatPrice(settings.cashInBox || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"+ Ventes espèces"}</span>
                    <span className="text-emerald-400">{formatPrice(cashFromSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"- Rachats espèces"}</span>
                    <span className="text-red-400">{formatPrice(cashFromRestocks)}</span>
                  </div>
                  <div className="border-t border-[#1e2d4a] pt-3 flex justify-between">
                    <span className="font-semibold">{"Solde caisse"}</span>
                    <span className="font-bold text-lg text-emerald-400">{formatPrice(treasuryCash)}</span>
                  </div>
                </div>
              </div>
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-blue-400 mb-4">{"Trésorerie CB"}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"Fond initial CB"}</span>
                    <span>{formatPrice(settings.cbReceived || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"+ Ventes CB"}</span>
                    <span className="text-emerald-400">{formatPrice(txCBRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{"- Rachats CB"}</span>
                    <span className="text-red-400">{formatPrice(cbFromRestocks)}</span>
                  </div>
                  <div className="border-t border-[#1e2d4a] pt-3 flex justify-between">
                    <span className="font-semibold">{"Solde CB"}</span>
                    <span className="font-bold text-lg text-blue-400">{formatPrice(treasuryCB)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className={cardClass}>
              <h3 className="text-lg font-semibold text-amber-500 mb-4">{"Historique des rachats"}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e2d4a] text-left text-gray-400 text-xs uppercase tracking-wider">
                      <th className="pb-3 font-medium">{"Date"}</th>
                      <th className="pb-3 font-medium">{"Produit"}</th>
                      <th className="pb-3 font-medium text-center">{"Qté"}</th>
                      <th className="pb-3 font-medium text-right">{"Coût unit."}</th>
                      <th className="pb-3 font-medium text-right">{"Total"}</th>
                      <th className="pb-3 font-medium">{"Méthode"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...procurements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(proc => (
                      <tr key={proc.id} className="border-b border-[#1e2d4a]/50 hover:bg-[#1a2340] transition-colors">
                        <td className="py-3 text-gray-400">{formatDate(proc.date)}</td>
                        <td className="py-3 font-medium">{proc.productName}</td>
                        <td className="py-3 text-center">{String(proc.qty)}</td>
                        <td className="py-3 text-right text-gray-400">{formatPrice(proc.unitCost)}</td>
                        <td className="py-3 text-right font-medium text-red-400">{formatPrice(proc.totalCost)}</td>
                        <td className="py-3">{proc.method === "especes" ? "💵 Espèces" : "💳 Carte"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {procurements.length === 0 && (
                  <div className="text-center py-12 text-gray-500">{"Aucun rachat enregistré"}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{"📋 Historique Ventes"}</h2>
            <div className="flex items-center gap-4 mb-6">
              <input
                type="text"
                placeholder="Filtrer par nom..."
                value={txFilterBuyer}
                onChange={(e) => setTxFilterBuyer(e.target.value)}
                className={inputClass + " !w-64"}
              />
              <select
                value={txFilterMethod}
                onChange={(e) => setTxFilterMethod(e.target.value)}
                className={selectClass + " !w-48"}
              >
                <option value="all">{"Tous les modes"}</option>
                <option value="especes">{"Espèces"}</option>
                <option value="sumup">{"CB (SumUp)"}</option>
                <option value="avoir">{"Avoir"}</option>
                <option value="avoir-produit">{"Avoir produit"}</option>
              </select>
              <div className="text-sm text-gray-400 ml-auto">
                {filteredTx.length + " transaction" + (filteredTx.length > 1 ? "s" : "") + " — Total: " + formatPrice(filteredTx.reduce((s, t) => s + t.total, 0))}
              </div>
            </div>
            <div className={cardClass}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e2d4a] text-left text-gray-400 text-xs uppercase tracking-wider">
                      <th className="pb-3 font-medium">{"Date"}</th>
                      <th className="pb-3 font-medium">{"Acheteur"}</th>
                      <th className="pb-3 font-medium">{"Articles"}</th>
                      <th className="pb-3 font-medium text-right">{"Total"}</th>
                      <th className="pb-3 font-medium">{"Paiement"}</th>
                      <th className="pb-3 font-medium text-right">{"Payé"}</th>
                      <th className="pb-3 font-medium text-right">{"Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTx.map(t => (
                      <tr key={t.id} className="border-b border-[#1e2d4a]/50 hover:bg-[#1a2340] transition-colors">
                        <td className="py-3 text-gray-400 text-xs">{formatDate(t.date)}</td>
                        <td className="py-3 font-medium">{t.buyer}</td>
                        <td className="py-3 text-gray-300 text-xs max-w-xs truncate">{t.items}</td>
                        <td className="py-3 text-right font-medium text-amber-500">{formatPrice(t.total)}</td>
                        <td className="py-3">
                          <span className={"px-2 py-0.5 rounded text-xs " + (t.method === "especes" ? "bg-emerald-500/20 text-emerald-400" : t.method === "sumup" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400")}>
                            {t.method === "especes" ? "Espèces" : t.method === "sumup" ? "CB" : t.method}
                          </span>
                        </td>
                        <td className="py-3 text-right text-gray-400">{t.amountPaid !== undefined ? formatPrice(t.amountPaid) : "-"}</td>
                        <td className="py-3 text-right">
                          <button onClick={() => deleteTransaction(t.id)} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs cursor-pointer hover:bg-red-500/30 transition-colors">{"🗑"}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTx.length === 0 && (
                  <div className="text-center py-12 text-gray-500">{"Aucune transaction"}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "suggestions" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{"💡 Suggestions"}</h2>
            <div className={cardClass}>
              {suggestions.length === 0 && (
                <div className="text-center py-12 text-gray-500">{"Aucune suggestion"}</div>
              )}
              <div className="space-y-3">
                {[...suggestions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(s => (
                  <div key={s.id} className="flex items-start gap-4 bg-[#0a0f1c] rounded-lg border border-[#1e2d4a] p-4">
                    <div className="flex-1">
                      <p className="text-sm text-white mb-2">{s.text}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{s.author}</span>
                        <span>{formatDate(s.date)}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteSuggestion(s.id)} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs cursor-pointer hover:bg-red-500/30 transition-colors shrink-0">{"🗑"}</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">{"⚙️ Paramètres"}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-amber-500 mb-4">{"Général"}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"Nom du club"}</label>
                    <input type="text" value={settings.clubName} onChange={(e) => updateSettings("clubName", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"Code PIN admin"}</label>
                    <input type="text" value={settings.adminPin} onChange={(e) => updateSettings("adminPin", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"Code PIN bureau"}</label>
                    <input type="text" value={settings.bureauPin || ""} onChange={(e) => updateSettings("bureauPin", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"Téléphone support"}</label>
                    <input type="text" value={settings.supportPhone || ""} onChange={(e) => updateSettings("supportPhone", e.target.value)} className={inputClass} />
                  </div>
                </div>
              </div>
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-amber-500 mb-4">{"Tarification"}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"Coût gobelet (€)"}</label>
                    <input type="number" step="0.01" value={settings.cupCost || 0} onChange={(e) => updateSettings("cupCost", parseFloat(e.target.value) || 0)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"Taux SumUp (%)"}</label>
                    <input type="number" step="0.1" value={settings.sumupFeeRate ?? 2.5} onChange={(e) => updateSettings("sumupFeeRate", parseFloat(e.target.value) || 0)} className={inputClass} />
                  </div>
                </div>
              </div>
              <div className={cardClass}>
                <h3 className="text-lg font-semibold text-amber-500 mb-4">{"Reprises financières"}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"Caisse espèces (€)"}</label>
                    <input type="number" step="0.01" value={settings.cashInBox || 0} onChange={(e) => updateSettings("cashInBox", parseFloat(e.target.value) || 0)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"CB reçu (€)"}</label>
                    <input type="number" step="0.01" value={settings.cbReceived || 0} onChange={(e) => updateSettings("cbReceived", parseFloat(e.target.value) || 0)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"Fond initial caisse (€)"}</label>
                    <input type="number" step="0.01" value={settings.cashInitialFund || 0} onChange={(e) => updateSettings("cashInitialFund", parseFloat(e.target.value) || 0)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"Fond initial CB (€)"}</label>
                    <input type="number" step="0.01" value={settings.cbInitialFund || 0} onChange={(e) => updateSettings("cbInitialFund", parseFloat(e.target.value) || 0)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"Coût reprise stock (€)"}</label>
                    <input type="number" step="0.01" value={settings.costReprise || 0} onChange={(e) => updateSettings("costReprise", parseFloat(e.target.value) || 0)} className={inputClass} />
                  </div>
                </div>
              </div>
              <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-amber-500">{"Catégories"}</h3>
                  <button
                    onClick={() => {
                      setCategoryFormData({ id: "", label: "", emoji: "", hasCupCost: false });
                      setEditingCategoryId(null);
                      setShowCategoryForm(true);
                    }}
                    className={btnPrimary + " !text-xs !px-3 !py-1.5"}
                  >{"+ Ajouter"}</button>
                </div>
                <div className="space-y-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between bg-[#0a0f1c] rounded-lg border border-[#1e2d4a] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{cat.emoji}</span>
                        <span className="font-medium">{cat.label}</span>
                        {cat.hasCupCost && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">{"gobelet"}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setCategoryFormData({ id: cat.id, label: cat.label, emoji: cat.emoji, hasCupCost: cat.hasCupCost || false });
                            setEditingCategoryId(cat.id);
                            setShowCategoryForm(true);
                          }}
                          className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs cursor-pointer hover:bg-blue-500/30 transition-colors"
                        >{"✏️"}</button>
                        <button onClick={() => deleteCategory(cat.id)} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs cursor-pointer hover:bg-red-500/30 transition-colors">{"🗑"}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={cardClass + " lg:col-span-2"}>
                <h3 className="text-lg font-semibold text-amber-500 mb-4">{"Configuration LED"}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer mb-4">
                      <input
                        type="checkbox"
                        checked={settings.ledEnabled || false}
                        onChange={(e) => updateSettings("ledEnabled", e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                      <span className="text-sm font-medium">{"LED activées"}</span>
                    </label>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{"Heure allumage"}</label>
                        <input type="time" value={settings.ledOnTime || ""} onChange={(e) => updateSettings("ledOnTime", e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">{"Heure extinction"}</label>
                        <input type="time" value={settings.ledOffTime || ""} onChange={(e) => updateSettings("ledOffTime", e.target.value)} className={inputClass} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">{"Mode forcé"}</label>
                    <div className="space-y-2">
                      {(["auto", "on", "off"] as const).map(mode => (
                        <label key={mode} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="ledForceState"
                            checked={(settings.ledForceState || "auto") === mode}
                            onChange={() => updateSettings("ledForceState", mode)}
                            className="accent-amber-500"
                          />
                          <span className="text-sm">{mode === "auto" ? "Automatique" : mode === "on" ? "Forcé ON" : "Forcé OFF"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">{"Contrôle direct"}</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { fetch("/api/fridge?action=leds-on"); showToast("LED allumées"); }}
                        className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm cursor-pointer hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
                      >{"💡 Allumer"}</button>
                      <button
                        onClick={() => { fetch("/api/fridge?action=leds-off"); showToast("LED éteintes"); }}
                        className="px-4 py-2 bg-gray-500/20 text-gray-400 rounded-lg text-sm cursor-pointer hover:bg-gray-500/30 transition-colors border border-gray-500/30"
                      >{"🌑 Éteindre"}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {productFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setProductFormOpen(false)}>
          <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{productFormEditId ? "Modifier le produit" : "Ajouter un produit"}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Nom"}</label>
                <input type="text" value={productFormData.name} onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Emoji / Icône"}</label>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 flex items-center justify-center bg-[#0a0f1c] rounded-lg border border-[#1e2d4a]">
                    {renderProductIcon(productFormData.emoji, "text-2xl", "w-7 h-7")}
                  </div>
                  <button onClick={() => setEmojiPickerOpen(!emojiPickerOpen)} className={btnSecondary + " !text-xs"}>
                    {emojiPickerOpen ? "Fermer" : "Choisir"}
                  </button>
                </div>
                {emojiPickerOpen && (
                  <div className="mt-2 bg-[#0a0f1c] rounded-lg border border-[#1e2d4a] p-3">
                    <div className="flex gap-1 mb-2 flex-wrap">
                      {EMOJI_CATEGORIES.map((cat, i) => (
                        <button
                          key={i}
                          onClick={() => setEmojiCatIdx(i)}
                          className={"px-2 py-1 rounded text-sm cursor-pointer " + (emojiCatIdx === i ? "bg-amber-500/20 text-amber-400" : "hover:bg-[#1a2340]")}
                          title={cat.title}
                        >{cat.label}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {EMOJI_CATEGORIES[emojiCatIdx].emojis.map((e, i) => (
                        <button
                          key={i}
                          onClick={() => { setProductFormData({ ...productFormData, emoji: e }); setEmojiPickerOpen(false); }}
                          className="text-xl p-1.5 hover:bg-[#1a2340] rounded cursor-pointer transition-colors text-center"
                        >{e}</button>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-[#1e2d4a]">
                      <label className="block text-[10px] text-gray-500 mb-1">{"URL personnalisée"}</label>
                      <input
                        type="text"
                        placeholder="/image.png ou https://..."
                        value={productFormData.emoji.startsWith("/") || productFormData.emoji.startsWith("http") ? productFormData.emoji : ""}
                        onChange={(e) => setProductFormData({ ...productFormData, emoji: e.target.value })}
                        className={inputClass + " !text-xs"}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Prix (€)"}</label>
                <input type="number" step="0.01" value={productFormData.price} onChange={(e) => setProductFormData({ ...productFormData, price: parseFloat(e.target.value) || 0 })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Coût (€)"}</label>
                <input type="number" step="0.01" value={productFormData.cost} onChange={(e) => setProductFormData({ ...productFormData, cost: parseFloat(e.target.value) || 0 })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Stock"}</label>
                <input type="number" value={productFormData.stock} onChange={(e) => setProductFormData({ ...productFormData, stock: parseInt(e.target.value) || 0 })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Catégorie"}</label>
                <select value={productFormData.category} onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value })} className={selectClass}>
                  <option value="">{"-- Aucune --"}</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.emoji + " " + c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Emplacement"}</label>
                <select value={productFormData.location} onChange={(e) => setProductFormData({ ...productFormData, location: e.target.value })} className={selectClass}>
                  <option value="">{"-- Aucun --"}</option>
                  <option value="frigo">{"Frigo"}</option>
                  <option value="cafe">{"Café"}</option>
                  <option value="congelateur">{"Congélateur"}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Portions"}</label>
                <input type="number" value={productFormData.servings} onChange={(e) => setProductFormData({ ...productFormData, servings: parseInt(e.target.value) || 1 })} className={inputClass} />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#1e2d4a]">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">{"Configuration LED"}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{"LED début"}</label>
                  <input type="number" value={productFormData.ledStart} onChange={(e) => setProductFormData({ ...productFormData, ledStart: parseInt(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{"LED fin"}</label>
                  <input type="number" value={productFormData.ledEnd} onChange={(e) => setProductFormData({ ...productFormData, ledEnd: parseInt(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{"Couleur LED"}</label>
                  <input type="color" value={productFormData.ledColor} onChange={(e) => setProductFormData({ ...productFormData, ledColor: e.target.value })} className="w-full h-9 rounded-lg cursor-pointer border border-[#1e2d4a] bg-[#1a2340]" />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#1e2d4a]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productFormData.coffeeAddon}
                  onChange={(e) => setProductFormData({ ...productFormData, coffeeAddon: e.target.checked })}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-sm font-medium">{"Addon café"}</span>
              </label>
              {productFormData.coffeeAddon && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"Quantité addon"}</label>
                    <input type="number" value={productFormData.coffeeAddonQty} onChange={(e) => setProductFormData({ ...productFormData, coffeeAddonQty: parseInt(e.target.value) || 0 })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{"Prix addon (€)"}</label>
                    <input type="number" step="0.01" value={productFormData.coffeeAddonPrice} onChange={(e) => setProductFormData({ ...productFormData, coffeeAddonPrice: parseFloat(e.target.value) || 0 })} className={inputClass} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#1e2d4a]">
              <button onClick={() => setProductFormOpen(false)} className={btnSecondary}>{"Annuler"}</button>
              <button onClick={saveProductForm} className={btnPrimary}>{"Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}

      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setRestockProduct(null)}>
          <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{"Restock : " + restockProduct.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Quantité"}</label>
                <input type="number" value={restockQty} onChange={(e) => setRestockQty(parseInt(e.target.value) || 0)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Coût unitaire (€)"}</label>
                <input type="number" step="0.01" value={restockUnitCost} onChange={(e) => setRestockUnitCost(parseFloat(e.target.value) || 0)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Mode de paiement"}</label>
                <select value={restockMethod} onChange={(e) => setRestockMethod(e.target.value as "especes" | "carte")} className={selectClass}>
                  <option value="carte">{"Carte"}</option>
                  <option value="especes">{"Espèces"}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"DLC (optionnel)"}</label>
                <input type="date" value={restockDlc} onChange={(e) => setRestockDlc(e.target.value)} className={inputClass} />
              </div>
              <div className="bg-[#0a0f1c] rounded-lg p-3 border border-[#1e2d4a]">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{"Total"}</span>
                  <span className="font-bold text-amber-500">{formatPrice(restockQty * restockUnitCost)}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setRestockProduct(null)} className={btnSecondary}>{"Annuler"}</button>
              <button onClick={submitRestock} className={btnPrimary}>{"Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}

      {memberFormMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setMemberFormMode(null)}>
          <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{memberFormMode === "add" ? "Ajouter un membre" : "Modifier le membre"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Nom"}</label>
                <input type="text" value={memberFormName} onChange={(e) => setMemberFormName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Solde (€)"}</label>
                <input type="number" step="0.01" value={memberFormBalance} onChange={(e) => setMemberFormBalance(parseFloat(e.target.value) || 0)} className={inputClass} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setMemberFormMode(null)} className={btnSecondary}>{"Annuler"}</button>
              <button onClick={saveMemberForm} className={btnPrimary}>{"Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}

      {creditEditMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setCreditEditMember(null)}>
          <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{"Avoirs produits de " + creditEditMember}</h3>
            <div className="space-y-2">
              {products.filter(p => !p.archived).map(p => {
                const credit = getMemberProductCredit(p.id, creditEditMember);
                return (
                  <div key={p.id} className="flex items-center gap-4 bg-[#0a0f1c] rounded-lg border border-[#1e2d4a] px-4 py-3">
                    <div className="w-8">{renderProductIcon(p.emoji, "text-xl", "w-6 h-6")}</div>
                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { if (credit > 0) addProductCredit(p.id, creditEditMember, -1); }}
                        className={"w-8 h-8 rounded bg-[#1a2340] border border-[#1e2d4a] flex items-center justify-center text-sm cursor-pointer transition-colors " + (credit > 0 ? "text-red-400 hover:bg-red-500/20" : "text-gray-600")}
                      >{"-"}</button>
                      <span className={"w-8 text-center font-bold " + (credit > 0 ? "text-amber-500" : "text-gray-600")}>{String(credit)}</span>
                      <button
                        onClick={() => addProductCredit(p.id, creditEditMember, 1)}
                        className="w-8 h-8 rounded bg-[#1a2340] border border-[#1e2d4a] text-emerald-400 flex items-center justify-center text-sm cursor-pointer hover:bg-emerald-500/20 transition-colors"
                      >{"+"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setCreditEditMember(null)} className={btnPrimary}>{"Fermer"}</button>
            </div>
          </div>
        </div>
      )}

      {showCategoryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCategoryForm(false)}>
          <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editingCategoryId ? "Modifier la catégorie" : "Ajouter une catégorie"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Identifiant"}</label>
                <input type="text" value={categoryFormData.id} onChange={(e) => setCategoryFormData({ ...categoryFormData, id: e.target.value })} className={inputClass} disabled={!!editingCategoryId} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Label"}</label>
                <input type="text" value={categoryFormData.label} onChange={(e) => setCategoryFormData({ ...categoryFormData, label: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{"Emoji"}</label>
                <input type="text" value={categoryFormData.emoji} onChange={(e) => setCategoryFormData({ ...categoryFormData, emoji: e.target.value })} className={inputClass} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={categoryFormData.hasCupCost}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, hasCupCost: e.target.checked })}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-sm">{"Inclure coût gobelet"}</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCategoryForm(false)} className={btnSecondary}>{"Annuler"}</button>
              <button onClick={addCategory} className={btnPrimary}>{"Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
          <div className="bg-[#131b2e] border border-[#1e2d4a] rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-gray-400 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className={btnSecondary}>{"Annuler"}</button>
              <button onClick={confirmDialog.onConfirm} className={btnDanger + " !px-4 !py-2 font-semibold"}>{"Supprimer"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={"fixed bottom-6 right-6 z-[70] px-5 py-3 rounded-xl text-sm font-medium shadow-2xl transition-all " + (toast.type === "error" ? "bg-red-500/90 text-white" : "bg-emerald-500/90 text-white")}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
