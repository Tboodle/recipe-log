import { Link, useLocation } from "react-router-dom";
import { BookOpen, ShoppingCart, Settings } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", icon: BookOpen, label: "Recipes", match: (p: string) => p === "/" || p.startsWith("/recipes") },
  { to: "/shopping", icon: ShoppingCart, label: "Shopping", match: (p: string) => p.startsWith("/shopping") },
  { to: "/settings", icon: Settings, label: "Settings", match: (p: string) => p.startsWith("/settings") },
];

export default function Nav() {
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);

  return (
    <nav className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
      <Link to="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">
        recipe<span className="text-amber-400">log</span>
      </Link>
      <div className="flex items-center gap-2">
        {links.map(({ to, icon: Icon, label, match }) => (
          <Link key={to} to={to}>
            <Button
              variant={match(location.pathname) ? "default" : "ghost"}
              size="sm"
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          </Link>
        ))}
        <Button variant="ghost" size="sm" onClick={logout}>
          Sign out
        </Button>
      </div>
    </nav>
  );
}
