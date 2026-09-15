"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/clients", label: "Clients", icon: "🏪" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#0B1120] text-white overflow-hidden">
      <aside className={"flex flex-col border-r border-[#1e2d4a] bg-[#0f172a] shrink-0 transition-all " + (collapsed ? "w-16" : "w-56")}>
        <div className="flex items-center gap-2 px-4 h-14 border-b border-[#1e2d4a]">
          {!collapsed && <span className="font-bold text-sm tracking-wide">BarManager</span>}
          <button onClick={() => setCollapsed(!collapsed)} className="ml-auto text-slate-500 hover:text-white cursor-pointer text-sm">
            {collapsed ? "→" : "←"}
          </button>
        </div>
        <nav className="flex-1 py-3 space-y-1 px-2">
          {NAV.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={"flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition " + (active ? "bg-blue-600/20 text-blue-400" : "text-slate-400 hover:text-white hover:bg-[#131b2e]")}>
                <span className="text-base">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-[#1e2d4a]">
          <Link href="/auth/login"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-white transition">
            <span>🔒</span>
            {!collapsed && <span>Déconnexion</span>}
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
