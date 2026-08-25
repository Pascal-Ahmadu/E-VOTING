"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Breadcrumb from "@/components/common/Breadcrumb";
import Skeleton from "@/components/ui/skeleton/Skeleton";
import { apiCall } from "@/lib/api-client";
import { TrashBinIcon } from "@/icons";

interface BrandingForm {
  orgName: string;
  orgShortName: string;
  tagline: string;
  brandColor: string;
  voterIdLabel: string;
  emailFromName: string;
  supportEmail: string;
}

interface BrandingResponse extends BrandingForm {
  logoUrl: string | null;
}

type FieldErrors = Partial<Record<keyof BrandingForm | "form" | "logo", string>>;

const EMPTY: BrandingForm = {
  orgName: "",
  orgShortName: "",
  tagline: "",
  brandColor: "#198a44",
  voterIdLabel: "Voter ID",
  emailFromName: "",
  supportEmail: "",
};

const RAMP_STEPS = [25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export default function SettingsPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<BrandingForm | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    const res = await apiCall<{ branding: BrandingResponse }>("/api/settings");
    if (!res.ok) {
      setErrors({ form: res.error });
      setForm(EMPTY);
      return;
    }
    const b = res.data.branding;
    setForm({
      orgName: b.orgName ?? "",
      orgShortName: b.orgShortName ?? "",
      tagline: b.tagline ?? "",
      brandColor: b.brandColor ?? EMPTY.brandColor,
      voterIdLabel: b.voterIdLabel ?? EMPTY.voterIdLabel,
      emailFromName: b.emailFromName ?? "",
      supportEmail: b.supportEmail ?? "",
    });
    setLogoUrl(b.logoUrl ?? null);
  }, []);

  useEffect(() => {
    // Initial fetch is the canonical "sync external system into state" pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const setField = <K extends keyof BrandingForm>(
    key: K,
    value: BrandingForm[K],
  ) => {
    setForm((p) => (p ? { ...p, [key]: value } : p));
    setSaved(false);
    if (errors[key] || errors.form) setErrors({});
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const res = await apiCall<{ branding: BrandingResponse }>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      setErrors({ form: res.error });
      return;
    }
    setErrors({});
    setSaved(true);
    // Branding is server-rendered in the root layout, so the shell has to
    // re-render for the new name, colour and favicon to take effect.
    router.refresh();
  };

  const handleLogoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const body = new FormData();
    body.append("logo", file);
    const res = await apiCall<{ logoUrl: string }>("/api/settings/logo", {
      method: "POST",
      body,
    });
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    if (!res.ok) {
      setErrors({ logo: res.error });
      return;
    }
    setErrors({});
    setLogoUrl(res.data.logoUrl);
    router.refresh();
  };

  const handleLogoRemove = async () => {
    setUploading(true);
    const res = await apiCall<{ ok: true }>("/api/settings/logo", {
      method: "DELETE",
    });
    setUploading(false);
    if (!res.ok) {
      setErrors({ logo: res.error });
      return;
    }
    setLogoUrl(null);
    router.refresh();
  };

  if (!form) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-64 w-full" rounded="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Dashboard", href: "/admin" }, { label: "Settings" }]}
      />
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Branding
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          How this platform presents itself to your voters — name, logo, colour
          and terminology. No code changes required.
        </p>
      </header>

      {errors.form && (
        <p role="alert" className="text-sm text-error-500">
          {errors.form}
        </p>
      )}

      {/* ---- Logo ---- */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Logo
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Shown on the sign-in screen, in the admin sidebar, and used as the
          browser tab icon. PNG, JPEG, WebP or SVG, under 1 MB. A wide
          transparent PNG works best.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-5">
          <div className="flex h-24 w-48 items-center justify-center rounded-xl bg-gray-50 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Current logo"
                className="max-h-20 max-w-44 object-contain"
              />
            ) : (
              <span className="text-sm text-gray-400">No logo</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInput}
              id="logo-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoPick}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              loading={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {logoUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {logoUrl && (
              <Button
                type="button"
                variant="ghost"
                startIcon={<TrashBinIcon />}
                disabled={uploading}
                onClick={handleLogoRemove}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        {errors.logo && (
          <p role="alert" className="mt-3 text-sm text-error-500">
            {errors.logo}
          </p>
        )}
      </section>

      {/* ---- Identity, colour, terminology ---- */}
      <form onSubmit={handleSave} noValidate className="space-y-6">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Identity
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="org-name" required>
                Organisation name
              </Label>
              <Input
                id="org-name"
                value={form.orgName}
                onChange={(e) => setField("orgName", e.target.value)}
                placeholder="Acme Professional Institute"
                hint={
                  errors.orgName ??
                  "Full name, used on printed result sheets and emails"
                }
                error={Boolean(errors.orgName)}
              />
            </div>
            <div>
              <Label htmlFor="org-short" required>
                Short name / wordmark
              </Label>
              <Input
                id="org-short"
                value={form.orgShortName}
                onChange={(e) => setField("orgShortName", e.target.value)}
                placeholder="Acme"
                hint={
                  errors.orgShortName ??
                  "Compact label for the sidebar and sign-in screen"
                }
                error={Boolean(errors.orgShortName)}
              />
            </div>
            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={form.tagline}
                onChange={(e) => setField("tagline", e.target.value)}
                placeholder="2026 Annual General Election"
                hint={errors.tagline ?? "Optional sub-heading under the wordmark"}
                error={Boolean(errors.tagline)}
              />
            </div>
            <div>
              <Label htmlFor="support-email">Support email</Label>
              <Input
                id="support-email"
                type="email"
                value={form.supportEmail}
                onChange={(e) => setField("supportEmail", e.target.value)}
                placeholder="support@example.org"
                hint={
                  errors.supportEmail ?? "Shown to voters who cannot sign in"
                }
                error={Boolean(errors.supportEmail)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Colour
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            One seed colour generates the full palette used for buttons, links
            and highlights across the app.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <Label htmlFor="brand-color">Brand colour</Label>
              <div className="flex items-center gap-3">
                <input
                  id="brand-color"
                  type="color"
                  value={form.brandColor}
                  onChange={(e) => setField("brandColor", e.target.value)}
                  className="h-11 w-14 cursor-pointer rounded-lg border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-800"
                />
                <input
                  type="text"
                  value={form.brandColor}
                  onChange={(e) => setField("brandColor", e.target.value)}
                  spellCheck={false}
                  aria-label="Brand colour hex value"
                  className="h-11 w-32 rounded-lg border border-gray-300 px-3 font-mono text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
            <div className="flex items-end gap-1" aria-hidden="true">
              {RAMP_STEPS.map((step) => (
                <span
                  key={step}
                  className="h-8 w-6 rounded-sm ring-1 ring-black/5"
                  style={{ background: `var(--color-brand-${step})` }}
                />
              ))}
            </div>
          </div>
          {errors.brandColor && (
            <p role="alert" className="mt-3 text-sm text-error-500">
              {errors.brandColor}
            </p>
          )}
          <p className="mt-3 text-xs text-gray-400">
            The swatches show the palette currently in effect. Save to
            regenerate it from the selected colour.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Terminology &amp; email
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="voter-id-label" required>
                Voter ID label
              </Label>
              <Input
                id="voter-id-label"
                value={form.voterIdLabel}
                onChange={(e) => setField("voterIdLabel", e.target.value)}
                placeholder="Membership Number"
                hint={
                  errors.voterIdLabel ??
                  "What your organisation calls a voter's identifier. Used on forms, CSV exports and bulk import."
                }
                error={Boolean(errors.voterIdLabel)}
              />
            </div>
            <div>
              <Label htmlFor="email-from">Email sender name</Label>
              <Input
                id="email-from"
                value={form.emailFromName}
                onChange={(e) => setField("emailFromName", e.target.value)}
                placeholder="Defaults to the organisation name"
                hint={
                  errors.emailFromName ??
                  "Display name on credential emails sent to voters"
                }
                error={Boolean(errors.emailFromName)}
              />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-4">
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
          {saved && (
            <span role="status" className="text-sm font-medium text-success-500">
              Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
