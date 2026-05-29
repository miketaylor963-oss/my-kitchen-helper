import { createFileRoute, Link } from "@tanstack/react-router";
import { adminSections } from "@/lib/nav";

export const Route = createFileRoute("/admin/")({
  component: AdminIndex,
});

function AdminIndex() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage ingredients, run imports, and other reference data.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {adminSections.map((s) => (
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
