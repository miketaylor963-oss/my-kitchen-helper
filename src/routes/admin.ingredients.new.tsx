import { createFileRoute, Link } from "@tanstack/react-router";
import { IngredientForm, emptyIngredient } from "@/components/ingredient-form";
import { useIsWriter } from "@/lib/auth";

export const Route = createFileRoute("/admin/ingredients/new")({
  component: NewIngredientPage,
});

function AccessPanel({ user }: { user: { id: string } | null }) {
  return (
    <div className="rounded-md border p-6 text-sm text-muted-foreground">
      {!user ? (
        <>
          <Link
            to="/login"
            className="text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>{" "}
          to edit.
        </>
      ) : (
        "You don't have writer access on this household."
      )}
    </div>
  );
}

function NewIngredientPage() {
  const { user, isWriter, loading } = useIsWriter();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/admin/ingredients"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Ingredients
        </Link>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Admin / Ingredients
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            New ingredient
          </h1>
        </div>
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Checking access…</p>
          ) : !isWriter ? (
            <AccessPanel user={user} />
          ) : (
            <IngredientForm initial={emptyIngredient} />
          )}
        </div>
      </div>
    </div>
  );
}
