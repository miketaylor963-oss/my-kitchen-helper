import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useIsWriter() {
  const { user, loading } = useSession();
  const q = useQuery({
    queryKey: ["is-writer", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_writer")
        .select("user_id")
        .eq("user_id", user!.id)
        .eq("household_id", 1)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  return {
    user,
    isWriter: !!q.data,
    loading: loading || (!!user && q.isLoading),
  };
}