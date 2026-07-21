import type { FormEvent, ReactNode } from "react";
import { Loader2 } from "@zatgo/icons";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Input } from "./input";
import { Label } from "./label";

/** Shared text-field class for ERPNext login and connection forms. */
export const erpnextFieldClass =
  "h-10 w-full rounded-[var(--radius-lg)] border border-[var(--color-input)] bg-transparent px-3 text-sm outline-none focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]/30";

export type ErpnextLoginCardProps = {
  productTitle: string;
  brandLabel?: string;
  subtitle?: string;
  footerHint?: ReactNode;
  usr: string;
  pwd: string;
  busy?: boolean;
  error?: string | null;
  onUsrChange: (value: string) => void;
  onPwdChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onTestSite?: () => void;
};

/**
 * Presentational ERPNext password login card.
 * Apps wire session/BFF/IPC and pass controlled fields.
 */
export function ErpnextLoginCard({
  productTitle,
  brandLabel = "ZatGo",
  subtitle = "Sign in with your ERPNext / Frappe site account.",
  footerHint,
  usr,
  pwd,
  busy,
  error,
  onUsrChange,
  onPwdChange,
  onSubmit,
  onTestSite,
}: ErpnextLoginCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4 text-[var(--color-foreground)]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {brandLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{productTitle}</h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{subtitle}</p>
        </div>
        <Card>
          <CardContent className="p-5">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="zatgo-login-usr">Email / User</Label>
                <Input
                  id="zatgo-login-usr"
                  value={usr}
                  onChange={(e) => onUsrChange(e.target.value)}
                  placeholder="user@example.com"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zatgo-login-pwd">Password</Label>
                <Input
                  id="zatgo-login-pwd"
                  type="password"
                  value={pwd}
                  onChange={(e) => onPwdChange(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Sign in
              </Button>
              {onTestSite ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={onTestSite}
                  disabled={busy}
                >
                  Test site
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>
        {footerHint ? (
          <p className="text-center text-xs text-[var(--color-muted-foreground)]">{footerHint}</p>
        ) : null}
      </div>
    </div>
  );
}
