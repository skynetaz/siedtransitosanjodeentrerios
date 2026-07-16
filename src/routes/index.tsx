import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ShieldCheck, FileCheck2, Users, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="gov-header">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-accent" />
            <div>
              <div className="font-serif text-lg font-bold tracking-tight">SIED</div>
              <div className="text-xs opacity-80">Dirección de Tránsito y Transporte</div>
            </div>
          </div>
          <Link to="/auth">
            <Button variant="secondary" size="sm">Iniciar sesión</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-institutional/70">
              Plataforma oficial
            </p>
            <h1 className="mt-3 font-serif text-4xl md:text-5xl font-black text-foreground leading-tight">
              Sistema Integral de Evaluación para Licencias de Conducir
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              Gestión de aspirantes, banco de preguntas oficial, corrección automática,
              control de exámenes por parte del inspector e historial completo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth"><Button size="lg">Ingresar al sistema</Button></Link>
            </div>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            <FeatureCard icon={<ClipboardList className="h-6 w-6" />} title="Banco de preguntas oficial" desc="Basado en la Ley Nacional de Tránsito 24.449." />
            <FeatureCard icon={<FileCheck2 className="h-6 w-6" />} title="Corrección automática" desc="Preguntas eliminatorias que desaprueban el examen al instante." />
            <FeatureCard icon={<Users className="h-6 w-6" />} title="Control por inspector" desc="El aspirante rinde solo cuando el inspector lo habilita presencialmente." />
          </div>
        </section>
      </main>

      <footer className="border-t bg-muted/50">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground flex flex-wrap justify-between gap-2">
          <span>SIED · Dirección de Tránsito y Transporte</span>
          <span>Ley Nacional de Tránsito Nº 24.449</span>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-institutional text-institutional-foreground">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
