"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { apiCall } from "@/lib/api-client";

export default function PlatformSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await apiCall("/api/platform/sign-in", {
      method: "POST",
      body: JSON.stringify({ email, passcode }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/platform");
  };

  return (
    <div className="w-full max-w-md self-center">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Platform sign in
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          For platform operators. Election administrators sign in at{" "}
          <code className="font-mono text-xs">/admin/sign-in</code>.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8 dark:bg-gray-900 dark:ring-gray-800">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-error-500/30 bg-error-500/5 px-4 py-3 text-sm text-error-600 dark:text-error-400"
            >
              {error}
            </div>
          )}
          <div>
            <Label htmlFor="email" required>Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <Label htmlFor="passcode" required>Passcode</Label>
            <Input
              id="passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" loading={submitting}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
