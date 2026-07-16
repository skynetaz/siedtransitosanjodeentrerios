import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function AppShell({ title, subtitle, nav, children }: { title: string; subtitle?: string; nav?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="gov-header">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-accent" />
            <div className="leading-tight">
              <div className="font-serif font-bold text-base">SIED</div>
              <div className="text-[10px] uppercase tracking-widest opacity-80">Tránsito y Transporte</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {nav}
            <Button variant="secondary" size="sm" onClick={signOut}><LogOut className="mr-1 h-4 w-4" />Salir</Button>
          </div>
        </div>
      </header>
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-4">
          <h1 className="font-serif text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 md:px-6 py-6">{children}</main>
    </div>
  );
}
