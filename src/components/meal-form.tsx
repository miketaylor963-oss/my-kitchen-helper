import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const NONE = "__none__";

type LookupRow = { id: number; name: string };

export type MealFormInitial = {
  id?: number;
  name: string;
  status: string;
  description: string | null;
  serves: number | null;
  dietary_category_id: number | null;
  cuisine_id: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  gi_index: number | null;
  source: string | null;
  external_ref: string | null;
  restriction_ids: number[];
  nutritional_tag_ids: number[];
  meal_type_ids: number[];
  meal_format_ids: number[];
};

export const emptyMeal: MealFormInitial = {
  name: "",
  status: "idea",
  description: null,
  serves: null,
  dietary_category_id: null,
  cuisine_id: null,
  protein_g: null,
  carbs_g: null,
  gi_index: null,
  source: null,
  external_ref: null,
  restriction_ids: [],
  nutritional_tag_ids: [],
  meal_type_ids: [],
  meal_format_ids: [],
};

function useLookups() {
  return useQuery({
    queryKey: ["meal-form-lookups"],
    queryFn: async () => {
      const [cats, cuisines, restrictions, tags, types, formats] = await Promise.all([
        supabase.from("dietary_category").select("id, name").order("rank"),
        supabase.from("cuisine").select("id, name").order("sort_order"),
        supabase.from("dietary_restriction").select("id, name").order("sort_order"),
        supabase.from("nutritional_tag").select("id, name").order("sort_order"),
        supabase.from("meal_type").select("id, name").order("sort_order"),
        supabase.from("meal_format").select("id, name").order("sort_order"),
      ]);
      for (const r of [cats, cuisines, restrictions, tags, types, formats]) {
        if (r.error) throw r.error;
      }
      return {
        cats: (cats.data ?? []) as LookupRow[],
        cuisines: (cuisines.data ?? []) as LookupRow[],
        restrictions: (restrictions.data ?? []) as LookupRow[],
        tags: (tags.data ?? []) as LookupRow[],
        types: (types.data ?? []) as LookupRow[],
        formats: (formats.data ?? []) as LookupRow[],
      };
    },
  });
}

function toNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function MultiPicker({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: LookupRow[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const selectedRows = options.filter((o) => selected.includes(o.id));
  function toggle(id: number, on: boolean) {
    onChange(on ? [...selected, id] : selected.filter((x) => x !== id));
  }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" type="button" className="w-full justify-between font-normal">
            <span className="truncate text-left">
              {selectedRows.length === 0 ? `Select ${label.toLowerCase()}…` : `${selectedRows.length} selected`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="max-h-64 overflow-auto p-2">
            {options.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">No options.</p>
            ) : (
              options.map((o) => {
                const checked = selected.includes(o.id);
                return (
                  <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                    <Checkbox checked={checked} onCheckedChange={(v) => toggle(o.id, !!v)} />
                    <span>{o.name}</span>
                  </label>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {selectedRows.map((r) => (
            <Badge key={r.id} variant="secondary" className="text-xs font-normal">{r.name}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function MealForm({ initial }: { initial: MealFormInitial }) {
  const nav = useNavigate();
  const lookups = useLookups();
  const [m, setM] = useState<MealFormInitial>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setM(initial), [initial]);

  function update<K extends keyof MealFormInitial>(key: K, value: MealFormInitial[K]) {
    setM((prev) => ({ ...prev, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!m.name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    try {
      const payload = {
        name: m.name.trim(),
        status: m.status,
        description: m.description?.trim() || null,
        serves: m.serves,
        dietary_category_id: m.dietary_category_id,
        cuisine_id: m.cuisine_id,
        protein_g: m.protein_g,
        carbs_g: m.carbs_g,
        gi_index: m.gi_index,
        source: m.source?.trim() || null,
        external_ref: m.external_ref?.trim() || null,
      };

      let mealId = m.id;
      if (mealId) {
        const { error } = await supabase.from("meal").update(payload).eq("id", mealId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("meal").insert(payload).select("id").single();
        if (error) throw error;
        mealId = data.id;
      }

      // Replace join rows
      await replaceJoin("meal_restriction", "meal_id", "restriction_id", mealId!, m.restriction_ids);
      await replaceJoin("meal_nutritional_tag", "meal_id", "nutritional_tag_id", mealId!, m.nutritional_tag_ids);
      await replaceJoin("meal_meal_type", "meal_id", "meal_type_id", mealId!, m.meal_type_ids);
      await replaceJoin("meal_meal_format", "meal_id", "meal_format_id", mealId!, m.meal_format_ids);

      nav({ to: "/meals/$mealId", params: { mealId: String(mealId) } });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const L = lookups.data;

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <Input value={m.name} onChange={(e) => update("name", e.target.value)} required />
        </Field>
        <Field label="Status" required>
          <Select value={m.status} onValueChange={(v) => update("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="idea">Idea</SelectItem>
              <SelectItem value="recipe">Recipe</SelectItem>
              <SelectItem value="composition">Composition</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Description">
        <Textarea value={m.description ?? ""} onChange={(e) => update("description", e.target.value)} rows={3} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Serves">
          <Input type="number" min={1} value={m.serves ?? ""} onChange={(e) => update("serves", toNum(e.target.value))} />
        </Field>
        <Field label="Dietary category">
          <Select
            value={m.dietary_category_id != null ? String(m.dietary_category_id) : NONE}
            onValueChange={(v) => update("dietary_category_id", v === NONE ? null : Number(v))}
          >
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {L?.cats.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cuisine">
          <Select
            value={m.cuisine_id != null ? String(m.cuisine_id) : NONE}
            onValueChange={(v) => update("cuisine_id", v === NONE ? null : Number(v))}
          >
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {L?.cuisines.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Protein (g)">
          <Input type="number" step="0.1" value={m.protein_g ?? ""} onChange={(e) => update("protein_g", toNum(e.target.value))} />
        </Field>
        <Field label="Carbs (g)">
          <Input type="number" step="0.1" value={m.carbs_g ?? ""} onChange={(e) => update("carbs_g", toNum(e.target.value))} />
        </Field>
        <Field label="GI index">
          <Input type="number" min={0} max={200} value={m.gi_index ?? ""} onChange={(e) => update("gi_index", toNum(e.target.value))} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Source">
          <Input value={m.source ?? ""} onChange={(e) => update("source", e.target.value)} />
        </Field>
        <Field label="External ref">
          <Input value={m.external_ref ?? ""} onChange={(e) => update("external_ref", e.target.value)} />
        </Field>
      </div>

      {lookups.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading options…</p>
      ) : L ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <MultiPicker label="Dietary restrictions" options={L.restrictions} selected={m.restriction_ids} onChange={(v) => update("restriction_ids", v)} />
          <MultiPicker label="Nutritional tags" options={L.tags} selected={m.nutritional_tag_ids} onChange={(v) => update("nutritional_tag_ids", v)} />
          <MultiPicker label="Meal types" options={L.types} selected={m.meal_type_ids} onChange={(v) => update("meal_type_ids", v)} />
          <MultiPicker label="Meal formats" options={L.formats} selected={m.meal_format_ids} onChange={(v) => update("meal_format_ids", v)} />
        </div>
      ) : null}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="ghost" onClick={() => nav({ to: "/meals" })}>Cancel</Button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

async function replaceJoin(
  table: "meal_restriction" | "meal_nutritional_tag" | "meal_meal_type" | "meal_meal_format",
  fk: "meal_id",
  col: string,
  mealId: number,
  ids: number[],
) {
  const del = await supabase.from(table).delete().eq(fk, mealId);
  if (del.error) throw del.error;
  if (ids.length === 0) return;
  const rows = ids.map((id) => ({ [fk]: mealId, [col]: id })) as never;
  const ins = await supabase.from(table).insert(rows);
  if (ins.error) throw ins.error;
}