import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

const sections = [
  { to: "/meals", title: "Meals", description: "Browse and search your meal library." },
  { to: "/components", title: "Components", description: "Reusable building blocks like sauces and bases." },
  { to: "/meal-plans", title: "Meal Plans", description: "Plan a week of meals by date and diner." },
  { to: "/shopping-lists", title: "Shopping Lists", description: "Generate shopping lists from a plan." },
] as const;

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Household Kitchen</h1>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            {sections.map((s) => (
              <Link key={s.to} to={s.to} className="hover:text-foreground">
                {s.title}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A recipe and meal planning app for your household. Pick a section to get started.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {sections.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="block rounded-lg border p-5 hover:bg-accent transition-colors"
            >
              <div className="font-medium">{s.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.description}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
