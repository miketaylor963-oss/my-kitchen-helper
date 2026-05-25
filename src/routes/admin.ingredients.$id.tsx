import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/ingredients/$id")({
  component: Page,
});

type IngredientDetail = {
  id: number;
  canonical_name: string;
  default_unit: string | null;
  notes: string | null;
  ingredient_category: { name: string } | null;
  dietary_category: { name: string } | null;
  ingredient_alias: { alias: string }[];
};

function Page() {
  const { id } = Route.useParams();
  const numId = Number(id);

  const q = useQuery({
    queryKey: ["admin-ingredient", numId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredient")
        .select(
          "id, canonical_name, default_unit, notes, " +
            "ingredient_category:category_id(name), " +
            "dietary_category:dietary_category_id(name), " +
            "ingredient_alias(alias)"
        )
        .eq("id", numId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        ingredient_alias: [
          ...(data.ingredient_alias as { alias: string }[]),
        ].sort((a, b) => a.alias.localeCompare(b.alias)),
      } as IngredientDetail;
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link
          to="/admin/ingredients"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to ingredients
        </Link>

        {q.isLoading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : q.isError ? (
          <p className="mt-6 text-sm text-destructive">
            Failed to load ingredient: {(q.error as Error).message}
          </p>
        ) : !q.data ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Ingredient not found.
          </p>
        ) : (
          <Detail ingredient={q.data} />
        )}
      </div>
    </div>
  );
}

function Detail({ ingredient }: { ingredient: IngredientDetail }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Admin / Ingredients
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {ingredient.canonical_name}
      </h1>

      <dl className="mt-6 divide-y rounded-md border text-sm">
        <FieldRow label="Default unit" value={ingredient.default_unit} />
        <FieldRow
          label="Category"
          value={ingredient.ingredient_category?.name ?? null}
        />
        <FieldRow
          label="Dietary category"
          value={ingredient.dietary_category?.name ?? null}
        />
        <FieldRow label="Notes" value={ingredient.notes} />
      </dl>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Aliases</h2>
        {ingredient.ingredient_alias.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No aliases.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-md border">
            {ingredient.ingredient_alias.map(({ alias }) => (
              <li key={alias} className="px-3 py-2 text-sm">
                {alias}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-4 px-3 py-2">
      <dt className="w-36 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}
