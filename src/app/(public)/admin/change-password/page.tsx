"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon } from "@/icons";
import { apiCall } from "@/lib/api-client";

interface FormState {
  email: string;
  currentPasscode: string;
  newPasscode: string;
  confirmPasscode: string;
}

interface FieldErrors {
  email?: string;
  currentPasscode?: string;
  newPasscode?: string;
  confirmPasscode?: string;
  form?: string;
}

const EMPTY_FORM: FormState = {
  email: "",
  currentPasscode: "",
  newPasscode: "",
  confirmPasscode: "",
};

type View = { kind: "form" } | { kind: "success" };

export default function AdminChangePasscodePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [view, setView] = useState<View>({ kind: "form" });
  const [submitting, setSubmitting] = useState(false);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key] || errors.form) setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: FieldErrors = {
      email: form.email.trim() ? undefined : "Email is required",
      currentPasscode: form.currentPasscode
        ? undefined
        : "Current passcode is required",
      newPasscode: form.newPasscode
        ? form.newPasscode.length < 4
          ? "New passcode must be at least 4 characters"
          : undefined
        : "New passcode is required",
      confirmPasscode:
        form.newPasscode && form.confirmPasscode !== form.newPasscode
          ? "Passcodes do not match"
          : undefined,
    };
    if (
      next.email ||
      next.currentPasscode ||
      next.newPasscode ||
      next.confirmPasscode
    ) {
      setErrors(next);
      return;
    }
    setSubmitting(true);
    const result = await apiCall<{ ok: true }>("/api/admin/change-passcode", {
      method: "POST",
      body: JSON.stringify({
        email: form.email,
        currentPasscode: form.currentPasscode,
        newPasscode: form.newPasscode,
      }),
    });
    if (!result.ok) {
      setErrors({ form: result.error });
      setSubmitting(false);
      return;
    }
    setErrors({});
    setView({ kind: "success" });
  };

  return (
    <div className="w-full max-w-md self-center rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8 dark:bg-gray-900 dark:ring-gray-800">
      {view.kind === "form" && (
        <>
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Change administrator passcode
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter your current passcode and choose a new one.
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
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="admin@example.com"
                autoComplete="email"
                inputMode="email"
                maxLength={254}
                required
                error={Boolean(errors.email)}
                hint={errors.email}
              />
            </div>

            <div>
              <Label htmlFor="current-passcode">Current passcode</Label>
              <Input
                id="current-passcode"
                type="password"
                value={form.currentPasscode}
                onChange={(e) => setField("currentPasscode", e.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
                maxLength={64}
                required
                error={Boolean(errors.currentPasscode)}
                hint={errors.currentPasscode}
              />
            </div>

            <div>
              <Label htmlFor="new-passcode">New passcode</Label>
              <Input
                id="new-passcode"
                type="password"
                value={form.newPasscode}
                onChange={(e) => setField("newPasscode", e.target.value)}
                placeholder="At least 4 characters"
                autoComplete="new-password"
                maxLength={64}
                required
                error={Boolean(errors.newPasscode)}
                hint={errors.newPasscode}
              />
            </div>

            <div>
              <Label htmlFor="confirm-passcode">Confirm new passcode</Label>
              <Input
                id="confirm-passcode"
                type="password"
                value={form.confirmPasscode}
                onChange={(e) => setField("confirmPasscode", e.target.value)}
                placeholder="Repeat new passcode"
                autoComplete="new-password"
                maxLength={64}
                required
                error={Boolean(errors.confirmPasscode)}
                hint={errors.confirmPasscode}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={submitting}
            >
              {submitting ? "Updating…" : "Update passcode"}
            </Button>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-5 text-center dark:border-gray-800">
            <Link
              href="/admin/sign-in"
              className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-brand-500 dark:text-gray-400"
            >
              <ChevronLeftIcon aria-hidden="true" className="h-4 w-4" />
              Back to administrator sign in
            </Link>
          </div>
        </>
      )}

      {view.kind === "success" && (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-500/10 ring-1 ring-success-500/20">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-success-500"
            >
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Passcode updated
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Use your new passcode the next time you sign in.
          </p>
          <Button
            variant="primary"
            className="mt-6 w-full"
            onClick={() => router.push("/admin/sign-in")}
          >
            Sign in to admin
          </Button>
        </div>
      )}
    </div>
  );
}
