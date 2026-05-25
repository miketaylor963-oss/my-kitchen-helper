import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  IngredientForm,
  type IngredientFormInitial,
} from "@/components/ingredient-form";
import { useIsWriter } from "@/lib/auth";

export const Route = createFileRoute("/admin/ingredients/$id/edit")({
  component: EditIngredientPage,
});

function AccessPanel({ user }: { user: { id: string } | null }) {
  return (
    <div className="rounded-md border p-6 text-sm text-muted-foreground">
      {!user ? (
        <>
          <Link
            to="/login"
            className="text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>{" "}
          to edit.
        </>
      ) : (
        "You don't have writer access on this household."
      )}
    </div>
  );
}

function EditIngredientPage() {
  const { id } = Route.useParams();
  const numId = Number(id);
  const { user, isWriter, loading } = useIsWriter();

  const q = useQuery({
    queryKey: ["ingredient-edit", numId],
    enabled: isWriter,
    queryFn: async (): Promise<IngredientFormInitial | null> => {
      const { data, error } = await supabase
        .from("ingredient")
        .select(
          "id, canonical_name, default_unit, category_id, dietary_category_id, notes"
        )
        .eq("id", numId)
        .maybeSingle();
      if (error) throw error;
      return data as IngredientFormInitial | null;
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/admin/ingredients/$id"
          params={{ id }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Link>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Admin / Ingredients
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Edit ingredient
          </h1>
        </div>
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Checking access…</p>
          ) : !isWriter ? (
            <AccessPanel user={user} />
          ) : q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : q.isError ? (
            <p className="text-sm text-destructive">
              {(q.error as Error).message}
            </p>
          ) : !q.data ? (
            <p className="text-sm text-muted-foreground">
              Ingredient not found.
            </p>
          ) : (
            <IngredientForm initial={q.data} />
          )}
        </div>
      </div>
    </div>
  );
}
