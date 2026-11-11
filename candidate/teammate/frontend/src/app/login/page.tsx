"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { KeyRound, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loginDemoUser } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: loginDemoUser,
    onSuccess: ({ user }) => {
      queryClient.setQueryData(["current-user"], user);
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const next = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/dashboard";
      router.replace(next);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate({ username: username.trim(), password });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Snowflake className="size-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">TrustLedger</p>
            <p className="text-sm text-muted-foreground">Cold-chain investigation prototype</p>
          </div>
        </div>
        <Card className="border-0 shadow-sm ring-1 ring-border/80">
          <CardHeader>
            <CardTitle>Sign in to the demo</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Use an account provisioned by the demo administrator. Your role is assigned by the server.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <label className="block space-y-2 text-sm font-medium">
                Username
                <Input
                  autoComplete="username"
                  maxLength={80}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  value={username}
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Password
                <Input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              {login.isError && <p role="alert" className="text-sm text-destructive">{login.error.message}</p>}
              <Button className="w-full" disabled={login.isPending} type="submit">
                <KeyRound aria-hidden="true" />
                {login.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
          Prototype-only login using environment-configured demo accounts. It is not a managed identity provider and must not protect real patient, donor or operational data.
        </p>
      </div>
    </main>
  );
}
