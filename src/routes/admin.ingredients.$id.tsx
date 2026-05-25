import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/ingredients/$id")({
  component: () => <Outlet />,
});
