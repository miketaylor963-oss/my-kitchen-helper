import { supabase } from "@/integrations/supabase/client";

export type IngredientChoice =
  | { action: "accept"; ingredient_id: number }
  | { action: "override"; ingredient_id: number }
  | { action: "create_new"; canonical_name: string; default_unit: string | null;
      category_id: number | null; dietary_category_id: number | null };

export type CommitOutcome =
  | { kind: "success"; meal_id: number }
  | { kind: "duplicate_external_ref" }
  | { kind: "duplicate_ingredient_name"; name: string }
  | { kind: "error"; message: string };

export async function commitImport(
  payload: unknown,
  ingredientChoices: Record<string, IngredientChoice>,
): Promise<CommitOutcome> {
  // supabase.rpc types only include generated functions; commit_import is custom
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("commit_import", {
    payload,
    ingredient_choices: ingredientChoices,
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
        const match = detail.match(/\(([^)]+)\) already exists/);
        return { kind: "duplicate_ingredient_name", name: match ? match[1] : "unknown" };
      }
      // Unknown 23505 — surface raw, don't misclassify
    }
    return { kind: "error", message: error.message };
  }

  return { kind: "success", meal_id: data as number };
}
