import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { mainSections, adminSections } from "@/lib/nav";

const deskActive = "px-3 py-1.5 rounded-md text-sm text-foreground font-medium";
const deskInactive = "px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors";
const mobileActive = "block w-full rounded-md px-3 py-2 text-sm text-foreground font-medium";
const mobileInactive = "block w-full rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors";
const mobileIndentActive = "block w-full rounded-md py-2 pl-7 pr-3 text-sm text-foreground font-medium";
const mobileIndentInactive = "block w-full rounded-md py-2 pl-7 pr-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors";

export function GlobalNav() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const close = () => setSheetOpen(false);

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link to="/" className="text-lg font-semibold text-foreground">
          Household Kitchen
        </Link>

        {/* Desktop nav — md and above */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: deskActive }}
            inactiveProps={{ className: deskInactive }}
          >
            Home
          </Link>
          {mainSections.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              activeProps={{ className: deskActive }}
              inactiveProps={{ className: deskInactive }}
            >
              {s.title}
            </Link>
          ))}

          {/* Admin label + chevron flyout */}
          <DropdownMenu modal={false}>
            <div className="flex items-center">
              <Link
                to="/admin"
                activeOptions={{ exact: false }}
                activeProps={{ className: deskActive }}
                inactiveProps={{ className: deskInactive }}
              >
                Admin
              </Link>
              <DropdownMenuTrigger asChild>
                <button
                  className="ml-0.5 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="Toggle admin menu"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
            </div>
            <DropdownMenuContent align="end">
              {adminSections.map((s) => (
                <DropdownMenuItem key={s.to} asChild>
                  <Link to={s.to}>{s.title}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Mobile hamburger — below md */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              className="md:hidden rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 pt-10">
            <nav className="flex flex-col gap-0.5" aria-label="Mobile navigation">
              <Link
                to="/"
                activeOptions={{ exact: true }}
                activeProps={{ className: mobileActive }}
                inactiveProps={{ className: mobileInactive }}
                onClick={close}
              >
                Home
              </Link>
              {mainSections.map((s) => (
                <Link
                  key={s.to}
                  to={s.to}
                  activeProps={{ className: mobileActive }}
                  inactiveProps={{ className: mobileInactive }}
                  onClick={close}
                >
                  {s.title}
                </Link>
              ))}
              <div className="mt-2 border-t pt-2">
                <Link
                  to="/admin"
                  activeOptions={{ exact: false }}
                  activeProps={{ className: mobileActive }}
                  inactiveProps={{ className: mobileInactive }}
                  onClick={close}
                >
                  Admin
                </Link>
                {adminSections.map((s) => (
                  <Link
                    key={s.to}
                    to={s.to}
                    activeProps={{ className: mobileIndentActive }}
                    inactiveProps={{ className: mobileIndentInactive }}
                    onClick={close}
                  >
                    {s.title}
                  </Link>
                ))}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
