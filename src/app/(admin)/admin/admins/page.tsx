"use client";

import React, { useCallback, useEffect, useState } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import Breadcrumb from "@/components/common/Breadcrumb";
import Skeleton from "@/components/ui/skeleton/Skeleton";
import { TableSkeleton } from "@/components/voting/skeletons";
import { apiCall } from "@/lib/api-client";
import { PlusIcon, TrashBinIcon } from "@/icons";

interface AdminRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface CurrentAdmin {
  id: string;
  name: string;
  email: string;
}

interface NewAdminForm {
  name: string;
  email: string;
  passcode: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  passcode?: string;
  form?: string;
}

const EMPTY_FORM: NewAdminForm = { name: "", email: "", passcode: "" };

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [current, setCurrent] = useState<CurrentAdmin | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewAdminForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirm, setConfirm] = useState<AdminRow | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [listRes, meRes] = await Promise.all([
      apiCall<{ admins: AdminRow[] }>("/api/admins"),
      apiCall<{ admin: CurrentAdmin | null }>("/api/admin/me"),
    ]);
    if (listRes.ok) setAdmins(listRes.data.admins);
    if (meRes.ok) setCurrent(meRes.data.admin);
  }, []);

  useEffect(() => {
    // Initial fetch is the canonical "sync external system into state" pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const closeAddModal = () => {
    setAdding(false);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = await apiCall<{ admin: AdminRow }>("/api/admins", {
      method: "POST",
      body: JSON.stringify(form),
    });
    if (!result.ok) {
      setErrors({ form: result.error });
      return;
    }
    setForm(EMPTY_FORM);
    setErrors({});
    setAdding(false);
    refresh();
  };

  const handleRemove = async () => {
    if (!confirm) return;
    const result = await apiCall<{ ok: true }>(`/api/admins/${confirm.id}`, {
      method: "DELETE",
    });
    if (!result.ok) {
      setStatusError(result.error);
      setConfirm(null);
      return;
    }
    setStatusError(null);
    setConfirm(null);
    refresh();
  };

  const setField = <K extends keyof NewAdminForm>(
    key: K,
    value: NewAdminForm[K],
  ) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key] || errors.form) setErrors({});
  };

  if (!admins) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32" rounded="lg" />
        </div>
        <TableSkeleton rows={3} columns={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Admins" },
        ]}
      />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Admins
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            People who can manage elections, voters, and results.
          </p>
        </div>
        <span id="tour-admins-add-btn">
          <Button startIcon={<PlusIcon />} onClick={() => setAdding(true)}>
            Add admin
          </Button>
        </span>
      </header>

      {statusError && (
        <p role="alert" className="text-sm text-error-500">
          {statusError}
        </p>
      )}

      <div id="tour-admins-table" className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {admins.map((admin) => {
                const isSelf = admin.id === current?.id;
                const isLast = admins.length === 1;
                return (
                  <tr key={admin.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {admin.name}
                        </span>
                        {isSelf && (
                          <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-500">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{admin.email}</td>
                    <td className="px-4 py-3">{formatDate(admin.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        ariaLabel={`Remove admin ${admin.name}`}
                        startIcon={<TrashBinIcon />}
                        disabled={isSelf || isLast}
                        onClick={() => setConfirm(admin)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={adding} onClose={closeAddModal} className="m-4 max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Add an admin
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          The new admin signs in with the email and passcode you set.
        </p>
        <form onSubmit={handleAdd} noValidate className="mt-5 space-y-4">
          {errors.form && (
            <div
              role="alert"
              className="rounded-lg border border-error-500/30 bg-error-500/5 px-3 py-2 text-sm text-error-600 dark:text-error-400"
            >
              {errors.form}
            </div>
          )}
          <div>
            <Label htmlFor="new-admin-name">Name</Label>
            <Input
              id="new-admin-name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Jane Doe"
              maxLength={80}
              required
              error={Boolean(errors.name)}
              hint={errors.name}
            />
          </div>
          <div>
            <Label htmlFor="new-admin-email">Email</Label>
            <Input
              id="new-admin-email"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="jane@example.com"
              autoComplete="off"
              maxLength={254}
              required
              error={Boolean(errors.email)}
              hint={errors.email}
            />
          </div>
          <div>
            <Label htmlFor="new-admin-passcode">Passcode</Label>
            <Input
              id="new-admin-passcode"
              type="password"
              value={form.passcode}
              onChange={(e) => setField("passcode", e.target.value)}
              placeholder="At least 4 characters"
              autoComplete="new-password"
              maxLength={64}
              required
              error={Boolean(errors.passcode)}
              hint={errors.passcode}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={closeAddModal}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Add admin
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        className="m-4 max-w-md p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Remove admin
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {confirm
            ? `Remove ${confirm.name} (${confirm.email})? They will no longer be able to sign in.`
            : ""}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleRemove}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}
