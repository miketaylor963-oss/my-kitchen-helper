import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { MealForm, emptyMeal } from "@/components/meal-form";
import { useIsWriter } from "@/lib/auth";

export const Route = createFileRoute("/meals/new")({ component: NewMealPage });

function NewMealPage() {
  const { isWriter, loading, user } = useIsWriter();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/meals" className="text-sm text-muted-foreground hover:text-foreground">← Meals</Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">New meal</h1>
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Checking access…</p>
          ) : !isWriter ? (
            <p className="text-sm text-destructive">You don't have writer access on this household.</p>
          ) : (
            <MealForm initial={emptyMeal} />
          )}
        </div>
      </div>
    </div>
  );
}