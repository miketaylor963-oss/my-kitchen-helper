import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MealForm, type MealFormInitial } from "@/components/meal-form";
import { useIsWriter } from "@/lib/auth";

export const Route = createFileRoute("/meals/$mealId/edit")({ component: EditMealPage });

function EditMealPage() {
  const { mealId } = Route.useParams();
  const id = Number(mealId);
  const { isWriter, loading, user } = useIsWriter();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  const q = useQuery({
    queryKey: ["meal-edit", id],
    enabled: isWriter,
    queryFn: async (): Promise<MealFormInitial> => {
      const { data, error } = await supabase
        .from("meal")
        .select(`id, name, status, description, serves, dietary_category_id, cuisine_id,
                 protein_g, carbs_g, gi_index, source, external_ref,
                 meal_restriction(restriction_id),
                 meal_nutritional_tag(nutritional_tag_id),
                 meal_meal_type(meal_type_id),
                 meal_meal_format(meal_format_id)`)
        .eq("id", id)
        .single();
      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        status: data.status,
        description: data.description,
        serves: data.serves,
        dietary_category_id: data.dietary_category_id,
        cuisine_id: data.cuisine_id,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        gi_index: data.gi_index,
        source: data.source,
        external_ref: data.external_ref,
        restriction_ids: (data.meal_restriction ?? []).map((r: { restriction_id: number }) => r.restriction_id),
        nutritional_tag_ids: (data.meal_nutritional_tag ?? []).map((r: { nutritional_tag_id: number }) => r.nutritional_tag_id),
        meal_type_ids: (data.meal_meal_type ?? []).map((r: { meal_type_id: number }) => r.meal_type_id),
        meal_format_ids: (data.meal_meal_format ?? []).map((r: { meal_format_id: number }) => r.meal_format_id),
      };
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/meals/$mealId" params={{ mealId }} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Edit meal</h1>
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Checking access…</p>
          ) : !isWriter ? (
            <p className="text-sm text-destructive">You don't have writer access on this household.</p>
          ) : q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">{(q.error as Error).message}</p>
          ) : q.data ? (
            <MealForm initial={q.data} />
          ) : null}
        </div>
      </div>
    </div>
  );
}