"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import Breadcrumb from "@/components/common/Breadcrumb";
import StatusBadge from "@/components/voting/StatusBadge";
import Skeleton from "@/components/ui/skeleton/Skeleton";
import { CardListSkeleton } from "@/components/voting/skeletons";
import { apiCall } from "@/lib/api-client";
import { PlusIcon } from "@/icons";

type ElectionStatus = "draft" | "open" | "closed";

interface ElectionRow {
  id: string;
  name: string;
  description: string | null;
  status: ElectionStatus;
  createdAt: string;
  positionCount: number;
  ballotCount: number;
}

interface ElectionsPage {
  data: ElectionRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface NewElectionForm {
  name: string;
  description: string;
}

const EMPTY_FORM: NewElectionForm = { name: "", description: "" };
const PAGE_SIZE = 20;

export default function ElectionsListPage() {
  const router = useRouter();
  const [page, setPage] = useState<ElectionsPage | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewElectionForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(async (currentPage: number) => {
    const qs = new URLSearchParams({
      page: String(currentPage),
      pageSize: String(PAGE_SIZE),
    });
    const result = await apiCall<ElectionsPage>(`/api/elections?${qs}`);
    if (result.ok) setPage(result.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh(pageNum);
  }, [pageNum, refresh]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFormError("Name is required");
      return;
    }
    const result = await apiCall<{ election: { id: string } }>("/api/elections", {
      method: "POST",
      body: JSON.stringify({
        name,
        description: form.description.trim() || undefined,
      }),
    });
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setCreating(false);
    setForm(EMPTY_FORM);
    setFormError(null);
    router.push(`/admin/elections/${result.data.election.id}`);
  };

  const closeModal = () => {
    setCreating(false);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  if (!page) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32" rounded="lg" />
        </div>
        <CardListSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Elections" },
        ]}
      />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Elections
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create elections, add positions and candidates, open them for voting.
          </p>
        </div>
        <span id="tour-elections-new-btn">
          <Button startIcon={<PlusIcon />} onClick={() => setCreating(true)}>
            New election
          </Button>
        </span>
      </header>

      {page.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            No elections yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Create your first election to start adding positions and candidates.
          </p>
          <div className="mt-5">
            <Button startIcon={<PlusIcon />} onClick={() => setCreating(true)}>
              Create election
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ul id="tour-elections-list" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {page.data.map((election) => (
              <li key={election.id}>
                <Link
                  href={`/admin/elections/${election.id}`}
                  className="block h-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 transition hover:ring-brand-500/40 dark:bg-gray-900 dark:ring-gray-800 dark:hover:ring-brand-500/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {election.name}
                    </h3>
                    <StatusBadge status={election.status} />
                  </div>
                  {election.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                      {election.description}
                    </p>
                  )}
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-400">
                        Positions
                      </dt>
                      <dd className="font-medium text-gray-800 dark:text-gray-100">
                        {election.positionCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-400">
                        Ballots
                      </dt>
                      <dd className="font-medium text-gray-800 dark:text-gray-100">
                        {election.ballotCount}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>

          {page.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-400">
              <span>
                Page {page.page} of {page.totalPages} · {page.total} elections
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page.page <= 1}
                  onClick={() => setPageNum((n) => Math.max(1, n - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page.page >= page.totalPages}
                  onClick={() => setPageNum((n) => n + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={creating} onClose={closeModal} className="m-4 max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Create a new election
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Once created, you can add positions and candidates before opening it.
        </p>
        <form onSubmit={handleCreate} noValidate className="mt-5 space-y-4">
          <div>
            <Label htmlFor="election-name">Name</Label>
            <Input
              id="election-name"
              value={form.name}
              onChange={(e) => {
                setForm((p) => ({ ...p, name: e.target.value }));
                if (formError) setFormError(null);
              }}
              placeholder="e.g. 2026 Student Council Election"
              maxLength={80}
              required
              error={Boolean(formError)}
            />
          </div>
          <div>
            <Label htmlFor="election-desc">Description (optional)</Label>
            <Input
              id="election-desc"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="Short context shown to voters"
              maxLength={280}
            />
          </div>
          {formError && (
            <p role="alert" className="text-sm text-error-500">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
