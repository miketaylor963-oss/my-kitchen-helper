import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { validate, type LookupSets, type ValidationResult } from "@/lib/import/validate";
import {
  matchIngredients,
  evaluateConsistencyAdvisory,
  type MatchingResult,
  type AdvisoryResult,
  type ParsedRecipe,
  type IngredientMatch,
  type Candidate,
} from "@/lib/import/matching";
import {
  commitImport,
  type IngredientChoice,
  type CommitOutcome,
} from "@/lib/import/commit";
import { useIsWriter } from "@/lib/auth";

export const Route = createFileRoute("/admin/import")({
  component: Page,
});

const NONE = "__none__";

// UI-side choice state — widens IngredientChoice with partial states so
// the radio stays selected before the inner value is fully populated.
type ChoiceState =
  | "unresolved"
  | { action: "accept";    ingredient_id: number }
  | { action: "override";  ingredient_id: number | null }
  | { action: "create_new"; canonical_name: string; default_unit: string | null;
      category_id: number | null; dietary_category_id: number | null };

type FrameworkRow = {
  code: string;
  framework_layer: { code: string; component_family: { code: string }[] }[];
};

type ImportLookupsData = {
  sets: LookupSets;
  dietaryCategoryRanks: Map<string, number>;
  dietaryCategoryCodeById: Map<number, string>;
  ingredientCategories: { id: number; name: string }[];
  dietaryCategoryOptions: { id: number; name: string }[];
};

type LookupLists = {
  ingredientCategories: { id: number; name: string }[];
  dietaryCategoryOptions: { id: number; name: string }[];
};

type CreateNewValues = {
  canonical_name: string;
  default_unit: string | null;
  category_id: number | null;
  dietary_category_id: number | null;
};

function Page() {
  const nav = useNavigate();
  const { isWriter, loading } = useIsWriter();
  const [text, setText] = useState("");
  const [parsedData, setParsedData] = useState<unknown>(null);
  const [outcome, setOutcome] = useState<ValidationResult | "parse-error" | null>(null);
  const [parseError, setParseError] = useState("");
  const [matchingOutcome, setMatchingOutcome] = useState<MatchingResult | { error: string } | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [choices, setChoices] = useState<Record<string, ChoiceState>>({});
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitOutcome, setCommitOutcome] = useState<CommitOutcome | null>(null);

  const lookups = useQuery({
    queryKey: ["import-lookups"],
    queryFn: async (): Promise<ImportLookupsData> => {
      const [
        cuisineRes, dietaryCategoryRes, dietaryRestrictionRes,
        nutritionalTagRes, mealTypeRes, mealFormatRes, frameworkRes,
        ingredientCategoryRes,
      ] = await Promise.all([
        supabase.from("cuisine").select("code"),
        supabase.from("dietary_category").select("id, code, rank, name"),
        supabase.from("dietary_restriction").select("code"),
        supabase.from("nutritional_tag").select("code"),
        supabase.from("meal_type").select("code"),
        supabase.from("meal_format").select("code"),
        supabase.from("framework").select("code, framework_layer(code, component_family(code))"),
        supabase.from("ingredient_category").select("id, name").order("sort_order"),
      ]);

      if (cuisineRes.error) throw cuisineRes.error;
      if (dietaryCategoryRes.error) throw dietaryCategoryRes.error;
      if (dietaryRestrictionRes.error) throw dietaryRestrictionRes.error;
      if (nutritionalTagRes.error) throw nutritionalTagRes.error;
      if (mealTypeRes.error) throw mealTypeRes.error;
      if (mealFormatRes.error) throw mealFormatRes.error;
      if (frameworkRes.error) throw frameworkRes.error;
      if (ingredientCategoryRes.error) throw ingredientCategoryRes.error;

      const frameworkLayers = new Map<string, Map<string, Set<string>>>();
      for (const fw of (frameworkRes.data ?? []) as unknown as FrameworkRow[]) {
        const layerMap = new Map<string, Set<string>>();
        for (const layer of fw.framework_layer)
          layerMap.set(layer.code, new Set(layer.component_family.map((f) => f.code)));
        frameworkLayers.set(fw.code, layerMap);
      }

      const dcRows = (dietaryCategoryRes.data ?? []) as { id: number; code: string; rank: number; name: string }[];
      const dietaryCategoryRanks = new Map<string, number>(dcRows.map((r) => [r.code, r.rank]));
      const dietaryCategoryCodeById = new Map<number, string>(dcRows.map((r) => [r.id, r.code]));

      return {
        sets: {
          cuisineCodes: new Set((cuisineRes.data ?? []).map((r) => r.code)),
          dietaryCategoryCodes: new Set(dcRows.map((r) => r.code)),
          dietaryRestrictionCodes: new Set((dietaryRestrictionRes.data ?? []).map((r) => r.code)),
          nutritionalTagCodes: new Set((nutritionalTagRes.data ?? []).map((r) => r.code)),
          mealTypeCodes: new Set((mealTypeRes.data ?? []).map((r) => r.code)),
          mealFormatCodes: new Set((mealFormatRes.data ?? []).map((r) => r.code)),
          frameworkLayers,
        },
        dietaryCategoryRanks,
        dietaryCategoryCodeById,
        ingredientCategories: (ingredientCategoryRes.data ?? []) as { id: number; name: string }[],
        dietaryCategoryOptions: dcRows.map((r) => ({ id: r.id, name: r.name })),
      };
    },
  });

  const ingredientsQuery = useQuery({
    queryKey: ["admin-ingredients-for-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredient")
        .select("id, canonical_name")
        .order("canonical_name");
      if (error) throw error;
      return (data ?? []) as { id: number; canonical_name: string }[];
    },
  });

  useEffect(() => {
    if (!loading && !isWriter) {
      nav({ to: "/admin", replace: true });
    }
  }, [loading, isWriter, nav]);

  async function handleValidate() {
    if (!lookups.data) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.trim());
    } catch (e) {
      setParseError((e as Error).message);
      setOutcome("parse-error");
      setParsedData(null);
      setMatchingOutcome(null);
      return;
    }
    setParseError("");
    setParsedData(parsed);
    setMatchingOutcome(null);
    const result = validate(parsed, lookups.data.sets);
    if (result.ok) {
      const ref = typeof (parsed as Record<string, unknown>)?.external_ref === "string"
        ? (parsed as Record<string, unknown>).external_ref as string
        : null;
      if (ref) {
        const { data: existingRow } = await supabase
          .from("meal")
          .select("id, name")
          .eq("external_ref", ref)
          .maybeSingle();
        result.existing_meal = existingRow ? { id: existingRow.id, name: existingRow.name } : null;
      }
    }
    setOutcome(result);
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    setOutcome(null);
    setParseError("");
    setParsedData(null);
    setMatchingOutcome(null);
    setChoices({});
    setReplaceConfirmed(false);
    setIsCommitting(false);
    setCommitOutcome(null);
  }

  async function handleMatch() {
    if (!parsedData) return;
    setIsMatching(true);
    setMatchingOutcome(null);
    setCommitOutcome(null);
    setReplaceConfirmed(false);
    try {
      const result = await matchIngredients(parsedData);
      setMatchingOutcome(result);
      const initial: Record<string, ChoiceState> = {};
      for (const row of result.rows) {
        initial[row.row_id] =
          row.outcome.kind === "exact"
            ? { action: "accept", ingredient_id: row.outcome.candidate.ingredient_id }
            : "unresolved";
      }
      setChoices(initial);
    } catch (e) {
      setMatchingOutcome({ error: (e as Error).message });
      setChoices({});
    } finally {
      setIsMatching(false);
    }
  }

  async function handleCommit() {
    if (!parsedData || !matchingResult) return;
    const ingredientChoices: Record<string, IngredientChoice> = {};
    for (const [rowId, choice] of Object.entries(choices)) {
      if (choice === "unresolved") return;
      if (choice.action === "override" && choice.ingredient_id === null) return;
      if (choice.action === "create_new" && !choice.canonical_name.trim()) return;
      ingredientChoices[rowId] = choice as IngredientChoice;
    }
    setIsCommitting(true);
    setCommitOutcome(null);
    try {
      const result = await commitImport(parsedData, ingredientChoices, replaceConfirmed ? "update" : "fail");
      setCommitOutcome(result);
      if (result.kind === "success") {
        nav({ to: "/meals/$mealId", params: { mealId: String(result.meal_id) } });
      }
    } finally {
      setIsCommitting(false);
    }
  }

  function setChoice(rowId: string, choice: ChoiceState) {
    setChoices((prev) => ({ ...prev, [rowId]: choice }));
  }

  const canValidate = !!lookups.data && text.trim().length > 0;
  const validationSuccess = outcome !== null && outcome !== "parse-error" && outcome.ok;
  const existingMeal: { id: number; name: string } | null =
    outcome !== null && outcome !== "parse-error" && outcome.ok ? outcome.existing_meal : null;

  const matchingResult: MatchingResult | null =
    matchingOutcome && !("error" in matchingOutcome) ? matchingOutcome : null;

  const advisory: AdvisoryResult | null =
    matchingResult && lookups.data && parsedData
      ? evaluateConsistencyAdvisory(
          parsedData as ParsedRecipe,
          matchingResult,
          lookups.data.dietaryCategoryRanks,
          lookups.data.dietaryCategoryCodeById,
        )
      : null;

  const allResolved =
    matchingResult !== null &&
    Object.values(choices).every((c) => {
      if (c === "unresolved") return false;
      if (c.action === "override") return c.ingredient_id !== null;
      if (c.action === "create_new") return c.canonical_name.trim().length > 0;
      return true;
    });

  const lookupLists: LookupLists | null = lookups.data
    ? {
        ingredientCategories: lookups.data.ingredientCategories,
        dietaryCategoryOptions: lookups.data.dietaryCategoryOptions,
      }
    : null;

  const allIngredients = ingredientsQuery.data ?? [];

  if (loading || !isWriter) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← Admin
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

        {/* Match button appears only after a successful validation.
            Smoke scripts: seed textarea, click Validate, wait for green panel,
            then wait for this button before clicking Match. */}
        {validationSuccess && (
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleMatch} disabled={isMatching}>
              Match ingredients
            </Button>
            {isMatching && (
              <span className="text-xs text-muted-foreground">Matching…</span>
            )}
          </div>
        )}

        {matchingOutcome && "error" in matchingOutcome && (
          <div className="mt-6 rounded-md border border-destructive/50 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">
              Matching failed: {matchingOutcome.error}
            </p>
          </div>
        )}

        {existingMeal !== null && matchingResult && (
          <UpsertAdvisoryBanner
            existingMealName={existingMeal.name}
            replaceConfirmed={replaceConfirmed}
            onReplace={() => setReplaceConfirmed(true)}
            onCancel={() => {
              setMatchingOutcome(null);
              setChoices({});
              setReplaceConfirmed(false);
              setCommitOutcome(null);
            }}
          />
        )}

        {advisory?.kind === "fires" && <AdvisoryBanner advisory={advisory} />}

        {matchingResult && lookupLists && (
          <MatchingPanel
            result={matchingResult}
            choices={choices}
            onChoice={setChoice}
            allIngredients={allIngredients}
            lookupLists={lookupLists}
          />
        )}

        {matchingResult && (
          <CommitArea
            parsedData={parsedData}
            allResolved={allResolved}
            replaceRequired={existingMeal !== null && !replaceConfirmed}
            isCommitting={isCommitting}
            commitOutcome={commitOutcome}
            onCommit={handleCommit}
          />
        )}
      </div>
    </div>
  );
}

// ── static display components ─────────────────────────────────────────────────

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

function AdvisoryBanner({ advisory }: { advisory: Extract<AdvisoryResult, { kind: "fires" }> }) {
  return (
    <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-50/50 p-4 dark:border-amber-400/30 dark:bg-amber-950/20">
      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
        Advisory: dietary classification may be too permissive
      </p>
      <p className="mt-1.5 text-sm text-amber-700/90 dark:text-amber-400/90">
        The recipe declares{" "}
        <span className="font-mono">{advisory.declared}</span> as its dietary category. The
        strictest matched ingredient is{" "}
        <span className="font-medium">{advisory.strictest_ingredient_name}</span> (
        <span className="font-mono">{advisory.strictest_category}</span>). The declared category
        is less restrictive than the ingredients allow.
      </p>
    </div>
  );
}

function UpsertAdvisoryBanner({
  existingMealName,
  replaceConfirmed,
  onReplace,
  onCancel,
}: {
  existingMealName: string;
  replaceConfirmed: boolean;
  onReplace: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-6 rounded-md border border-blue-500/40 bg-blue-50/50 p-4 dark:border-blue-400/30 dark:bg-blue-950/20">
      <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
        This will update the existing recipe &ldquo;{existingMealName}&rdquo;. Choose Replace to
        overwrite, or Cancel to abandon this import.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant={replaceConfirmed ? "default" : "outline"}
          onClick={onReplace}
          disabled={replaceConfirmed}
        >
          {replaceConfirmed ? "✓ Replace confirmed" : "Replace existing"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── interactive matching panel ────────────────────────────────────────────────

function MatchingPanel({
  result,
  choices,
  onChoice,
  allIngredients,
  lookupLists,
}: {
  result: MatchingResult;
  choices: Record<string, ChoiceState>;
  onChoice: (rowId: string, choice: ChoiceState) => void;
  allIngredients: { id: number; canonical_name: string }[];
  lookupLists: LookupLists;
}) {
  return (
    <div className="mt-6">
      <p className="mb-2 text-sm font-medium">Ingredient matching</p>
      <div className="divide-y rounded-md border">
        {result.rows.map((match) => (
          <MatchRow
            key={match.row_id}
            match={match}
            choice={choices[match.row_id] ?? "unresolved"}
            onChoice={(c) => onChoice(match.row_id, c)}
            allIngredients={allIngredients}
            lookupLists={lookupLists}
          />
        ))}
      </div>
    </div>
  );
}

function MatchRow({
  match,
  choice,
  onChoice,
  allIngredients,
  lookupLists,
}: {
  match: IngredientMatch;
  choice: ChoiceState;
  onChoice: (choice: ChoiceState) => void;
  allIngredients: { id: number; canonical_name: string }[];
  lookupLists: LookupLists;
}) {
  const { row_id, row_name, outcome } = match;

  return (
    <div className="px-3 py-3 text-sm">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">{`{${row_id}}`}</span>
        <div className="min-w-0 flex-1">
          <span className="font-medium">{row_name}</span>
          <div className="mt-1.5">
            {outcome.kind === "exact" && (
              <ExactRow
                candidate={outcome.candidate}
                choice={choice}
                onChoice={onChoice}
                allIngredients={allIngredients}
                rowName={row_name}
                matchedVariant={match.matched_variant}
              />
            )}
            {outcome.kind === "ambiguous" && (
              <AmbiguousRow
                candidates={outcome.candidates}
                choice={choice}
                onChoice={onChoice}
              />
            )}
            {outcome.kind === "fuzzy" && (
              <FuzzyRow
                candidates={outcome.candidates}
                choice={choice}
                onChoice={onChoice}
                allIngredients={allIngredients}
                lookupLists={lookupLists}
                rowName={row_name}
              />
            )}
            {outcome.kind === "none" && (
              <NoneRow
                choice={choice}
                onChoice={onChoice}
                allIngredients={allIngredients}
                lookupLists={lookupLists}
                rowName={row_name}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ExactRow ──────────────────────────────────────────────────────────────────

function stripAnnotation(rowName: string, matchedVariant: string): string {
  if (rowName.startsWith(matchedVariant)) {
    return `(stripped: "${rowName.slice(matchedVariant.length).trim()}")`;
  }
  if (rowName.endsWith(matchedVariant)) {
    return `(stripped: "${rowName.slice(0, rowName.length - matchedVariant.length).trim()}")`;
  }
  return `(matched as "${matchedVariant}")`;
}

function ExactRow({
  candidate,
  choice,
  onChoice,
  allIngredients,
  rowName,
  matchedVariant,
}: {
  candidate: Candidate;
  choice: ChoiceState;
  onChoice: (c: ChoiceState) => void;
  allIngredients: { id: number; canonical_name: string }[];
  rowName: string;
  matchedVariant?: string;
}) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const isOverride = choice !== "unresolved" && choice.action === "override";
  const overrideId = isOverride
    ? (choice as { action: "override"; ingredient_id: number | null }).ingredient_id
    : null;
  const displayName =
    isOverride && overrideId != null
      ? (allIngredients.find((i) => i.id === overrideId)?.canonical_name ?? candidate.canonical_name)
      : candidate.canonical_name;

  return (
    <div>
      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
        <span className="text-xs">✓</span>
        <span className="text-xs">
          {displayName}
          {!isOverride && candidate.match_type === "exact_alias" && (
            <span className="ml-1 text-muted-foreground">
              (via alias &ldquo;{candidate.matched_text}&rdquo;)
            </span>
          )}
          {!isOverride && matchedVariant && (
            <span className="ml-1 text-muted-foreground">
              {stripAnnotation(rowName, matchedVariant)}
            </span>
          )}
        </span>
        <button
          className="ml-1 text-xs text-muted-foreground underline hover:text-foreground"
          onClick={() => setOverrideOpen((v) => !v)}
        >
          {overrideOpen ? "Cancel" : "Override"}
        </button>
      </div>
      {overrideOpen && (
        <div className="mt-2 ml-4 space-y-1">
          <p className="text-xs text-muted-foreground">Choose a different ingredient:</p>
          <IngredientCombobox
            allIngredients={allIngredients}
            selectedId={overrideId}
            onSelect={(id) => {
              onChoice({ action: "override", ingredient_id: id });
              setOverrideOpen(false);
            }}
          />
          {isOverride && (
            <button
              className="text-xs text-muted-foreground underline"
              onClick={() => {
                onChoice({ action: "accept", ingredient_id: candidate.ingredient_id });
                setOverrideOpen(false);
              }}
            >
              Revert to auto-match
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── AmbiguousRow ──────────────────────────────────────────────────────────────

function AmbiguousRow({
  candidates,
  choice,
  onChoice,
}: {
  candidates: Candidate[];
  choice: ChoiceState;
  onChoice: (c: ChoiceState) => void;
}) {
  const selectedId =
    choice !== "unresolved" && (choice.action === "accept" || choice.action === "override")
      ? String(choice.ingredient_id)
      : "";

  return (
    <div>
      <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1.5">
        Multiple exact matches — pick one:
      </p>
      <RadioGroup
        value={selectedId}
        onValueChange={(v) => onChoice({ action: "accept", ingredient_id: Number(v) })}
        className="space-y-1"
      >
        {candidates.map((c) => (
          <div key={c.ingredient_id} className="flex items-center gap-2">
            <RadioGroupItem value={String(c.ingredient_id)} id={`amb-${c.ingredient_id}`} />
            <Label htmlFor={`amb-${c.ingredient_id}`} className="text-xs font-normal cursor-pointer">
              {c.canonical_name}
              {c.match_type === "exact_alias" && (
                <span className="ml-1 text-muted-foreground">(via alias &ldquo;{c.matched_text}&rdquo;)</span>
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

// ── FuzzyRow ──────────────────────────────────────────────────────────────────

function FuzzyRow({
  candidates,
  choice,
  onChoice,
  allIngredients,
  lookupLists,
  rowName,
}: {
  candidates: Candidate[];
  choice: ChoiceState;
  onChoice: (c: ChoiceState) => void;
  allIngredients: { id: number; canonical_name: string }[];
  lookupLists: LookupLists;
  rowName: string;
}) {
  const radioValue =
    choice === "unresolved"
      ? ""
      : choice.action === "accept"
      ? String(choice.ingredient_id)
      : choice.action; // "override" or "create_new"

  function handleRadio(v: string) {
    if (v === "override") {
      onChoice({ action: "override", ingredient_id: null });
    } else if (v === "create_new") {
      onChoice({ action: "create_new", canonical_name: rowName, default_unit: null, category_id: null, dietary_category_id: null });
    } else {
      onChoice({ action: "accept", ingredient_id: Number(v) });
    }
  }

  return (
    <div>
      <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1.5">
        Fuzzy match — pick one:
      </p>
      <RadioGroup value={radioValue} onValueChange={handleRadio} className="space-y-1.5">
        {candidates.map((c) => (
          <div key={c.ingredient_id} className="flex items-center gap-2">
            <RadioGroupItem value={String(c.ingredient_id)} id={`fz-${c.ingredient_id}`} />
            <Label htmlFor={`fz-${c.ingredient_id}`} className="text-xs font-normal cursor-pointer">
              {c.canonical_name}{" "}
              <span className="tabular-nums text-muted-foreground">({c.similarity_score.toFixed(2)})</span>
              {c.match_type === "fuzzy_alias" && (
                <span className="ml-1 text-muted-foreground opacity-70">alias: {c.matched_text}</span>
              )}
            </Label>
          </div>
        ))}

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="override" id="fz-override" />
            <Label htmlFor="fz-override" className="text-xs font-normal cursor-pointer">
              Choose a different existing ingredient
            </Label>
          </div>
          {radioValue === "override" && choice !== "unresolved" && choice.action === "override" && (
            <div className="ml-6">
              <IngredientCombobox
                allIngredients={allIngredients}
                selectedId={choice.ingredient_id}
                onSelect={(id) => onChoice({ action: "override", ingredient_id: id })}
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="create_new" id="fz-create" />
            <Label htmlFor="fz-create" className="text-xs font-normal cursor-pointer">
              Create new ingredient
            </Label>
          </div>
          {radioValue === "create_new" && choice !== "unresolved" && choice.action === "create_new" && (
            <div className="ml-6">
              <CreateNewForm
                value={{ canonical_name: choice.canonical_name, default_unit: choice.default_unit, category_id: choice.category_id, dietary_category_id: choice.dietary_category_id }}
                lookupLists={lookupLists}
                onChange={(v) => onChoice({ action: "create_new", ...v })}
              />
            </div>
          )}
        </div>
      </RadioGroup>
    </div>
  );
}

// ── NoneRow ───────────────────────────────────────────────────────────────────

function NoneRow({
  choice,
  onChoice,
  allIngredients,
  lookupLists,
  rowName,
}: {
  choice: ChoiceState;
  onChoice: (c: ChoiceState) => void;
  allIngredients: { id: number; canonical_name: string }[];
  lookupLists: LookupLists;
  rowName: string;
}) {
  const radioValue =
    choice === "unresolved"
      ? ""
      : choice.action === "override"
      ? "override"
      : "create_new";

  function handleRadio(v: string) {
    if (v === "override") {
      onChoice({ action: "override", ingredient_id: null });
    } else {
      onChoice({ action: "create_new", canonical_name: rowName, default_unit: null, category_id: null, dietary_category_id: null });
    }
  }

  return (
    <div>
      <p className="text-xs text-destructive/80 mb-1.5">No match — choose or create:</p>
      <RadioGroup value={radioValue} onValueChange={handleRadio} className="space-y-1.5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="override" id="none-override" />
            <Label htmlFor="none-override" className="text-xs font-normal cursor-pointer">
              Choose an existing ingredient
            </Label>
          </div>
          {radioValue === "override" && choice !== "unresolved" && choice.action === "override" && (
            <div className="ml-6">
              <IngredientCombobox
                allIngredients={allIngredients}
                selectedId={choice.ingredient_id}
                onSelect={(id) => onChoice({ action: "override", ingredient_id: id })}
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="create_new" id="none-create" />
            <Label htmlFor="none-create" className="text-xs font-normal cursor-pointer">
              Create new ingredient
            </Label>
          </div>
          {radioValue === "create_new" && choice !== "unresolved" && choice.action === "create_new" && (
            <div className="ml-6">
              <CreateNewForm
                value={{ canonical_name: choice.canonical_name, default_unit: choice.default_unit, category_id: choice.category_id, dietary_category_id: choice.dietary_category_id }}
                lookupLists={lookupLists}
                onChange={(v) => onChoice({ action: "create_new", ...v })}
              />
            </div>
          )}
        </div>
      </RadioGroup>
    </div>
  );
}

// ── IngredientCombobox ────────────────────────────────────────────────────────

function IngredientCombobox({
  allIngredients,
  selectedId,
  onSelect,
}: {
  allIngredients: { id: number; canonical_name: string }[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = allIngredients
    .filter((i) => i.canonical_name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 60);
  const selected = selectedId != null ? allIngredients.find((i) => i.id === selectedId) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="rounded border px-2 py-1 text-xs text-left hover:bg-muted w-52 truncate">
          {selected ? selected.canonical_name : "Choose ingredient…"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput
            placeholder="Search…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            {filtered.map((i) => (
              <CommandItem
                key={i.id}
                value={i.canonical_name}
                onSelect={() => {
                  onSelect(i.id);
                  setSearch("");
                  setOpen(false);
                }}
              >
                {i.canonical_name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── CreateNewForm (controlled) ────────────────────────────────────────────────

function CreateNewForm({
  value,
  lookupLists,
  onChange,
}: {
  value: CreateNewValues;
  lookupLists: LookupLists;
  onChange: (v: CreateNewValues) => void;
}) {
  function update<K extends keyof CreateNewValues>(key: K, val: CreateNewValues[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="space-y-2 rounded border p-2.5 bg-muted/30 text-xs">
      <div>
        <Label className="text-xs mb-0.5 block">Name *</Label>
        <Input
          value={value.canonical_name}
          onChange={(e) => update("canonical_name", e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <div>
        <Label className="text-xs mb-0.5 block">Default unit</Label>
        <Input
          value={value.default_unit ?? ""}
          onChange={(e) => update("default_unit", e.target.value || null)}
          className="h-7 text-xs"
          placeholder="g, ml, tbsp…"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs mb-0.5 block">Category</Label>
          <Select
            value={value.category_id != null ? String(value.category_id) : NONE}
            onValueChange={(v) => update("category_id", v === NONE ? null : Number(v))}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {lookupLists.ingredientCategories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-0.5 block">Dietary</Label>
          <Select
            value={value.dietary_category_id != null ? String(value.dietary_category_id) : NONE}
            onValueChange={(v) => update("dietary_category_id", v === NONE ? null : Number(v))}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {lookupLists.dietaryCategoryOptions.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ── CommitArea ────────────────────────────────────────────────────────────────

function CommitArea({
  parsedData,
  allResolved,
  replaceRequired,
  isCommitting,
  commitOutcome,
  onCommit,
}: {
  parsedData: unknown;
  allResolved: boolean;
  replaceRequired: boolean;
  isCommitting: boolean;
  commitOutcome: CommitOutcome | null;
  onCommit: () => void;
}) {
  const doc = parsedData as { import_type?: string; derived_components?: unknown[] } | null;
  const importType = doc?.import_type;
  const hasDerivedComponents =
    Array.isArray(doc?.derived_components) && doc.derived_components.length > 0;

  if (importType !== "recipe") {
    return (
      <div className="mt-6 rounded-md border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium">Component import lands in F3</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This slice ships recipe-only. No Commit button until F3.
        </p>
      </div>
    );
  }

  if (hasDerivedComponents) {
    return (
      <div className="mt-6 rounded-md border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium">Derived component import lands in F3</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Strip the <span className="font-mono">derived_components</span> array and re-import to land the parent recipe.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {commitOutcome && commitOutcome.kind !== "success" && (
        <CommitErrorPanel outcome={commitOutcome} />
      )}
      <Button onClick={onCommit} disabled={!allResolved || replaceRequired || isCommitting}>
        {isCommitting
          ? "Committing…"
          : !allResolved
          ? "Commit (resolve all rows first)"
          : "Commit"}
      </Button>
      {allResolved && replaceRequired && !isCommitting && (
        <p className="text-xs text-muted-foreground">Confirm Replace above to enable commit.</p>
      )}
    </div>
  );
}

function CommitErrorPanel({ outcome }: { outcome: Exclude<CommitOutcome, { kind: "success" }> }) {
  let message: string;
  if (outcome.kind === "duplicate_external_ref") {
    message = "An import with this external_ref already exists. Try paste again — the recipe may have been imported by someone else just now.";
  } else if (outcome.kind === "duplicate_ingredient_name") {
    message = outcome.name !== null
      ? `An ingredient called "${outcome.name}" already exists. Choose it from the existing-ingredient picker instead.`
      : "An ingredient you tried to create already exists. Choose it from the existing-ingredient picker instead.";
  } else {
    message = outcome.message;
  }
  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
