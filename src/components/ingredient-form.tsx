import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

export type IngredientFormInitial = {
  id?: number;
  canonical_name: string;
  default_unit: string | null;
  category_id: number | null;
  dietary_category_id: number | null;
  notes: string | null;
};

export const emptyIngredient: IngredientFormInitial = {
  canonical_name: "",
  default_unit: null,
  category_id: null,
  dietary_category_id: null,
  notes: null,
};

function useLookups() {
  return useQuery({
    queryKey: ["ingredient-form-lookups"],
    queryFn: async () => {
      const [cats, dietary] = await Promise.all([
        supabase
          .from("ingredient_category")
          .select("id, name")
          .order("sort_order"),
        supabase.from("dietary_category").select("id, name").order("rank"),
      ]);
      if (cats.error) throw cats.error;
      if (dietary.error) throw dietary.error;
      return {
        cats: cats.data ?? [],
        dietary: dietary.data ?? [],
      };
    },
  });
}

export function IngredientForm({ initial }: { initial: IngredientFormInitial }) {
  const nav = useNavigate();
  const lookups = useLookups();
  const [m, setM] = useState<IngredientFormInitial>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setM(initial), [initial]);

  function update<K extends keyof IngredientFormInitial>(
    key: K,
    value: IngredientFormInitial[K]
  ) {
    setM((prev) => ({ ...prev, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = m.canonical_name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        canonical_name: name,
        default_unit: m.default_unit?.trim() || null,
        category_id: m.category_id,
        dietary_category_id: m.dietary_category_id,
        notes: m.notes?.trim() || null,
      };

      let ingredientId = m.id;
      if (ingredientId) {
        const { error } = await supabase
          .from("ingredient")
          .update(payload)
          .eq("id", ingredientId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("ingredient")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        ingredientId = data.id;
      }

      nav({
        to: "/admin/ingredients/$id",
        params: { id: String(ingredientId) },
      });
    } catch (err) {
      const pgErr = err as { code?: string; message: string };
      if (pgErr.code === "23505") {
        setError("An ingredient with this name already exists.");
      } else {
        setError(pgErr.message);
      }
      setBusy(false);
    }
  }

  function cancel() {
    if (m.id) {
      nav({ to: "/admin/ingredients/$id", params: { id: String(m.id) } });
    } else {
      nav({ to: "/admin/ingredients" });
    }
  }

  const L = lookups.data;

  return (
    <form onSubmit={save} className="space-y-6">
      <Field label="Name" required>
        <Input
          value={m.canonical_name}
          onChange={(e) => update("canonical_name", e.target.value)}
          disabled={busy}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Default unit">
          <Input
            value={m.default_unit ?? ""}
            onChange={(e) => update("default_unit", e.target.value || null)}
            disabled={busy}
          />
        </Field>
        <Field label="Category">
          <Select
            value={m.category_id != null ? String(m.category_id) : NONE}
            onValueChange={(v) =>
              update("category_id", v === NONE ? null : Number(v))
            }
            disabled={busy}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {L?.cats.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Dietary category">
        <Select
          value={
            m.dietary_category_id != null
              ? String(m.dietary_category_id)
              : NONE
          }
          onValueChange={(v) =>
            update("dietary_category_id", v === NONE ? null : Number(v))
          }
          disabled={busy}
        >
          <SelectTrigger>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {L?.dietary.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Notes">
        <Textarea
          value={m.notes ?? ""}
          onChange={(e) => update("notes", e.target.value || null)}
          rows={3}
          disabled={busy}
        />
      </Field>

      {lookups.isLoading && (
        <p className="text-sm text-muted-foreground">Loading options…</p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
