import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/components")({
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">components</h1>
        <p className="mt-2 text-sm text-muted-foreground">Coming soon.</p>
      </div>
    </div>
  );
}
