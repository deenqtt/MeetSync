"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

export function ManageHeaderButton() {
  const pathname = usePathname();
  const show = pathname === "/" || pathname.startsWith("/dashboard/");
  if (!show) return null;

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2.5"
    >
      <Link href="/dashboard/manage">
        <Settings className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-xs font-medium">Manage</span>
      </Link>
    </Button>
  );
}
