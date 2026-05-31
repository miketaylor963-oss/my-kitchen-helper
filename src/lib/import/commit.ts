import { supabase } from "@/integrations/supabase/client";

export type IngredientChoice =
  | { action: "accept"; ingredient_id: number }
  | { action: "override"; ingredient_id: number }
  | { action: "create_new"; canonical_name: string; default_unit: string | null;
      category_id: number | null; dietary_category_id: number | null };

export type CommitOutcome =
  | { kind: "success"; meal_id: number }
  | { kind: "duplicate_external_ref" }
  | { kind: "duplicate_ingredient_name"; name: string | null }
  | { kind: "error"; message: string };

export async function commitImport(
  payload: unknown,
  ingredientChoices: Record<string, IngredientChoice>,
  onConflict: "fail" | "update" = "fail",
): Promise<CommitOutcome> {
  // supabase.rpc types only include generated functions; commit_import is custom
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("commit_import", {
    payload,
    ingredient_choices: ingredientChoices,
    on_conflict: onConflict,
  });

  if (error) {
    if (error.code === "23505") {
      const msg = (error.message ?? "") as string;
      const detail = (error.details ?? "") as string;
      if (msg.includes("meal_external_ref_key") || detail.includes("meal_external_ref_key")) {
        return { kind: "duplicate_external_ref" };
      }
      if (
        msg.includes("ingredient_canonical_name_key") ||
        detail.includes("ingredient_canonical_name_key")
      ) {
        const createNewEntries = Object.values(ingredientChoices).filter(
          (c): c is Extract<IngredientChoice, { action: "create_new" }> => c.action === "create_new",
        );
        if (createNewEntries.length === 0) {
          // Race condition: constraint fired with no create_new entries in choices
          return { kind: "duplicate_ingredient_name", name: null };
        }
        if (createNewEntries.length === 1) {
          return { kind: "duplicate_ingredient_name", name: createNewEntries[0].canonical_name };
        }
        // Multiple create_new entries: check DB to find the colliding one(s)
        const { data: existing } = await supabase
          .from("ingredient")
          .select("canonical_name")
          .in("canonical_name", createNewEntries.map((e) => e.canonical_name));
        const collidingNames = (existing ?? []).map((r) => r.canonical_name as string);
        const names = collidingNames.length > 0 ? collidingNames : createNewEntries.map((e) => e.canonical_name);
        return { kind: "duplicate_ingredient_name", name: names.join(", ") };
      }
      // Unknown 23505 — surface raw, don't misclassify
    }
    return { kind: "error", message: error.message };
  }

  return { kind: "success", meal_id: data as number };
}
