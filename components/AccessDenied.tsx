"use client";

import { Button } from "@/components/ui/button";
import { Lock, Home, RefreshCw } from "lucide-react";
import Link from "next/link";

interface AccessDeniedProps {
  title?: string;
  message?: string;
  showActions?: boolean;
  onRetry?: () => void;
}

// Single-login standalone app has no RBAC, so this is rarely rendered. Kept as
// a slim stub (no AuthContext dependency) so ported pages that still import it
// continue to compile and render.
export default function AccessDenied({
  title = "Access Denied",
  message = "You cannot access this page.",
  showActions = true,
  onRetry,
}: AccessDeniedProps) {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-br from-background to-muted/20">
      <div className="bg-card border border-border shadow-2xl rounded-3xl p-8 max-w-lg w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-destructive/20 rounded-full animate-ping"></div>
            <div className="relative bg-destructive/10 p-4 rounded-full">
              <Lock size={64} className="text-destructive animate-pulse" />
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-3 text-foreground">{title}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">{message}</p>

        {showActions && (
          <div className="flex flex-col sm:flex-row gap-3">
            {onRetry && (
              <Button onClick={onRetry} className="flex-1 flex items-center gap-2 h-11" size="lg">
                Try Again
              </Button>
            )}
            <Button onClick={handleRefresh} className="flex-1 flex items-center gap-2 h-11" size="lg" variant="secondary">
              <RefreshCw size={18} />
              Refresh
            </Button>
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full flex items-center gap-2 h-11" size="lg">
                <Home size={18} />
                Go Home
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
