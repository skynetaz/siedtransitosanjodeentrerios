import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let done = false;
    const finish = (u: User | null) => {
      if (done) return;
      done = true;
      setUser(u);
      setLoading(false);
    };
    // Sesión local (sin red) para no quedar colgado con conexión lenta o token vencido.
    supabase.auth
      .getSession()
      .then(({ data }) => finish(data.session?.user ?? null))
      .catch(() => finish(null));
    // Seguro: nunca más de 4 s con la ruedita girando.
    const t = setTimeout(() => finish(null), 4000);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!done) finish(session?.user ?? null);
    });
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

export type AppRole = "admin" | "inspector" | "aspirante";

export function useCurrentRole() {
  const { user, loading: userLoading } = useCurrentUser();
  const q = useQuery({
    queryKey: ["user-roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
  return {
    user,
    loading: userLoading || (q.isLoading && !q.isError),
    roles: q.data ?? [],
    isAdmin: (q.data ?? []).includes("admin"),
    isInspector: (q.data ?? []).includes("inspector"),
    isAspirante: (q.data ?? []).includes("aspirante"),
  };
}
