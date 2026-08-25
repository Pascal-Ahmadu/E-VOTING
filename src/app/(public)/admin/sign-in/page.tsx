"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import React, { useState } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import { apiCall } from "@/lib/api-client";
import { useBranding } from "@/context/BrandingContext";
import BrandMark from "@/components/common/BrandMark";
import { ChevronLeftIcon } from "@/icons";

interface FormState {
  email: string;
  passcode: string;
}

interface FieldErrors {
  email?: string;
  passcode?: string;
  form?: string;
}

const EMPTY: FormState = { email: "", passcode: "" };

export default function AdminSignInPage() {
  const { orgShortName } = useBranding();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!form.email.trim()) next.email = "Email is required";
    if (!form.passcode) next.passcode = "Passcode is required";
    if (next.email || next.passcode) {
      setErrors(next);
      return;
    }
    setSubmitting(true);
    const result = await apiCall<{ admin: unknown }>("/api/admin/sign-in", {
      method: "POST",
      body: JSON.stringify(form),
    });
    if (!result.ok) {
      setErrors({ form: result.error });
      setSubmitting(false);
      return;
    }
    router.replace("/admin");
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key] || errors.form) setErrors({});
  };

  return (
    <div className="w-full max-w-md self-center space-y-4">
      {process.env.NODE_ENV !== "production" && (
        <Alert
          variant="info"
          title="Development mode"
          message="On a fresh database the seed admin is admin@example.com / ChangeMe123. Change the passcode after the first sign-in. This banner is hidden in production."
        />
      )}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8 dark:bg-gray-900 dark:ring-gray-800">
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <BrandMark className="h-12 w-auto max-w-[240px] object-contain" />
          </div>
          <div className="mx-auto mb-4 text-4xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">
            {orgShortName}
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Administrator sign in
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sign in with your admin email and passcode
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {errors.form && (
            <div
              role="alert"
              className="rounded-lg border border-error-500/30 bg-error-500/5 px-4 py-3 text-sm text-error-600 dark:text-error-400"
            >
              {errors.form}
            </div>
          )}

          <div>
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="admin@example.com"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              required
              error={Boolean(errors.email)}
              hint={errors.email}
            />
          </div>

          <div>
            <Label htmlFor="admin-passcode">Passcode</Label>
            <Input
              id="admin-passcode"
              type="password"
              placeholder="••••••••"
              value={form.passcode}
              onChange={(e) => setField("passcode", e.target.value)}
              autoComplete="current-password"
              maxLength={64}
              required
              error={Boolean(errors.passcode)}
              hint={errors.passcode}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-3 text-right">
          <Link
            href="/admin/change-password"
            className="text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Change passcode
          </Link>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-5 text-center dark:border-gray-800">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-brand-500 dark:text-gray-400"
          >
            <ChevronLeftIcon aria-hidden="true" />
            Back to voter sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
