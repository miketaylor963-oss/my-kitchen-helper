import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsWriter } from "@/lib/auth";

export const Route = createFileRoute("/admin/ingredients/$id/")({
  component: Page,
});

type IngredientDetail = {
  id: number;
  canonical_name: string;
  default_unit: string | null;
  notes: string | null;
  ingredient_category: { name: string } | null;
  dietary_category: { name: string } | null;
  ingredient_alias: { id: number; alias: string }[];
};

function Page() {
  const { id } = Route.useParams();
  const numId = Number(id);
  const { isWriter } = useIsWriter();

  const q = useQuery({
    queryKey: ["admin-ingredient", numId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredient")
        .select(
          "id, canonical_name, default_unit, notes, " +
            "ingredient_category:category_id(name), " +
            "dietary_category:dietary_category_id(name), " +
            "ingredient_alias(id, alias)"
        )
        .eq("id", numId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        ingredient_alias: [
          ...(data.ingredient_alias as { id: number; alias: string }[]),
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
          <Detail ingredient={q.data} id={id} isWriter={isWriter} />
        )}
      </div>
    </div>
  );
}

function Detail({
  ingredient,
  id,
  isWriter,
}: {
  ingredient: IngredientDetail;
  id: string;
  isWriter: boolean;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Admin / Ingredients
      </p>
      <div className="flex items-start justify-between gap-3">
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {ingredient.canonical_name}
        </h1>
        {isWriter && (
          <Button asChild size="sm" variant="outline" className="mt-1">
            <Link to="/admin/ingredients/$id/edit" params={{ id }}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>
        )}
      </div>

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

      <AliasSection
        ingredientId={ingredient.id}
        aliases={ingredient.ingredient_alias}
        isWriter={isWriter}
      />
    </div>
  );
}

function AliasSection({
  ingredientId,
  aliases,
  isWriter,
}: {
  ingredientId: number;
  aliases: { id: number; alias: string }[];
  isWriter: boolean;
}) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addAlias(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase
        .from("ingredient_alias")
        .insert({ ingredient_id: ingredientId, alias: trimmed });
      if (error) throw error;
      setInput("");
      await queryClient.invalidateQueries({ queryKey: ["admin-ingredient", ingredientId] });
    } catch (err) {
      const pgErr = err as { code?: string; message: string };
      if (pgErr.code === "23505") {
        setError("This alias already exists.");
      } else {
        setError(pgErr.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeAlias(id: number) {
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase
        .from("ingredient_alias")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["admin-ingredient", ingredientId] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Aliases</h2>
      {aliases.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No aliases.</p>
      ) : (
        <ul className="mt-2 divide-y rounded-md border">
          {aliases.map(({ id, alias }) => (
            <li
              key={id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span>{alias}</span>
              {isWriter && (
                <button
                  onClick={() => removeAlias(id)}
                  disabled={busy}
                  aria-label={`Remove alias ${alias}`}
                  className="ml-2 text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isWriter && (
        <form onSubmit={addAlias} className="mt-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="New alias…"
            disabled={busy}
            className="max-w-xs"
          />
          <Button type="submit" size="sm" disabled={busy || !input.trim()}>
            {busy ? "Adding…" : "Add alias"}
          </Button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
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
