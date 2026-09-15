import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white flex items-center justify-center">
      <div className="text-center max-w-lg px-6">
        <h1 className="text-4xl font-bold mb-3">BarManager</h1>
        <p className="text-slate-400 mb-8">Plateforme de gestion de bars en libre-service</p>
        <div className="flex flex-col gap-3">
          <Link href="/admin"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold transition block">
            Espace administration
          </Link>
          <Link href="/client/acba"
            className="px-6 py-3 bg-[#131b2e] border border-[#1e2d4a] hover:border-amber-500/50 rounded-xl text-sm font-bold transition block">
            {"Voir le bar ACBA (démo)"}
          </Link>
          <Link href="/test"
            className="px-6 py-3 bg-[#0f172a] border border-[#1e2d4a] rounded-xl text-xs text-slate-500 hover:text-white transition block">
            {"Interface legacy (ancien /test)"}
          </Link>
        </div>
      </div>
    </div>
  );
}
