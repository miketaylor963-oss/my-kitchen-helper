export const mainSections = [
  { to: "/meals" as const, title: "Meals", description: "Browse and search your meal library." },
  { to: "/components" as const, title: "Components", description: "Reusable building blocks like sauces and bases." },
  { to: "/meal-plans" as const, title: "Meal Plans", description: "Plan a week of meals by date and diner." },
  { to: "/shopping-lists" as const, title: "Shopping Lists", description: "Generate shopping lists from a plan." },
];

export const adminSections = [
  { to: "/admin/ingredients" as const, title: "Ingredients", description: "Manage the ingredient master and reference data." },
  { to: "/admin/import" as const, title: "Import", description: "Validate and import recipe and component JSON." },
];
