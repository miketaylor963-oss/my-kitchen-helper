import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { validate, type LookupSets, type ValidationResult } from "@/lib/import/validate";

export const Route = createFileRoute("/admin/import")({
  component: Page,
});

type FrameworkRow = {
  code: string;
  framework_layer: { code: string; component_family: { code: string }[] }[];
};

function Page() {
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<ValidationResult | "parse-error" | null>(null);
  const [parseError, setParseError] = useState("");

  const lookups = useQuery({
    queryKey: ["import-lookups"],
    queryFn: async (): Promise<LookupSets> => {
      const [
        cuisineRes, dietaryCategoryRes, dietaryRestrictionRes,
        nutritionalTagRes, mealTypeRes, mealFormatRes, frameworkRes,
      ] = await Promise.all([
        supabase.from("cuisine").select("code"),
        supabase.from("dietary_category").select("code"),
        supabase.from("dietary_restriction").select("code"),
        supabase.from("nutritional_tag").select("code"),
        supabase.from("meal_type").select("code"),
        supabase.from("meal_format").select("code"),
        supabase.from("framework").select("code, framework_layer(code, component_family(code))"),
      ]);

      if (cuisineRes.error) throw cuisineRes.error;
      if (dietaryCategoryRes.error) throw dietaryCategoryRes.error;
      if (dietaryRestrictionRes.error) throw dietaryRestrictionRes.error;
      if (nutritionalTagRes.error) throw nutritionalTagRes.error;
      if (mealTypeRes.error) throw mealTypeRes.error;
      if (mealFormatRes.error) throw mealFormatRes.error;
      if (frameworkRes.error) throw frameworkRes.error;

      const frameworkLayers = new Map<string, Map<string, Set<string>>>();
      for (const fw of (frameworkRes.data ?? []) as unknown as FrameworkRow[]) {
        const layerMap = new Map<string, Set<string>>();
        for (const layer of fw.framework_layer)
          layerMap.set(layer.code, new Set(layer.component_family.map((f) => f.code)));
        frameworkLayers.set(fw.code, layerMap);
      }

      return {
        cuisineCodes: new Set((cuisineRes.data ?? []).map((r) => r.code)),
        dietaryCategoryCodes: new Set((dietaryCategoryRes.data ?? []).map((r) => r.code)),
        dietaryRestrictionCodes: new Set((dietaryRestrictionRes.data ?? []).map((r) => r.code)),
        nutritionalTagCodes: new Set((nutritionalTagRes.data ?? []).map((r) => r.code)),
        mealTypeCodes: new Set((mealTypeRes.data ?? []).map((r) => r.code)),
        mealFormatCodes: new Set((mealFormatRes.data ?? []).map((r) => r.code)),
        frameworkLayers,
      };
    },
  });

  function handleValidate() {
    if (!lookups.data) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.trim());
    } catch (e) {
      setParseError((e as Error).message);
      setOutcome("parse-error");
      return;
    }
    setParseError("");
    setOutcome(validate(parsed, lookups.data));
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    setOutcome(null);
    setParseError("");
  }

  const canValidate = !!lookups.data && text.trim().length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link to="/admin/ingredients" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to ingredients
        </Link>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Admin / Import
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Import</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a recipe or component JSON to validate it against the import spec.
          </p>
        </div>

        {lookups.isError && (
          <p className="mt-4 text-sm text-destructive">
            Failed to load reference data: {(lookups.error as Error).message}
          </p>
        )}

        <div className="mt-6 space-y-3">
          <Textarea
            value={text}
            onChange={handleTextChange}
            placeholder="Paste JSON here…"
            className="min-h-[300px] font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleValidate} disabled={!canValidate}>
              Validate
            </Button>
            {lookups.isLoading && (
              <span className="text-xs text-muted-foreground">Loading reference data…</span>
            )}
          </div>
        </div>

        {outcome !== null && (
          <div className="mt-6">
            <ResultPanel outcome={outcome} parseError={parseError} />
          </div>
        )}
      </div>
    </div>
  );
}

function ResultPanel({
  outcome,
  parseError,
}: {
  outcome: ValidationResult | "parse-error";
  parseError: string;
}) {
  if (outcome === "parse-error") {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Not valid JSON</p>
        {parseError && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">{parseError}</p>
        )}
      </div>
    );
  }

  if (!outcome.ok) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
        <p className="mb-3 text-sm font-medium text-destructive">
          {outcome.errors.length} validation {outcome.errors.length === 1 ? "error" : "errors"}
        </p>
        <ul className="space-y-1.5 text-sm">
          {outcome.errors.map((err, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
              <span>
                <span className="font-mono text-xs text-muted-foreground">{err.path || "(root)"}</span>
                <span className="mx-1 text-muted-foreground">—</span>
                {err.message}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const { summary } = outcome;

  return (
    <div className="rounded-md border border-green-600/30 bg-green-50/50 p-4 dark:border-green-400/30 dark:bg-green-950/20">
      <p className="mb-3 text-sm font-medium text-green-700 dark:text-green-400">
        Valid {summary.import_type} — {summary.name}
      </p>
      <dl className="divide-y rounded-md border bg-background text-sm">
        <SummaryRow label="Cuisine" value={summary.cuisine ?? "—"} />
        <SummaryRow label="Dietary category" value={summary.dietary_category ?? "—"} />
        <SummaryRow
          label="Restrictions"
          value={summary.dietary_restrictions.length > 0 ? summary.dietary_restrictions.join(", ") : "—"}
        />
        <SummaryRow
          label="Tags"
          value={summary.nutritional_tags.length > 0 ? summary.nutritional_tags.join(", ") : "—"}
        />
        <SummaryRow label="Ingredients" value={String(summary.ingredient_count)} />
        <SummaryRow label="Steps" value={String(summary.step_count)} />
        {summary.derived_components.length > 0 && (
          <div className="px-3 py-2">
            <dt className="text-muted-foreground">
              Derived {summary.derived_components.length === 1 ? "component" : "components"}
            </dt>
            <dd className="mt-1 space-y-0.5">
              {summary.derived_components.map((d, i) => (
                <div key={i} className="font-medium">
                  {d.name}
                  <span className="ml-2 font-normal text-xs text-muted-foreground">
                    ({d.ingredient_count} ingredient{d.ingredient_count === 1 ? "" : "s"},{" "}
                    {d.step_count} step{d.step_count === 1 ? "" : "s"})
                  </span>
                </div>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-3 py-2">
      <dt className="w-36 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
