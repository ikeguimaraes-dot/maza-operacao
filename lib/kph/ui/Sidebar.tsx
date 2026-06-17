"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  // shell
  ChevronDown, ChevronRight, Check, LogOut,
  // dashboard
  LayoutDashboard,
  // operacao
  TrendingUp, MapPin, Activity, UserCheck, ClipboardList, BookOpen,
  // compras
  ShoppingCart, Package, Truck, Building2, FileText, PackageCheck, PieChart, Star, Carrot,
  // financeiro
  Wallet, Gauge, ArrowLeftRight, Sheet, CreditCard, Banknote, CheckSquare, RefreshCw, PiggyBank,
  // pessoas
  Users, User, Briefcase, CalendarDays, Clock, Plane, CalendarX2, Timer,
  ShieldAlert, Receipt, DollarSign, Bus, GraduationCap, ClipboardCheck,
  FolderOpen, Upload, FileBarChart2, MessageCircle, Repeat2, LayoutGrid, ListChecks, CalendarClock, Network, UserPlus, BarChart2,
  // comercial
  Handshake, MessageSquare, CalendarCheck, Bot, Megaphone, Filter,
  // marca
  Bookmark, Info, Globe, Award,
  // inteligencia
  Brain, Target, LineChart, Layers, Bug, Map, BarChart3, Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth, useUnit, useHasRole, useRoles } from "@kph/auth/context";

// ── Types ───────────────────────────────────────────────
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
  children?: NavItem[];
};
type NavGroup = {
  id: string;
  title: string | null;
  icon: LucideIcon | null;
  items: NavItem[];
  defaultOpen: boolean;
  roles?: string[];
};

// ── Nav data ────────────────────────────────────────────
const NAV_GROUPS: NavGroup[] = [
  {
    id: "home",
    title: null,
    icon: null,
    defaultOpen: true,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    id: "operacao",
    title: "Operação",
    icon: TrendingUp,
    defaultOpen: false,
    items: [
      { href: "/operacao/mapa",          label: "Mapa da Casa",  icon: MapPin },
      { href: "/operacao/performance",   label: "Performance",   icon: Activity },
      { href: "/operacao/vendedores",    label: "Vendedores",    icon: UserCheck },
      { href: "/operacao/auditorias",    label: "Auditorias",    icon: ClipboardList },
      { href: "/operacao/pedidos",       label: "Pedidos",       icon: ShoppingCart, roles: ["operacao", "founder", "administrativo"] },
      { href: "/operacao/eventos",       label: "Eventos",       icon: CalendarDays },
      { href: "/operacao/pessoas/formulario-recrutamento", label: "Formulário de Recrutamento", icon: ClipboardList, roles: ["pessoas", "gm", "founder"] },
    ],
  },
  {
    id: "compras",
    title: "Compras",
    icon: ShoppingCart,
    defaultOpen: false,
    items: [
      { href: "/cardapio",               label: "Cardápio",          icon: BookOpen },
      { href: "/compras/ingredientes",   label: "Ingredientes",      icon: Carrot },
      { href: "/compras",                label: "Pedidos",           icon: ShoppingCart },
      { href: "/compras/estoque",        label: "Estoque",           icon: Package },
      { href: "/compras/logistica",      label: "Logística",         icon: Truck },
      { href: "/compras/fornecedores",   label: "Fornecedores",      icon: Building2 },
      { href: "/compras/cotacoes",       label: "Cotações",          icon: FileText },
      { href: "/compras/recebimento",    label: "Recebimento",       icon: PackageCheck },
      { href: "/compras/analise",        label: "Análise CMV",       icon: PieChart },
      { href: "/compras/feedback",       label: "Feedback Produto",  icon: Star },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    icon: Wallet,
    defaultOpen: false,
    items: [
      { href: "/financeiro",              label: "Cockpit",               icon: Gauge },
      { href: "/financeiro/fluxo",        label: "Fluxo de Caixa",       icon: ArrowLeftRight },
      { href: "/financeiro/dre",          label: "DRE",                   icon: Sheet },
      { href: "/financeiro/produtos",     label: "Relatório de Produtos", icon: Package },
      { href: "/financeiro/pagar",        label: "Contas a Pagar",       icon: CreditCard },
      { href: "/financeiro/receber",      label: "Contas a Receber",     icon: Banknote },
      { href: "/financeiro/aprovacoes",   label: "Aprovações",            icon: CheckSquare },
      { href: "/financeiro/conciliacao",  label: "Conciliação",           icon: RefreshCw },
      { href: "/financeiro/orcamento",    label: "Orçamento",             icon: PiggyBank },
    ],
  },
  {
    id: "pessoas",
    title: "Pessoas",
    icon: Users,
    defaultOpen: true,
    items: [
      { href: "/pessoas/headcount",         label: "Headcount",          icon: BarChart3 },
      { href: "/pessoas/colaboradores",     label: "Colaboradores",      icon: User },
      { href: "/recrutamento/vagas",        label: "Recrutamento",       icon: Briefcase },
      { href: "/pessoas/escala",            label: "Escala",             icon: CalendarDays },
      { href: "/pessoas/ponto",             label: "Ponto",              icon: Clock },
      { href: "/pessoas/ferias",            label: "Férias",             icon: Plane },
      { href: "/pessoas/faltas",            label: "Faltas",             icon: CalendarX2 },
      { href: "/pessoas/horas-extras",      label: "Horas Extras",       icon: Timer },
      { href: "/pessoas/disciplina",        label: "Disciplina & Score", icon: ShieldAlert },
      { href: "/pessoas/holerites",         label: "Holerites",          icon: Receipt },
      { href: "/pessoas/gorjetas",          label: "Gorjetas",           icon: DollarSign },
      { href: "/pessoas/vale-transporte",   label: "Vale Transporte",    icon: Bus },
      { href: "/pessoas/treinamentos",      label: "Treinamentos",       icon: GraduationCap },
      { href: "/pessoas/avaliacoes",        label: "Avaliações",         icon: ClipboardCheck },
      { href: "/pessoas/avaliacoes/ciclos", label: "Ciclos 360°",        icon: Repeat2 },
      { href: "/pessoas/avaliacoes/9box",   label: "Matriz 9Box",        icon: LayoutGrid },
      { href: "/pessoas/pdi",               label: "PDI",                icon: ListChecks },
      { href: "/pessoas/analytics",         label: "Analytics",          icon: BarChart2 },
      { href: "/pessoas/reunioes",          label: "Reuniões 1:1",       icon: CalendarClock },
      { href: "/pessoas/organograma",       label: "Organograma",        icon: Network },
      { href: "/pessoas/onboarding",        label: "Onboarding",         icon: UserPlus },
      { href: "/pessoas/feedback",          label: "Feedback",           icon: MessageCircle },
      { href: "/pessoas/documentos",        label: "Documentos",         icon: FolderOpen },
      { href: "/pessoas/importacao",        label: "Importar Dados",     icon: Upload },
      { href: "/pessoas/relatorio-ponto",   label: "Relatório de Ponto", icon: FileBarChart2 },
    ],
  },
  {
    id: "comercial",
    title: "Comercial",
    icon: Handshake,
    defaultOpen: false,
    items: [
      { href: "/cliente",             label: "CRM Clientes", icon: MessageSquare },
      { href: "/comercial/reservas",  label: "Reservas",     icon: CalendarCheck },
      { href: "/eventos",             label: "Eventos / OS", icon: CalendarDays },
      { href: "/comercial/serena",    label: "Serena",       icon: Bot },
      { href: "/campanhas",           label: "Campanhas",    icon: Megaphone },
      { href: "/comercial/funil",     label: "Funil",        icon: Filter },
    ],
  },
  {
    id: "marca",
    title: "Marca",
    icon: Bookmark,
    defaultOpen: false,
    items: [
      { href: "/marcas",           label: "Diretório",     icon: Building2 },
      { href: "/marca/brandbook",  label: "BrandBook",     icon: BookOpen },
      { href: "/marca/quem-somos", label: "Quem Somos",    icon: Info },
      { href: "/marca/canais",     label: "Site & Canais", icon: Globe },
      { href: "/marca/reputacao",  label: "Reputação",     icon: Award },
    ],
  },
  {
    id: "inteligencia",
    title: "Inteligência",
    icon: Brain,
    defaultOpen: false,
    items: [
      { href: "/inteligencia/metas",    label: "Metas",           icon: Target },
      { href: "/inteligencia/wbr",      label: "WBR",             icon: LineChart },
      { href: "/inteligencia/cross",    label: "Cross-módulo",    icon: Layers },
      { href: "/inteligencia/adocao",   label: "Adoção",          icon: Activity },
      { href: "/inteligencia/feedback", label: "Bugs & Feedback", icon: Bug },
      { href: "/inteligencia/roadmap",  label: "Roadmap",         icon: Map },
      { href: "/orquestrador",          label: "Orquestrador",    icon: Workflow },
    ],
  },
];

// Flatten all hrefs (including children) for active-state computation
function flatItems(items: NavItem[], groupId: string): { href: string; groupId: string }[] {
  return items.flatMap((it) => [
    { href: it.href, groupId },
    ...(it.children ? flatItems(it.children, groupId) : []),
  ]);
}
const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => flatItems(g.items, g.id));

const STORAGE_KEY = "kph_sidebar_groups";
const MEET_AND_EAT = "674eac8c-5a38-4a42-aa60-0a666387909b";

// ── Root Sidebar shell ──────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { unit, units, setUnit } = useUnit();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const onToggle = () => setMobileOpen((v) => !v);
    window.addEventListener("kph:toggleSidebar", onToggle);
    return () => window.removeEventListener("kph:toggleSidebar", onToggle);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "?";
  const emailShort = user?.email
    ? user.email.length > 22 ? user.email.slice(0, 19) + "…" : user.email
    : "—";
  const role = user?.roles[0]?.role ?? "—";

  return (
    <>
      <div className={`shell-backdrop ${mobileOpen ? "open" : ""}`} onClick={() => setMobileOpen(false)} />
      <aside
        className={`shell-sidebar ${mobileOpen ? "open" : ""}`}
        style={{ width: 240, flexShrink: 0, background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-border)", display: "flex", flexDirection: "column" }}
      >
        {/* Logo */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--sidebar-border)" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: -0.5 }}>
            KPH <span style={{ color: "var(--brand)" }}>OS</span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 600 }}>
            Operations
          </div>
        </div>

        {/* Unit switcher */}
        <div style={{ padding: "12px 16px" }}>
          <div ref={ref} style={{ position: "relative" }}>
            <button
              onClick={() => setOpen((v) => !v)}
              disabled={units.length === 0}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: units.length ? "pointer" : "default", transition: "border-color var(--t)" }}
            >
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 700, letterSpacing: 0.8 }}>UNIDADE</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                  {unit?.name ?? (units.length ? "Selecionar…" : "Sem acesso")}
                </span>
              </span>
              <ChevronDown size={14} style={{ color: "var(--text-3)", transform: open ? "rotate(180deg)" : "none", transition: "transform var(--t)" }} />
            </button>
            {open && units.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50, background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: 4, boxShadow: "var(--shadow-lg)" }}>
                {units.map((u) => {
                  const active = u.id === unit?.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => { setUnit(u.id); setOpen(false); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 10px", background: active ? "var(--surface-3)" : "transparent", border: "none", borderRadius: 6, color: "var(--text)", fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left", transition: "background var(--t)" }}
                    >
                      <span>{u.name}</span>
                      {active && <Check size={14} style={{ color: "var(--brand)" }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <SidebarNav pathname={pathname} activeUnitId={unit?.id ?? null} />

        {/* User footer */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--sidebar-border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <div style={{ width: 32, height: 32, borderRadius: 99, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>
              {initials}
            </div>
            <span style={{ position: "absolute", right: -1, bottom: -1, width: 10, height: 10, borderRadius: 99, background: "#22C55E", border: "2px solid var(--sidebar)" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emailShort}</div>
            <div style={{ fontSize: 10, color: "var(--text-3)" }}>{role}</div>
          </div>
          <Link href="/auth/sign-out" title="Sair" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, color: "var(--text-3)", textDecoration: "none", transition: "color var(--t), background var(--t)" }}>
            <LogOut size={14} />
          </Link>
        </div>
      </aside>
    </>
  );
}

// ── SidebarNav ──────────────────────────────────────────
function SidebarNav({ pathname, activeUnitId }: { pathname: string; activeUnitId: string | null }) {
  const activeHref = useMemo(() => {
    let best: string | null = null;
    let bestLen = -1;
    for (const it of ALL_NAV_ITEMS) {
      const matches = pathname === it.href || pathname.startsWith(it.href + "/");
      if (matches && it.href.length > bestLen) { best = it.href; bestLen = it.href.length; }
    }
    return best;
  }, [pathname]);

  const activeGroupId = useMemo(() => {
    if (!activeHref) return null;
    return ALL_NAV_ITEMS.find((it) => it.href === activeHref)?.groupId ?? null;
  }, [activeHref]);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) m[g.id] = g.defaultOpen;
    return m;
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setOpenMap((prev) => ({ ...prev, ...(JSON.parse(raw) as Record<string, boolean>) }));
    } catch { /* ignore corruption */ }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenMap((prev) => (prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true }));
  }, [activeGroupId]);

  function toggleGroup(id: string) {
    setOpenMap((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <nav style={{ flex: 1, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto" }}>
      {NAV_GROUPS.map((g) => (
        <NavGroupSection
          key={g.id}
          group={g}
          activeHref={activeHref}
          activeUnitId={activeUnitId}
          isOpen={openMap[g.id] ?? g.defaultOpen}
          hydrated={hydrated}
          onToggle={() => toggleGroup(g.id)}
        />
      ))}
    </nav>
  );
}

// ── NavGroupSection ─────────────────────────────────────
function NavGroupSection({
  group: g, activeHref, activeUnitId, isOpen, hydrated, onToggle,
}: {
  group: NavGroup; activeHref: string | null; activeUnitId: string | null;
  isOpen: boolean; hydrated: boolean; onToggle: () => void;
}) {
  const hasRole = useHasRole(g.roles ?? []);
  const userRoles = useRoles().map((r): string => r.role);
  if (g.roles && !hasRole) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {g.title && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", padding: "10px 8px 4px", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--text-3)", cursor: "pointer", textAlign: "left" }}
        >
          {g.icon && <g.icon size={11} style={{ color: "var(--text-3)" }} />}
          <span style={{ flex: 1 }}>{g.title}</span>
          <ChevronRight size={12} style={{ color: "var(--text-3)", transform: isOpen ? "rotate(90deg)" : "none", transition: hydrated ? "transform var(--t)" : "none" }} />
        </button>
      )}
      {isOpen && g.items.map((it) => (
        <NavItemRenderer
          key={it.href}
          item={it}
          activeHref={activeHref}
          activeUnitId={activeUnitId}
          userRoles={userRoles}
          depth={0}
        />
      ))}
    </div>
  );
}

// ── NavItemRenderer: leaf link or collapsible submenu ───
function NavItemRenderer({
  item, activeHref, activeUnitId, userRoles, depth,
}: {
  item: NavItem; activeHref: string | null; activeUnitId: string | null;
  userRoles: string[]; depth: number;
}) {
  const hasChildren = !!item.children?.length;

  const isChildActive = useMemo(() => {
    if (!hasChildren) return false;
    return item.children!.some(
      (c) => activeHref === c.href || (activeHref?.startsWith(c.href + "/") ?? false),
    );
  }, [hasChildren, item.children, activeHref]);

  const [subOpen, setSubOpen] = useState(false);

  useEffect(() => {
    if (isChildActive) setSubOpen(true);
  }, [isChildActive]);

  if (item.href === "/operacao/eventos" && activeUnitId !== MEET_AND_EAT) return null;
  if (item.roles && !item.roles.some((r) => userRoles.includes(r))) return null;

  const Icon = item.icon;
  const active = !hasChildren && item.href === activeHref;
  const pl = 12 + depth * 12;

  if (hasChildren) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <button
          type="button"
          onClick={() => setSubOpen((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: `9px 12px 9px ${pl}px`, borderRadius: 8, background: "transparent", border: "none", color: isChildActive ? "var(--text)" : "var(--text-2)", fontSize: 13, fontWeight: isChildActive ? 600 : 500, cursor: "pointer", textAlign: "left", transition: "all var(--t)" }}
        >
          <Icon size={16} strokeWidth={1.8} style={{ color: "currentColor", flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{item.label}</span>
          <ChevronRight size={11} style={{ color: "var(--text-3)", transform: subOpen ? "rotate(90deg)" : "none", transition: "transform var(--t)" }} />
        </button>
        {subOpen && item.children!.map((child) => (
          <NavItemRenderer
            key={child.href}
            item={child}
            activeHref={activeHref}
            activeUnitId={activeUnitId}
            userRoles={userRoles}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: `9px 12px 9px ${pl}px`, borderRadius: 8, textDecoration: "none", color: active ? "var(--text)" : "var(--text-2)", background: active ? "var(--surface-2)" : "transparent", fontSize: 13, fontWeight: active ? 600 : 500, transition: "all var(--t)" }}
    >
      {active && (
        <span style={{ position: "absolute", left: -12, top: 6, bottom: 6, width: 3, background: "var(--brand)", borderRadius: "0 4px 4px 0" }} />
      )}
      <Icon size={16} strokeWidth={active ? 2.2 : 1.8} style={{ color: active ? "var(--brand)" : "currentColor", flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{item.label}</span>
    </Link>
  );
}
