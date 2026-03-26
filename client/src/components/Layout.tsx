import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import {
  Home,
  Building2,
  Users,
  FileText,
  DollarSign,
  Briefcase,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Mail,
  ShoppingBag,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DarkModeToggle from "@/components/DarkModeToggle";
import FinanceAlertBanner from "@/components/FinanceAlertBanner";
import NotificationBell from "@/components/NotificationBell";

export default function Layout() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navItems = [
    { path: "/", label: "Inicio", icon: Home },
    { path: "/cuentas", label: "Cuentas", icon: Building2 },
    { path: "/contactos", label: "Contactos", icon: Users },
    { path: "/marketing", label: "Marketing", icon: Mail },
    { path: "/cotizaciones", label: "Cotizaciones", icon: FileText },
    { path: "/oportunidades", label: "Oportunidades", icon: Briefcase },
    { path: "/ventas", label: "Ventas", icon: DollarSign },
    { path: "/compras", label: "Compras", icon: ShoppingBag },
    { path: "/conciliacion", label: "Conciliación", icon: ArrowRightLeft },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen sticky top-0 transition-all duration-300 flex flex-col z-40",
          isCollapsed ? "w-16" : "w-64",
        )}
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
      >
        {/* Header Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png"
              alt="Ecomoving Logo"
              className={cn(
                "h-8 transition-all duration-300 object-contain",
                isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              )}
            />
            {isCollapsed && (
              <img
                src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo.png"
                alt="Ecomoving Logo Icon"
                className="h-8 w-8 object-contain animate-in fade-in zoom-in duration-300"
              />
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group relative",
                isActive(item.path)
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100",
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive(item.path)
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300",
                )}
              />
              {!isCollapsed && <span>{item.label}</span>}
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
          {/* Notification Bell */}
          <NotificationBell isCollapsed={isCollapsed} />
          {/* Dark Mode Toggle */}
          <div
            className={cn(
              "flex items-center",
              isCollapsed ? "justify-center" : "justify-start px-3",
            )}
          >
            <DarkModeToggle />
            {!isCollapsed && (
              <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">
                Tema
              </span>
            )}
          </div>

          {/* Cerrar Sesión */}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 gap-3",
              isCollapsed && "justify-center px-0",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <FinanceAlertBanner />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
