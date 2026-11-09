import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePlataforma(userId: string | undefined) {
  const owner = useQuery({
    queryKey: ["platform-owner", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("platform_owners").select("user_id").eq("user_id", userId!).maybeSingle();
      return !!data;
    },
  });
  const principal = useQuery({
    queryKey: ["institucion-principal"],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("instituciones").select("nombre, features, logo_url").eq("es_principal", true).maybeSingle();
      return data;
    },
  });
  return { isOwner: owner.data === true, features: (principal.data?.features ?? null) as Record<string, boolean> | null, institucion: principal.data };
}
