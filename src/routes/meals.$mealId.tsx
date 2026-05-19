import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/meals/$mealId")({
  component: MealDetailPage,
});

type MealDetail = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  serves: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  gi_index: number | null;
  notes: string | null;
  dietary_category: { name: string } | null;
  cuisine: { name: string } | null;
  meal_restriction: { dietary_restriction: { id: number; name: string } | null }[];
  meal_nutritional_tag: { nutritional_tag: { id: number; name: string } | null }[];
  meal_meal_type: { meal_type: { id: number; name: string } | null }[];
  meal_meal_format: { meal_format: { id: number; name: string } | null }[];
  meal_ingredient: {
    id: number;
    ingredient_name: string;
    quantity: number | null;
    unit: string | null;
    group_name: string | null;
    sort_order: number | null;
  }[];
  meal_step: {
    id: number;
    title: string | null;
    content: string;
    sort_order: number;
    group_name: string | null;
  }[];
  meal_component: {
    id: number;
    notes: string | null;
    sort_order: number | null;
    component: { id: number; name: string; status: string } | null;
  }[];
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

function MealDetailPage() {
  const { mealId } = Route.useParams();
  const id = Number(mealId);

  const q = useQuery({
    queryKey: ["meal", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal")
        .select(
          `id, name, description, status, serves, protein_g, carbs_g, gi_index, notes,
           dietary_category:dietary_category_id(name),
           cuisine:cuisine_id(name),
           meal_restriction(dietary_restriction(id, name)),
           meal_nutritional_tag(nutritional_tag(id, name)),
           meal_meal_type(meal_type(id, name)),
           meal_meal_format(meal_format(id, name)),
           meal_ingredient(id, ingredient_name, quantity, unit, group_name, sort_order),
           meal_step(id, title, content, sort_order, group_name),
           meal_component(id, notes, sort_order, component:component_id(id, name, status))`
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as MealDetail;
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link to="/meals" className="text-sm text-muted-foreground hover:text-foreground">
          ← Meals
        </Link>

        {q.isLoading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : q.isError ? (
          <p className="mt-6 text-sm text-destructive">
            Failed to load meal: {(q.error as Error).message}
          </p>
        ) : !q.data ? (
          <p className="mt-6 text-sm text-muted-foreground">Meal not found.</p>
        ) : (
          <MealBody meal={q.data} />
        )}
      </div>
    </div>
  );
}

function MealBody({ meal }: { meal: MealDetail }) {
  const restrictions = meal.meal_restriction
    .map((r) => r.dietary_restriction)
    .filter((x): x is { id: number; name: string } => !!x);
  const tags = meal.meal_nutritional_tag
    .map((t) => t.nutritional_tag)
    .filter((x): x is { id: number; name: string } => !!x);
  const types = meal.meal_meal_type
    .map((t) => t.meal_type)
    .filter((x): x is { id: number; name: string } => !!x);
  const formats = meal.meal_meal_format
    .map((f) => f.meal_format)
    .filter((x): x is { id: number; name: string } => !!x);

  const macros: { label: string; value: string }[] = [];
  if (meal.protein_g != null) macros.push({ label: "Protein", value: `${meal.protein_g} g` });
  if (meal.carbs_g != null) macros.push({ label: "Carbs", value: `${meal.carbs_g} g` });
  if (meal.gi_index != null) macros.push({ label: "GI", value: String(meal.gi_index) });

  return (
    <div className="mt-4 space-y-8">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{meal.name}</h1>
          <Badge variant={statusVariant(meal.status)}>{meal.status}</Badge>
        </div>
        {meal.description && (
          <p className="text-muted-foreground">{meal.description}</p>
        )}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Field label="Dietary" value={meal.dietary_category?.name} />
          <Field label="Cuisine" value={meal.cuisine?.name} />
          <Field label="Serves" value={meal.serves != null ? String(meal.serves) : null} />
          {macros.map((m) => (
            <Field key={m.label} label={m.label} value={m.value} />
          ))}
        </dl>
      </header>

      {(types.length > 0 || formats.length > 0 || restrictions.length > 0 || tags.length > 0) && (
        <section className="space-y-3">
          <TagRow title="Meal type" items={types.map((t) => t.name)} />
          <TagRow title="Format" items={formats.map((f) => f.name)} />
          <TagRow title="Contains" items={restrictions.map((r) => r.name)} />
          <TagRow title="Nutritional tags" items={tags.map((t) => t.name)} />
        </section>
      )}

      {meal.status === "idea" && (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No recipe or components yet.
        </p>
      )}

      {meal.status === "recipe" && (
        <>
          <Ingredients items={meal.meal_ingredient} />
          <Steps items={meal.meal_step} />
        </>
      )}

      {meal.status === "composition" && (
        <Components items={meal.meal_component} />
      )}

      {meal.notes && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{meal.notes}</p>
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function TagRow({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{title}:</span>
      {items.map((t) => (
        <Badge key={t} variant="outline" className="text-xs font-normal">{t}</Badge>
      ))}
    </div>
  );
}

function Ingredients({ items }: { items: MealDetail["meal_ingredient"] }) {
  if (items.length === 0) {
    return (
      <section>
        <h2 className="mb-2 text-lg font-semibold">Ingredients</h2>
        <p className="text-sm text-muted-foreground">None listed.</p>
      </section>
    );
  }
  const sorted = [...items].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const groups = new Map<string, typeof sorted>();
  for (const it of sorted) {
    const key = it.group_name ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Ingredients</h2>
      <div className="space-y-4">
        {Array.from(groups.entries()).map(([group, rows]) => (
          <div key={group || "_"}>
            {group && <h3 className="mb-1 text-sm font-medium text-muted-foreground">{group}</h3>}
            <ul className="divide-y rounded-md border">
              {rows.map((r) => (
                <li key={r.id} className="flex justify-between gap-4 px-3 py-2 text-sm">
                  <span>{r.ingredient_name}</span>
                  <span className="text-muted-foreground">
                    {[r.quantity, r.unit].filter((x) => x != null && x !== "").join(" ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Steps({ items }: { items: MealDetail["meal_step"] }) {
  if (items.length === 0) {
    return (
      <section>
        <h2 className="mb-2 text-lg font-semibold">Steps</h2>
        <p className="text-sm text-muted-foreground">No steps yet.</p>
      </section>
    );
  }
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const groups = new Map<string, typeof sorted>();
  for (const s of sorted) {
    const key = s.group_name ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Steps</h2>
      <div className="space-y-5">
        {Array.from(groups.entries()).map(([group, rows]) => (
          <div key={group || "_"}>
            {group && <h3 className="mb-2 text-sm font-medium text-muted-foreground">{group}</h3>}
            <ol className="space-y-3">
              {rows.map((s, i) => (
                <li key={s.id} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {i + 1}
                  </span>
                  <div>
                    {s.title && <div className="font-medium">{s.title}</div>}
                    <div className="whitespace-pre-wrap">{s.content}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function Components({ items }: { items: MealDetail["meal_component"] }) {
  if (items.length === 0) {
    return (
      <section>
        <h2 className="mb-2 text-lg font-semibold">Components</h2>
        <p className="text-sm text-muted-foreground">No components linked yet.</p>
      </section>
    );
  }
  const sorted = [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Components</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {sorted.map((mc) => (
          <Card key={mc.id}>
            <CardContent className="flex items-center justify-between gap-2 p-3 text-sm">
              <span className="font-medium">{mc.component?.name ?? "—"}</span>
              {mc.component?.status && (
                <Badge variant="outline" className="text-xs font-normal">
                  {mc.component.status}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}