import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsWriter } from "@/lib/auth";

export const Route = createFileRoute("/admin/ingredients/")({
  component: Page,
});

const ALL = "__all__";

type ingredient_row = {
  id: number;
  canonical_name: string;
  default_unit: string | null;
  ingredient_category: { id: number; name: string; sort_order: number } | null;
  dietary_category: { id: number; name: string } | null;
};

function Page() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [dietaryId, setDietaryId] = useState<string>(ALL);
  const { isWriter } = useIsWriter();

  const lookups = useQuery({
    queryKey: ["ingredient-lookups"],
    queryFn: async () => {
      const [cats, dietary] = await Promise.all([
        supabase
          .from("ingredient_category")
          .select("id, name, sort_order")
          .order("sort_order"),
        supabase.from("dietary_category").select("id, name").order("rank"),
      ]);
      if (cats.error) throw cats.error;
      if (dietary.error) throw dietary.error;
      return { cats: cats.data ?? [], dietary: dietary.data ?? [] };
    },
  });

  const ingredients = useQuery({
    queryKey: ["admin-ingredients", { search, categoryId, dietaryId }],
    queryFn: async () => {
      const trimmed = search.trim();

      // Two parallel lookups to resolve both canonical_name and alias matches.
      // Using separate queries avoids PostgREST or() string construction with
      // percent signs, which breaks if the search term contains special chars.
      let searchIds: number[] | null = null;
      if (trimmed) {
        const [nameRes, aliasRes] = await Promise.all([
          supabase
            .from("ingredient")
            .select("id")
            .ilike("canonical_name", `%${trimmed}%`),
          supabase
            .from("ingredient_alias")
            .select("ingredient_id")
            .ilike("alias", `%${trimmed}%`),
        ]);
        const ids = new Set<number>();
        (nameRes.data ?? []).forEach((r) => ids.add(r.id));
        (aliasRes.data ?? []).forEach((r) => ids.add(r.ingredient_id));
        searchIds = Array.from(ids);
      }

      if (searchIds !== null && searchIds.length === 0) return [];

      let q = supabase
        .from("ingredient")
        .select(
          "id, canonical_name, default_unit, ingredient_category:category_id(id, name, sort_order), dietary_category:dietary_category_id(id, name)"
        );

      if (searchIds !== null) q = q.in("id", searchIds);
      if (categoryId !== ALL) q = q.eq("category_id", Number(categoryId));
      if (dietaryId !== ALL) q = q.eq("dietary_category_id", Number(dietaryId));

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ingredient_row[];
    },
  });

  const items = useMemo(
    () =>
      [...(ingredients.data ?? [])].sort((a, b) => {
        const sortA = a.ingredient_category?.sort_order ?? 999;
        const sortB = b.ingredient_category?.sort_order ?? 999;
        if (sortA !== sortB) return sortA - sortB;
        return a.canonical_name.localeCompare(b.canonical_name);
      }),
    [ingredients.data]
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Home
        </Link>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Admin
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Ingredients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ingredients.isLoading
              ? "Loading…"
              : `${items.length} ingredient${items.length === 1 ? "" : "s"}`}
          </p>
          {isWriter && (
            <div className="mt-3">
              <Button asChild size="sm">
                <Link to="/admin/ingredients/new">New ingredient</Link>
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or alias…"
              className="pl-8"
            />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {lookups.data?.cats.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dietaryId} onValueChange={setDietaryId}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Dietary" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All diets</SelectItem>
              {lookups.data?.dietary.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6">
          {ingredients.isError && (
            <p className="text-sm text-destructive">
              Failed to load ingredients:{" "}
              {(ingredients.error as Error).message}
            </p>
          )}
          {ingredients.isLoading ? (
            <div className="grid gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No ingredients match your filters.
            </p>
          ) : (
            <IngredientTable items={items} />
          )}
        </div>
      </div>
    </div>
  );
}

function IngredientTable({ items }: { items: ingredient_row[] }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-left font-medium">Default unit</th>
            <th className="px-3 py-2 text-left font-medium">Category</th>
            <th className="px-3 py-2 text-left font-medium">Dietary</th>
          </tr>
        </thead>
        <tbody>
          {items.map((ing) => (
            <tr key={ing.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2 font-medium">
                <Link
                  to="/admin/ingredients/$id"
                  params={{ id: String(ing.id) }}
                  className="hover:underline"
                >
                  {ing.canonical_name}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {ing.default_unit ?? ""}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {ing.ingredient_category?.name ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {ing.dietary_category?.name ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
