"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Organization, Product, Category } from "@/lib/types";

export default function ClientBarPage() {
  const { slug } = useParams<{ slug: string }>();
  const supabase = createClient();
  const [org, setOrg] = useState<Organization | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: orgData } = await supabase.from("organizations").select("*").eq("slug", slug).single();
      if (!orgData) { setLoading(false); return; }
      setOrg(orgData);
      const [prods, cats] = await Promise.all([
        supabase.from("products").select("*").eq("org_id", orgData.id).eq("archived", false).order("position"),
        supabase.from("categories").select("*").eq("org_id", orgData.id).order("position"),
      ]);
      setProducts(prods.data || []);
      setCategories(cats.data || []);
      setLoading(false);
    })();
  }, [slug]);

  function addToCart(product: Product) {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) return prev.map(c => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { product, qty: 1 }];
    });
  }

  function removeFromCart(productId: string) {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === productId);
      if (!existing) return prev;
      if (existing.qty <= 1) return prev.filter(c => c.product.id !== productId);
      return prev.map(c => c.product.id === productId ? { ...c, qty: c.qty - 1 } : c);
    });
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.product.price * c.qty, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory)
    : products;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0B1120] text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0B1120] text-white">
        <div className="text-center">
          <p className="text-4xl mb-4">🍺</p>
          <h1 className="text-xl font-bold mb-2">Bar introuvable</h1>
          <p className="text-sm text-slate-500">{"Le bar \"" + slug + "\" n'existe pas."}</p>
        </div>
      </div>
    );
  }

  const settings = org.settings as Record<string, string> | null;
  const barName = settings?.barName || org.name;

  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B1120]/95 backdrop-blur border-b border-[#1e2d4a] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {org.logo_url ? (
              <img src={org.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-sm font-bold text-amber-400">
                {barName.charAt(0)}
              </div>
            )}
            <span className="font-bold text-sm">{barName}</span>
          </div>
          {cartCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5">
              <span className="text-sm">🛒</span>
              <span className="text-sm font-bold text-amber-400">{cartCount + " · " + cartTotal.toFixed(2) + " €"}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Categories filter */}
        {categories.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            <button onClick={() => setSelectedCategory(null)}
              className={"px-4 py-2 rounded-full text-sm font-semibold cursor-pointer transition whitespace-nowrap " + (!selectedCategory ? "bg-amber-500 text-black" : "bg-[#131b2e] text-slate-400 hover:text-white")}>
              Tous
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                className={"px-4 py-2 rounded-full text-sm font-semibold cursor-pointer transition whitespace-nowrap " + (selectedCategory === cat.id ? "bg-amber-500 text-black" : "bg-[#131b2e] text-slate-400 hover:text-white")}>
                {cat.emoji + " " + cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Products grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map(product => {
            const inCart = cart.find(c => c.product.id === product.id);
            const outOfStock = product.stock <= 0;
            return (
              <button key={product.id} onClick={() => addToCart(product)} disabled={outOfStock}
                className={"relative rounded-xl border p-4 text-center cursor-pointer transition-all "
                  + (outOfStock ? "opacity-40 border-[#1e2d4a] bg-[#0f172a] cursor-not-allowed " : "border-[#1e2d4a] bg-[#131b2e] active:scale-95 hover:border-amber-500/50 ")
                  + (inCart ? "ring-2 ring-amber-500/50 " : "")
                }>
                {inCart && (
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">
                    {inCart.qty}
                  </span>
                )}
                {outOfStock && (
                  <span className="absolute top-2 left-2 bg-red-500/80 text-[10px] font-bold px-1.5 py-0.5 rounded">Épuisé</span>
                )}
                <div className="text-3xl mb-2">
                  {product.emoji.startsWith("http") ? (
                    <img src={product.emoji} alt="" className="w-12 h-12 mx-auto object-contain" />
                  ) : (
                    product.emoji
                  )}
                </div>
                <p className="text-sm font-bold truncate">{product.name}</p>
                <p className="text-amber-500 font-bold mt-1">{product.price.toFixed(2) + " €"}</p>
                {!outOfStock && product.stock <= 5 && (
                  <p className="text-[10px] text-orange-400 mt-1">{"Plus que " + product.stock}</p>
                )}
              </button>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-slate-500">Aucun produit disponible</div>
        )}
      </main>

      {/* Cart panel */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-[#1e2d4a] p-4 z-50">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-3 overflow-x-auto">
              {cart.map(c => (
                <div key={c.product.id} className="flex items-center gap-2 bg-[#131b2e] rounded-lg px-3 py-2 shrink-0">
                  <span className="text-sm">{c.product.emoji.startsWith("http") ? "📦" : c.product.emoji}</span>
                  <span className="text-xs font-medium">{c.product.name}</span>
                  <span className="text-xs text-amber-400 font-bold">{"×" + c.qty}</span>
                  <button onClick={() => removeFromCart(c.product.id)}
                    className="text-red-400 text-xs ml-1 cursor-pointer">✕</button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xl font-bold text-amber-400">{cartTotal.toFixed(2) + " €"}</span>
                <span className="text-xs text-slate-500 ml-2">{cartCount + " article" + (cartCount > 1 ? "s" : "")}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCart([])}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold cursor-pointer transition">
                  Vider
                </button>
                <button className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-bold cursor-pointer transition">
                  Payer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
