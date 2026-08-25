"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import React, { useState } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronRightIcon } from "@/icons";
import { validatePassword, validateVoterId } from "@/lib/validators";
import { apiCall } from "@/lib/api-client";
import { useBranding } from "@/context/BrandingContext";
import BrandMark from "@/components/common/BrandMark";

interface FieldErrors {
  voterId?: string;
  password?: string;
  form?: string;
}

export default function VoterSignInPage() {
  const { slug, orgShortName, tagline, voterIdLabel, supportEmail } = useBranding();
  const router = useRouter();
  const [voterId, setVoterId] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: FieldErrors = {
      voterId: validateVoterId(voterId) ?? undefined,
      password: validatePassword(password) ?? undefined,
    };
    if (next.voterId || next.password) {
      setErrors(next);
      return;
    }
    setSubmitting(true);
    const result = await apiCall<{ voter: unknown }>("/api/voters/sign-in", {
      method: "POST",
      body: JSON.stringify({ slug, voterId, password }),
    });
    if (!result.ok) {
      setErrors({ form: result.error });
      setSubmitting(false);
      return;
    }
    router.push(`/o/${slug}/ballot`);
  };

  return (
    <div className="w-full max-w-md self-center">
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandMark className="h-14 w-auto max-w-[280px] object-contain" />
        <div className="mt-3 text-4xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">
          {orgShortName}
        </div>
        {tagline && (
          <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
            {tagline}
          </p>
        )}
        <h1 className="mt-7 text-3xl font-semibold text-gray-900 dark:text-white">
          Sign in to vote
        </h1>
        <p className="mt-2 max-w-xs text-base text-gray-500 dark:text-gray-400">
          Use your {voterIdLabel} and the password sent by the administrator.
        </p>
        {supportEmail && (
          <p className="mt-2 text-sm text-gray-400">
            Need help?{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              {supportEmail}
            </a>
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8 dark:bg-gray-900 dark:ring-gray-800">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {errors.form && (
            <div
              role="alert"
              className="rounded-lg border border-error-500/30 bg-error-500/5 px-4 py-3 text-base text-error-600 dark:text-error-400"
            >
              {errors.form}
            </div>
          )}
          <div>
            <Label htmlFor="voter-id" className="text-base">
              {voterIdLabel}
            </Label>
            <Input
              id="voter-id"
              type="text"
              size="lg"
              placeholder={voterIdLabel}
              value={voterId}
              onChange={(e) => {
                setVoterId(e.target.value);
                if (errors.voterId) setErrors((p) => ({ ...p, voterId: undefined }));
              }}
              autoComplete="username"
              autoCapitalize="characters"
              maxLength={32}
              required
              error={Boolean(errors.voterId)}
              hint={errors.voterId}
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-base">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              size="lg"
              placeholder="Password sent by administrator"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
              }}
              autoComplete="current-password"
              maxLength={64}
              required
              error={Boolean(errors.password)}
              hint={errors.password}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="mt-2 w-full"
            loading={submitting}
          >
            {submitting ? "Signing in…" : "Sign in to vote"}
          </Button>
        </form>

      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <Link
          href="/admin/sign-in"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-brand-500 dark:text-gray-400"
        >
          Election administrator sign in
          <ChevronRightIcon aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
