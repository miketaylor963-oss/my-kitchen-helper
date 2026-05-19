import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, List as ListIcon, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsWriter } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/meals/")({
  component: Page,
});

type ViewMode = "list" | "grid";
const VIEW_KEY = "meals:view";
const ALL = "__all__";

type MealRow = {
  id: number;
  name: string;
  status: string;
  dietary_category: { name: string } | null;
  cuisine: { id: number; name: string } | null;
  meal_meal_type: { meal_type: { id: number; name: string } | null }[];
};

function statusVariant(status: string) {
  switch (status) {
    case "recipe":
      return "default" as const;
    case "composition":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

function Page() {
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [dietaryId, setDietaryId] = useState<string>(ALL);
  const [cuisineId, setCuisineId] = useState<string>(ALL);
  const { isWriter } = useIsWriter();

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "list" || saved === "grid") setView(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const lookups = useQuery({
    queryKey: ["meal-lookups"],
    queryFn: async () => {
      const [cuisines, cats] = await Promise.all([
        supabase.from("cuisine").select("id, name").order("sort_order"),
        supabase.from("dietary_category").select("id, name").order("rank"),
      ]);
      if (cuisines.error) throw cuisines.error;
      if (cats.error) throw cats.error;
      return { cuisines: cuisines.data ?? [], cats: cats.data ?? [] };
    },
  });

  const meals = useQuery({
    queryKey: ["meals", { search, status, dietaryId, cuisineId }],
    queryFn: async () => {
      let q = supabase
        .from("meal")
        .select(
          "id, name, status, dietary_category:dietary_category_id(name), cuisine:cuisine_id(id, name), meal_meal_type(meal_type(id, name))"
        )
        .order("name");
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      if (status !== ALL) q = q.eq("status", status);
      if (dietaryId !== ALL) q = q.eq("dietary_category_id", Number(dietaryId));
      if (cuisineId !== ALL) q = q.eq("cuisine_id", Number(cuisineId));
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as MealRow[];
    },
  });

  const items = useMemo(() => meals.data ?? [], [meals.data]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Meals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {meals.isLoading ? "Loading…" : `${items.length} meal${items.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isWriter && (
              <Button asChild size="sm">
                <Link to="/meals/new"><Plus /> New meal</Link>
              </Button>
            )}
            <div className="inline-flex rounded-md border">
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setView("list")}
            >
              <ListIcon /> List
            </Button>
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setView("grid")}
            >
              <LayoutGrid /> Grid
            </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search meals…"
              className="pl-8"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="idea">Idea</SelectItem>
              <SelectItem value="recipe">Recipe</SelectItem>
              <SelectItem value="composition">Composition</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dietaryId} onValueChange={setDietaryId}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Dietary" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All diets</SelectItem>
              {lookups.data?.cats.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cuisineId} onValueChange={setCuisineId}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Cuisine" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All cuisines</SelectItem>
              {lookups.data?.cuisines.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6">
          {meals.isError && (
            <p className="text-sm text-destructive">Failed to load meals: {(meals.error as Error).message}</p>
          )}
          {meals.isLoading ? (
            <div className="grid gap-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No meals match your filters.
            </p>
          ) : view === "list" ? (
            <ListView items={items} />
          ) : (
            <GridView items={items} />
          )}
        </div>
      </div>
    </div>
  );
}

function MealTypes({ row }: { row: MealRow }) {
  const types = row.meal_meal_type
    .map((mt) => mt.meal_type?.name)
    .filter((n): n is string => !!n);
  if (types.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {types.map((t) => (
        <Badge key={t} variant="outline" className="text-xs font-normal">{t}</Badge>
      ))}
    </div>
  );
}

function ListView({ items }: { items: MealRow[] }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-left font-medium">Dietary</th>
            <th className="px-3 py-2 text-left font-medium">Cuisine</th>
            <th className="px-3 py-2 text-left font-medium">Meal type</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2 font-medium">
                <Link
                  to="/meals/$mealId"
                  params={{ mealId: String(m.id) }}
                  className="hover:underline"
                >
                  {m.name}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{m.dietary_category?.name ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{m.cuisine?.name ?? "—"}</td>
              <td className="px-3 py-2"><MealTypes row={m} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GridView({ items }: { items: MealRow[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((m) => (
        <Link
          key={m.id}
          to="/meals/$mealId"
          params={{ mealId: String(m.id) }}
          className="block"
        >
          <Card className="transition-colors hover:bg-muted/30">
            <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-tight">{m.name}</h3>
              <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
            </div>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <div>{m.dietary_category?.name ?? "—"}</div>
              <div>{m.cuisine?.name ?? "—"}</div>
            </div>
            <div className="mt-3"><MealTypes row={m} /></div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}