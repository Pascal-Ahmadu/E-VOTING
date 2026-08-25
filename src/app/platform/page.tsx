"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import Skeleton from "@/components/ui/skeleton/Skeleton";
import { apiCall } from "@/lib/api-client";
import { PlusIcon } from "@/icons";

interface OrganizationRow {
  id: string;
  slug: string;
  orgName: string;
  orgShortName: string;
  createdAt: string;
  _count: { admins: number; voters: number; elections: number };
}

interface NewOrgForm {
  slug: string;
  orgName: string;
  orgShortName: string;
  adminName: string;
  adminEmail: string;
  adminPasscode: string;
}

const EMPTY: NewOrgForm = {
  slug: "",
  orgName: "",
  orgShortName: "",
  adminName: "",
  adminEmail: "",
  adminPasscode: "",
};

/** Mirrors the server's slug rule, so the field can preview the real URL. */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function PlatformPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrganizationRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewOrgForm>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  const refresh = useCallback(async () => {
    const res = await apiCall<{ organizations: OrganizationRow[] }>(
      "/api/platform/organizations",
    );
    if (!res.ok) {
      // 401 means no platform session — send them to sign in rather than
      // rendering an empty console.
      if (res.status === 401) {
        router.replace("/platform/sign-in");
        return;
      }
      setError(res.error);
      setOrgs([]);
      return;
    }
    setOrgs(res.data.organizations);
  }, [router]);

  useEffect(() => {
    // Initial fetch is the canonical "sync external system into state" pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const setField = <K extends keyof NewOrgForm>(key: K, value: NewOrgForm[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    setError(null);
  };

  const handleName = (value: string) => {
    // The slug follows the name until the operator edits it directly.
    setForm((p) => ({
      ...p,
      orgName: value,
      slug: slugEdited ? p.slug : slugify(value),
    }));
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const res = await apiCall<{ organization: OrganizationRow }>(
      "/api/platform/organizations",
      { method: "POST", body: JSON.stringify(form) },
    );
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setForm(EMPTY);
    setSlugEdited(false);
    setAdding(false);
    refresh();
  };

  const handleSignOut = async () => {
    await apiCall("/api/platform/sign-in", { method: "DELETE" });
    router.replace("/platform/sign-in");
  };

  if (!orgs) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" rounded="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Organisations
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Every organisation on this platform. Each is fully isolated — its
            admins see only their own elections, voters and results.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
          <Button startIcon={<PlusIcon />} onClick={() => setAdding(true)}>
            New organisation
          </Button>
        </div>
      </header>

      {error && (
        <p role="alert" className="text-sm text-error-500">
          {error}
        </p>
      )}

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
        {orgs.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No organisations yet. Create the first one to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Organisation</th>
                  <th className="px-4 py-3 font-medium">Voter address</th>
                  <th className="px-4 py-3 font-medium">Admins</th>
                  <th className="px-4 py-3 font-medium">Voters</th>
                  <th className="px-4 py-3 font-medium">Elections</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {orgs.map((o) => (
                  <tr key={o.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {o.orgName}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        {o.orgShortName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-800">
                        /o/{o.slug}
                      </code>
                    </td>
                    <td className="px-4 py-3">{o._count.admins}</td>
                    <td className="px-4 py-3">{o._count.voters}</td>
                    <td className="px-4 py-3">{o._count.elections}</td>
                    <td className="px-4 py-3">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={adding} onClose={() => setAdding(false)} className="max-w-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          New organisation
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Creates the organisation and its first administrator together. They
          can set their own logo, colour and wording once they sign in.
        </p>

        <form onSubmit={handleCreate} noValidate className="mt-5 space-y-4">
          {error && (
            <p role="alert" className="text-sm text-error-500">
              {error}
            </p>
          )}
          <div>
            <Label htmlFor="org-name" required>Organisation name</Label>
            <Input
              id="org-name"
              value={form.orgName}
              onChange={(e) => handleName(e.target.value)}
              placeholder="Acme Professional Institute"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="org-short" required>Short name</Label>
              <Input
                id="org-short"
                value={form.orgShortName}
                onChange={(e) => setField("orgShortName", e.target.value)}
                placeholder="Acme"
              />
            </div>
            <div>
              <Label htmlFor="org-slug" required>URL slug</Label>
              <Input
                id="org-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setField("slug", slugify(e.target.value));
                }}
                placeholder="acme"
                hint={form.slug ? `Voters go to /o/${form.slug}` : "Lowercase letters, numbers and dashes"}
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 dark:border-gray-800">
            <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              First administrator
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="admin-name" required>Name</Label>
                <Input
                  id="admin-name"
                  value={form.adminName}
                  onChange={(e) => setField("adminName", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="admin-email" required>Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => setField("adminEmail", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="admin-passcode" required>Passcode</Label>
                <Input
                  id="admin-passcode"
                  type="text"
                  value={form.adminPasscode}
                  onChange={(e) => setField("adminPasscode", e.target.value)}
                  hint="At least 8 characters. Share it with them securely; they can change it after signing in."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create organisation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
