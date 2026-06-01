export type ValidationError = { path: string; message: string };

export type DerivedSummary = {
  name: string;
  ingredient_count: number;
  step_count: number;
};

export type ImportSummary = {
  import_type: "recipe" | "component";
  name: string;
  cuisine: string | null;
  dietary_category: string | null;
  dietary_restrictions: string[];
  nutritional_tags: string[];
  ingredient_count: number;
  step_count: number;
  derived_components: DerivedSummary[];
};

export type ValidationResult =
  | { ok: true; summary: ImportSummary; existing_meal: { id: number; name: string } | null }
  | { ok: false; errors: ValidationError[] };

// framework_code → layer_code → Set of valid family codes (empty Set = no families for this layer)
export type FrameworkLookup = Map<string, Map<string, Set<string>>>;

export type LookupSets = {
  cuisineCodes: Set<string>;
  dietaryCategoryCodes: Set<string>;
  dietaryRestrictionCodes: Set<string>;
  nutritionalTagCodes: Set<string>;
  mealTypeCodes: Set<string>;
  mealFormatCodes: Set<string>;
  frameworkLayers: FrameworkLookup;
};

const KNOWN_TOP_LEVEL_KEYS = new Set([
  "import_type", "external_ref", "name", "description", "source", "notes",
  "cuisine", "dietary_category", "dietary_restrictions", "nutritional_tags",
  "protein_g", "carbs_g", "gi_index",
  "meal_types", "meal_formats", "component_layers",
  "base_servings", "prep_time_minutes", "cook_time_minutes",
  "ingredients", "steps", "derived_components",
]);

const EXTERNAL_REF_RE = /^[a-z0-9-]+$/;
const INGREDIENT_ID_RE = /^[0-9]{4}$/;

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function isNonNegNum(v: unknown): v is number {
  return typeof v === "number" && isFinite(v) && v >= 0;
}

function checkCode(value: unknown, path: string, valid: Set<string>, errs: ValidationError[]): void {
  if (value === null || value === undefined) return;
  if (value === "") { errs.push({ path, message: "Empty string is not a valid code" }); return; }
  if (typeof value !== "string") { errs.push({ path, message: "Must be a string code or null" }); return; }
  if (!valid.has(value)) errs.push({ path, message: `Unknown code "${value}"` });
}

function checkCodeArr(arr: unknown, path: string, valid: Set<string>, errs: ValidationError[]): void {
  if (arr === null || arr === undefined) return;
  if (!Array.isArray(arr)) { errs.push({ path, message: "Must be an array" }); return; }
  (arr as unknown[]).forEach((code, i) => {
    if (typeof code !== "string" || code === "")
      errs.push({ path: `${path}[${i}]`, message: "Must be a non-empty string code" });
    else if (!valid.has(code))
      errs.push({ path: `${path}[${i}]`, message: `Unknown code "${code}"` });
  });
}

function checkLayersArr(layers: unknown, path: string, fw: FrameworkLookup, errs: ValidationError[]): void {
  if (layers === null || layers === undefined) return;
  if (!Array.isArray(layers)) { errs.push({ path, message: "Must be an array" }); return; }
  (layers as unknown[]).forEach((entry, i) => {
    const p = `${path}[${i}]`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      errs.push({ path: p, message: "Must be an object" }); return;
    }
    const e = entry as Record<string, unknown>;
    const fwCode = e.framework;
    const lyrCode = e.layer;
    const famCode = e.family;

    if (typeof fwCode !== "string" || fwCode === "") {
      errs.push({ path: `${p}.framework`, message: "Required non-empty string" }); return;
    }
    const layerMap = fw.get(fwCode);
    if (!layerMap) {
      errs.push({ path: `${p}.framework`, message: `Unknown framework "${fwCode}"` }); return;
    }
    if (typeof lyrCode !== "string" || lyrCode === "") {
      errs.push({ path: `${p}.layer`, message: "Required non-empty string" }); return;
    }
    const familySet = layerMap.get(lyrCode);
    if (familySet === undefined) {
      errs.push({ path: `${p}.layer`, message: `Unknown layer "${lyrCode}" in framework "${fwCode}"` }); return;
    }
    if (famCode !== null && famCode !== undefined) {
      if (typeof famCode !== "string" || famCode === "")
        errs.push({ path: `${p}.family`, message: "Must be a non-empty string or null" });
      else if (familySet.size === 0)
        errs.push({ path: `${p}.family`, message: `Layer "${lyrCode}" has no families — family must be null` });
      else if (!familySet.has(famCode))
        errs.push({ path: `${p}.family`, message: `Unknown family "${famCode}" for layer "${lyrCode}"` });
    }
  });
}

function checkClassification(
  obj: Record<string, unknown>,
  prefix: string,
  lookups: LookupSets,
  errs: ValidationError[],
): void {
  checkCode(obj.cuisine, `${prefix}cuisine`, lookups.cuisineCodes, errs);
  checkCode(obj.dietary_category, `${prefix}dietary_category`, lookups.dietaryCategoryCodes, errs);
  checkCodeArr(obj.dietary_restrictions, `${prefix}dietary_restrictions`, lookups.dietaryRestrictionCodes, errs);
  checkCodeArr(obj.nutritional_tags, `${prefix}nutritional_tags`, lookups.nutritionalTagCodes, errs);
}

export function validate(data: unknown, lookups: LookupSets): ValidationResult {
  const errs: ValidationError[] = [];

  if (typeof data !== "object" || data === null || Array.isArray(data))
    return { ok: false, errors: [{ path: "", message: "Top-level value must be a JSON object" }] };
  const doc = data as Record<string, unknown>;

  // Unknown top-level keys (allow _-prefixed metadata keys)
  for (const key of Object.keys(doc))
    if (!key.startsWith("_") && !KNOWN_TOP_LEVEL_KEYS.has(key))
      errs.push({ path: key, message: `Unknown field "${key}"` });

  // import_type
  const importType = doc.import_type;
  if (importType !== "recipe" && importType !== "component")
    errs.push({ path: "import_type", message: 'Must be "recipe" or "component"' });
  const isRecipe = importType === "recipe";
  const isComponent = importType === "component";

  // external_ref
  const externalRef = doc.external_ref;
  if (typeof externalRef !== "string" || externalRef === "")
    errs.push({ path: "external_ref", message: "Required non-empty string" });
  else if (!EXTERNAL_REF_RE.test(externalRef))
    errs.push({ path: "external_ref", message: "Must match ^[a-z0-9-]+$ (lowercase, hyphens, digits only)" });

  // name
  if (typeof doc.name !== "string" || (doc.name as string).trim() === "")
    errs.push({ path: "name", message: "Required non-empty string" });

  // base_servings is optional — spec type is integer | null
  if (doc.base_servings !== undefined && doc.base_servings !== null && !isPositiveInt(doc.base_servings))
    errs.push({ path: "base_servings", message: "Must be a positive integer when set" });

  // Nullable numeric fields (positive integer when set)
  for (const f of ["prep_time_minutes", "cook_time_minutes", "gi_index"] as const) {
    const v = doc[f];
    if (v !== null && v !== undefined && !isPositiveInt(v))
      errs.push({ path: f, message: "Must be a positive integer or null" });
  }
  if (doc.protein_g !== null && doc.protein_g !== undefined && !isNonNegNum(doc.protein_g))
    errs.push({ path: "protein_g", message: "Must be a non-negative number or null" });
  if (doc.carbs_g !== null && doc.carbs_g !== undefined && !isNonNegNum(doc.carbs_g))
    errs.push({ path: "carbs_g", message: "Must be a non-negative number or null" });

  // Top-level classification codes
  checkClassification(doc, "", lookups, errs);

  // Recipe-only codes
  if (isRecipe) {
    checkCodeArr(doc.meal_types, "meal_types", lookups.mealTypeCodes, errs);
    checkCodeArr(doc.meal_formats, "meal_formats", lookups.mealFormatCodes, errs);
  }

  // Cross-shape constraints
  if (isRecipe) {
    const cl = doc.component_layers;
    if (Array.isArray(cl) && (cl as unknown[]).length > 0)
      errs.push({ path: "component_layers", message: 'Must be empty for import_type "recipe" — use derived_components instead' });
    else if (cl !== null && cl !== undefined && !Array.isArray(cl))
      errs.push({ path: "component_layers", message: "Must be an array" });
  }
  if (isComponent) {
    if (Array.isArray(doc.meal_types) && (doc.meal_types as unknown[]).length > 0)
      errs.push({ path: "meal_types", message: 'Must be empty for import_type "component"' });
    if (Array.isArray(doc.meal_formats) && (doc.meal_formats as unknown[]).length > 0)
      errs.push({ path: "meal_formats", message: 'Must be empty for import_type "component"' });
    if (Array.isArray(doc.derived_components) && (doc.derived_components as unknown[]).length > 0)
      errs.push({ path: "derived_components", message: 'Must be empty for import_type "component"' });
    checkLayersArr(doc.component_layers, "component_layers", lookups.frameworkLayers, errs);
  }

  // Ingredients — collect valid ids for placeholder + derived checks
  const ingredientIds = new Set<string>();
  const ings = doc.ingredients;
  if (!Array.isArray(ings) || (ings as unknown[]).length === 0) {
    errs.push({ path: "ingredients", message: Array.isArray(ings) ? "Must contain at least one ingredient" : "Required array" });
  } else {
    (ings as unknown[]).forEach((ing, i) => {
      const p = `ingredients[${i}]`;
      if (typeof ing !== "object" || ing === null || Array.isArray(ing)) {
        errs.push({ path: p, message: "Must be an object" }); return;
      }
      const obj = ing as Record<string, unknown>;
      const id = obj.id;
      if (typeof id !== "string" || !INGREDIENT_ID_RE.test(id))
        errs.push({ path: `${p}.id`, message: "Must match ^[0-9]{4}$ (4-digit zero-padded)" });
      else if (ingredientIds.has(id))
        errs.push({ path: `${p}.id`, message: `Duplicate ingredient id "${id}"` });
      else
        ingredientIds.add(id);
      if (typeof obj.name !== "string" || (obj.name as string).trim() === "")
        errs.push({ path: `${p}.name`, message: "Required non-empty string" });
    });
  }

  // Steps
  const stepsArr = doc.steps;
  const stepCount = Array.isArray(stepsArr) ? (stepsArr as unknown[]).length : 0;
  if (!Array.isArray(stepsArr) || stepCount === 0) {
    errs.push({ path: "steps", message: Array.isArray(stepsArr) ? "Must contain at least one step" : "Required array" });
  } else {
    (stepsArr as unknown[]).forEach((step, i) => {
      const p = `steps[${i}]`;
      if (typeof step !== "object" || step === null || Array.isArray(step)) {
        errs.push({ path: p, message: "Must be an object" }); return;
      }
      const s = step as Record<string, unknown>;
      if (typeof s.title !== "string" || (s.title as string).trim() === "")
        errs.push({ path: `${p}.title`, message: "Required non-empty string" });
      if (typeof s.content !== "string") {
        errs.push({ path: `${p}.content`, message: "Required string" });
      } else {
        // Strict {NNNN} placeholder matching — near-miss forms are literal text, not errors
        for (const match of (s.content as string).matchAll(/\{([0-9]{4})\}/g)) {
          const ph = match[1];
          if (ph && !ingredientIds.has(ph))
            errs.push({ path: `${p}.content`, message: `Placeholder {${ph}} does not reference a valid ingredient id` });
        }
      }
      if (s.timer_seconds !== null && s.timer_seconds !== undefined && !isPositiveInt(s.timer_seconds))
        errs.push({ path: `${p}.timer_seconds`, message: "Must be a positive integer or null" });
    });
  }

  // Derived components (recipe only; cross-shape constraint already blocks the component case)
  const derivedArr = doc.derived_components;
  if (isRecipe && Array.isArray(derivedArr) && (derivedArr as unknown[]).length > 0) {
    const parentRef = typeof externalRef === "string" ? externalRef : null;
    const seenDerivedRefs = new Set<string>();

    (derivedArr as unknown[]).forEach((dc, i) => {
      const p = `derived_components[${i}]`;
      if (typeof dc !== "object" || dc === null || Array.isArray(dc)) {
        errs.push({ path: p, message: "Must be an object" }); return;
      }
      const d = dc as Record<string, unknown>;

      const dRef = d.external_ref;
      if (typeof dRef !== "string" || dRef === "")
        errs.push({ path: `${p}.external_ref`, message: "Required non-empty string" });
      else if (!EXTERNAL_REF_RE.test(dRef))
        errs.push({ path: `${p}.external_ref`, message: "Must match ^[a-z0-9-]+$" });
      else if (dRef === parentRef)
        errs.push({ path: `${p}.external_ref`, message: `Must differ from parent external_ref "${parentRef}"` });
      else if (seenDerivedRefs.has(dRef))
        errs.push({ path: `${p}.external_ref`, message: `Duplicate derived external_ref "${dRef}"` });
      else
        seenDerivedRefs.add(dRef);

      if (typeof d.name !== "string" || (d.name as string).trim() === "")
        errs.push({ path: `${p}.name`, message: "Required non-empty string" });

      if (d.base_servings !== undefined && d.base_servings !== null && !isPositiveInt(d.base_servings))
        errs.push({ path: `${p}.base_servings`, message: "Must be a positive integer when set" });

      for (const f of ["prep_time_minutes", "cook_time_minutes", "gi_index"] as const) {
        const v = d[f];
        if (v !== null && v !== undefined && !isPositiveInt(v))
          errs.push({ path: `${p}.${f}`, message: "Must be a positive integer or null" });
      }
      if (d.protein_g !== null && d.protein_g !== undefined && !isNonNegNum(d.protein_g))
        errs.push({ path: `${p}.protein_g`, message: "Must be a non-negative number or null" });
      if (d.carbs_g !== null && d.carbs_g !== undefined && !isNonNegNum(d.carbs_g))
        errs.push({ path: `${p}.carbs_g`, message: "Must be a non-negative number or null" });

      // Classification codes on derived component
      checkClassification(d, `${p}.`, lookups, errs);
      checkLayersArr(d.component_layers, `${p}.component_layers`, lookups.frameworkLayers, errs);

      const iids = d.ingredient_ids;
      if (!Array.isArray(iids) || (iids as unknown[]).length === 0) {
        errs.push({ path: `${p}.ingredient_ids`, message: Array.isArray(iids) ? "Must contain at least one entry" : "Required array" });
      } else {
        const seenIids = new Set<string>();
        (iids as unknown[]).forEach((id, j) => {
          if (typeof id !== "string")
            errs.push({ path: `${p}.ingredient_ids[${j}]`, message: "Must be a string" });
          else if (!ingredientIds.has(id))
            errs.push({ path: `${p}.ingredient_ids[${j}]`, message: `"${id}" does not reference a valid parent ingredient id` });
          else if (seenIids.has(id))
            errs.push({ path: `${p}.ingredient_ids[${j}]`, message: `Duplicate ingredient_id "${id}"` });
          else
            seenIids.add(id);
        });
      }

      const sids = d.step_indices;
      if (!Array.isArray(sids) || (sids as unknown[]).length === 0) {
        errs.push({ path: `${p}.step_indices`, message: Array.isArray(sids) ? "Must contain at least one entry" : "Required array" });
      } else {
        const seenSids = new Set<number>();
        (sids as unknown[]).forEach((idx, j) => {
          if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0)
            errs.push({ path: `${p}.step_indices[${j}]`, message: "Must be a non-negative integer" });
          else if (idx >= stepCount)
            errs.push({ path: `${p}.step_indices[${j}]`, message: `${idx} is out of range — parent has ${stepCount} step${stepCount === 1 ? "" : "s"} (0-indexed)` });
          else if (seenSids.has(idx))
            errs.push({ path: `${p}.step_indices[${j}]`, message: `Duplicate step_index ${idx}` });
          else
            seenSids.add(idx);
        });
      }
    });
  }

  if (errs.length > 0) return { ok: false, errors: errs };

  // Build success summary
  const derivedSummary: DerivedSummary[] = [];
  if (Array.isArray(derivedArr)) {
    (derivedArr as unknown[]).forEach((dc) => {
      if (typeof dc === "object" && dc !== null && !Array.isArray(dc)) {
        const d = dc as Record<string, unknown>;
        derivedSummary.push({
          name: typeof d.name === "string" ? d.name : "",
          ingredient_count: Array.isArray(d.ingredient_ids) ? (d.ingredient_ids as unknown[]).length : 0,
          step_count: Array.isArray(d.step_indices) ? (d.step_indices as unknown[]).length : 0,
        });
      }
    });
  }

  return {
    ok: true,
    existing_meal: null,
    summary: {
      import_type: importType as "recipe" | "component",
      name: doc.name as string,
      cuisine: typeof doc.cuisine === "string" && doc.cuisine !== "" ? doc.cuisine : null,
      dietary_category: typeof doc.dietary_category === "string" && doc.dietary_category !== "" ? doc.dietary_category : null,
      dietary_restrictions: Array.isArray(doc.dietary_restrictions)
        ? (doc.dietary_restrictions as unknown[]).filter((r): r is string => typeof r === "string")
        : [],
      nutritional_tags: Array.isArray(doc.nutritional_tags)
        ? (doc.nutritional_tags as unknown[]).filter((t): t is string => typeof t === "string")
        : [],
      ingredient_count: ingredientIds.size,
      step_count: stepCount,
      derived_components: derivedSummary,
    },
  };
}
