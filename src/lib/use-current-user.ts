import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
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
    loading: userLoading || q.isLoading,
    roles: q.data ?? [],
    isAdmin: (q.data ?? []).includes("admin"),
    isInspector: (q.data ?? []).includes("inspector"),
    isAspirante: (q.data ?? []).includes("aspirante"),
  };
}
