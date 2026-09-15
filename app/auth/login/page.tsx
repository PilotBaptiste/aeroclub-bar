"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    router.push("/admin");
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-white flex items-center justify-center">
      <form onSubmit={handleLogin} className="w-full max-w-sm px-6">
        <h1 className="text-2xl font-bold text-center mb-1">BarManager</h1>
        <p className="text-sm text-slate-500 text-center mb-8">Connectez-vous pour accéder à l'administration</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="admin@example.com"
              className="w-full h-11 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full h-11 bg-[#131b2e] border border-[#1e2d4a] rounded-lg px-3 text-sm outline-none focus:border-blue-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-bold cursor-pointer transition">
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </div>
      </form>
    </div>
  );
}
