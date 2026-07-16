import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ClipboardList, GraduationCap, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: AdminHome });

function AdminHome() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [q, e, aprob, desap, u] = await Promise.all([
        supabase.from("questions").select("*", { count: "exact", head: true }),
        supabase.from("exams").select("*", { count: "exact", head: true }),
        supabase.from("exams").select("*", { count: "exact", head: true }).eq("status", "aprobado"),
        supabase.from("exams").select("*", { count: "exact", head: true }).eq("status", "desaprobado"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      return {
        preguntas: q.count ?? 0,
        examenes: e.count ?? 0,
        aprobados: aprob.count ?? 0,
        desaprobados: desap.count ?? 0,
        usuarios: u.count ?? 0,
      };
    },
  });
  const s = stats.data;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <Metric icon={<ClipboardList />} label="Preguntas" value={s?.preguntas ?? "—"} />
      <Metric icon={<GraduationCap />} label="Exámenes totales" value={s?.examenes ?? "—"} />
      <Metric icon={<CheckCircle2 className="text-success" />} label="Aprobados" value={s?.aprobados ?? "—"} />
      <Metric icon={<XCircle className="text-destructive" />} label="Desaprobados" value={s?.desaprobados ?? "—"} />
      <Metric icon={<Users />} label="Usuarios" value={s?.usuarios ?? "—"} />
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="h-5 w-5 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent><div className="text-3xl font-bold font-serif">{value}</div></CardContent>
    </Card>
  );
}
