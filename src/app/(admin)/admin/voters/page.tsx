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
import { validateEmail, validatePassword, validateVoterId } from "@/lib/validators";
import { CopyIcon, PlusIcon, TrashBinIcon } from "@/icons";
import { useBranding } from "@/context/BrandingContext";

interface VoterRow {
  id: string;
  name: string;
  email: string;
  voterId: string;
  registeredAt: string;
  ballotCount: number;
}

interface VotersPage {
  data: VoterRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface VoterCredentials {
  id: string;
  name: string;
  email: string;
  voterId: string;
  password: string;
}

interface BulkImportRow {
  name: string;
  email: string;
  voterId: string;
  password: string;
  phone?: string;
}

interface SkippedRow {
  row: number;
  name: string;
  email: string;
  reason: string;
}

interface VoterForm {
  name: string;
  email: string;
  voterId: string;
  password: string;
  phone: string;
}

interface FieldErrors {
  name?: string;
  email?: string;
  voterId?: string;
  password?: string;
  form?: string;
}

const EMPTY_FORM: VoterForm = { name: "", email: "", voterId: "", password: "", phone: "" };

function whatsappUrl(
  voter: { name: string; voterId: string; password: string },
  branding: { orgName: string; voterIdLabel: string },
  phone?: string,
): string {
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const text = [
    `Hello ${voter.name},`,
    "",
    `Your ${branding.orgName} voting credentials:`,
    `${branding.voterIdLabel}: ${voter.voterId}`,
    `Password: ${voter.password}`,
    "",
    `Vote at: ${appUrl}`,
    "",
    "Do not share these credentials.",
  ].join("\n");
  const digits = (phone ?? "").replace(/\D/g, "");
  const normalised = digits.startsWith("234") ? digits : digits.startsWith("0") ? "234" + digits.slice(1) : digits ? "234" + digits : "";
  return normalised
    ? `https://wa.me/${normalised}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
}
const PAGE_SIZE = 20;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

type ModalView =
  | { kind: "closed" }
  | { kind: "form" }
  | { kind: "success"; voter: VoterCredentials; whatsappSent?: boolean; emailSent?: boolean; phoneUsed?: string }
  | { kind: "import" }
  | { kind: "import-results"; created: BulkImportRow[]; skipped: SkippedRow[] };

export default function VotersPage() {
  const { orgName, voterIdLabel } = useBranding();
  // How the identifier column should be spelled in an uploaded CSV, plus a
  // matching stem for the worked example below.
  const csvIdColumn = voterIdLabel.toLowerCase();
  const sampleId = voterIdLabel.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
  const [page, setPage] = useState<VotersPage | null>(null);
  const [filter, setFilter] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [view, setView] = useState<ModalView>({ kind: "closed" });
  const [form, setForm] = useState<VoterForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirm, setConfirm] = useState<VoterRow | null>(null);
  const [resetConfirm, setResetConfirm] = useState<VoterRow | null>(null);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const refresh = useCallback(async (currentPage: number, q: string) => {
    setLoading(true);
    const qs = new URLSearchParams({
      page: String(currentPage),
      pageSize: String(PAGE_SIZE),
    });
    if (q) qs.set("q", q);
    const result = await apiCall<VotersPage>(`/api/voters?${qs}`);
    if (result.ok) setPage(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      setPageNum(1);
      refresh(1, filter.trim());
    }, filter.trim() ? 250 : 0);
    return () => clearTimeout(id);
  }, [filter, refresh]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh(pageNum, filter.trim());
  }, [pageNum, refresh, filter]);

  const closeModal = () => {
    setView({ kind: "closed" });
    setForm(EMPTY_FORM);
    setErrors({});
    setCopied(false);
    setImportFile(null);
    setImportError(null);
  };

  const openForm = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setView({ kind: "form" });
  };

  const openImport = () => {
    setImportFile(null);
    setImportError(null);
    setView({ kind: "import" });
  };

  const handleImport = async () => {
    if (!importFile) {
      setImportError("Please select a CSV file.");
      return;
    }
    setImportLoading(true);
    setImportError(null);
    const body = new FormData();
    body.append("file", importFile);
    const result = await apiCall<{ created: BulkImportRow[]; skipped: SkippedRow[] }>(
      "/api/voters/bulk-import",
      { method: "POST", body },
    );
    setImportLoading(false);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    if (result.data.created.length === 0) {
      setImportError(
        "No voters were imported. " +
        (result.data.skipped.length > 0
          ? `All ${result.data.skipped.length} rows were skipped.`
          : "The file may be empty or formatted incorrectly."),
      );
      return;
    }
    setView({ kind: "import-results", created: result.data.created, skipped: result.data.skipped });
    refresh(pageNum, filter.trim());
  };

  const downloadCredentialsCSV = (voters: BulkImportRow[]) => {
    const header = "Name,Email,Voter ID,Password";
    const rows = voters.map(
      (v) =>
        `"${v.name.replace(/"/g, '""')}","${v.email}","${v.voterId}","${v.password}"`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voter-credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAutoGenerateId = async () => {
    const result = await apiCall<{ voterId: string }>(
      "/api/voters/generate-id",
      { method: "POST" },
    );
    if (result.ok) {
      setForm((p) => ({ ...p, voterId: result.data.voterId }));
      if (errors.voterId || errors.form) setErrors({});
    } else {
      setErrors({ form: result.error });
    }
  };

  const handleAutoGeneratePassword = async () => {
    const result = await apiCall<{ password: string }>(
      "/api/voters/generate-password",
      { method: "POST" },
    );
    if (result.ok) {
      setForm((p) => ({ ...p, password: result.data.password }));
      if (errors.password || errors.form) setErrors({});
    } else {
      setErrors({ form: result.error });
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: FieldErrors = {
      name: form.name.trim() ? undefined : "Name is required",
      email: validateEmail(form.email) ?? undefined,
      voterId: validateVoterId(form.voterId) ?? undefined,
      password: validatePassword(form.password) ?? undefined,
    };
    if (next.name || next.email || next.voterId || next.password) {
      setErrors(next);
      return;
    }
    const result = await apiCall<{ voter: VoterCredentials; whatsappSent: boolean; emailSent: boolean }>("/api/voters", {
      method: "POST",
      body: JSON.stringify(form),
    });
    if (!result.ok) {
      setErrors({ form: result.error });
      return;
    }
    setErrors({});
    setView({ kind: "success", voter: result.data.voter, whatsappSent: result.data.whatsappSent, emailSent: result.data.emailSent, phoneUsed: form.phone });
    refresh(pageNum, filter.trim());
  };

  const handleCopyCredentials = async (voter: VoterCredentials) => {
    const text = `Sign-in credentials\nName: ${voter.name}\nEmail: ${voter.email}\nVoter ID: ${voter.voterId}\nPassword: ${voter.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    const result = await apiCall<{ ok: true }>(
      `/api/voters/${confirm.id}`,
      { method: "DELETE" },
    );
    setConfirm(null);
    if (result.ok) {
      refresh(pageNum, filter.trim());
    }
  };

  const handleResetPassword = async () => {
    if (!resetConfirm) return;
    setResetting(true);
    const result = await apiCall<{ voter: VoterCredentials; whatsappSent?: boolean; emailSent?: boolean; phoneUsed?: string }>(
      `/api/voters/${resetConfirm.id}/reset-password`,
      { method: "POST" },
    );
    setResetting(false);
    setResetConfirm(null);
    if (result.ok) {
      setView({ kind: "success", voter: result.data.voter, whatsappSent: result.data.whatsappSent, emailSent: result.data.emailSent, phoneUsed: result.data.phoneUsed });
    }
  };

  const setField = <K extends keyof VoterForm>(key: K, value: VoterForm[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key as keyof FieldErrors] || errors.form) setErrors({});
  };

  if (!page) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" rounded="lg" />
        </div>
        <TableSkeleton rows={6} columns={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Voters" },
        ]}
      />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Voters
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Only registered voters can sign in to cast a ballot.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openImport}>
            Import CSV
          </Button>
          <span id="tour-voters-register-btn">
            <Button startIcon={<PlusIcon />} onClick={openForm}>
              Register voter
            </Button>
          </span>
        </div>
      </header>

      {page.total === 0 && !filter ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            No voters registered yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Register at least one voter before opening an election.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="outline" onClick={openImport}>
              Import CSV
            </Button>
            <Button startIcon={<PlusIcon />} onClick={openForm}>
              Register first voter
            </Button>
          </div>
        </div>
      ) : (
        <div id="tour-voters-table" className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div className="border-b border-gray-200 p-4 dark:border-gray-800">
            <Input
              id="voter-filter"
              type="text"
              placeholder="Search by name, email or Voter ID"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              maxLength={64}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Voter ID</th>
                  <th className="px-4 py-3 font-medium">Registered</th>
                  <th className="px-4 py-3 font-medium">Ballots</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {page.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      {loading ? "Loading…" : "No voters match this search."}
                    </td>
                  </tr>
                ) : (
                  page.data.map((voter) => (
                    <tr key={voter.id} className="text-gray-700 dark:text-gray-300">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {voter.name}
                      </td>
                      <td className="px-4 py-3">{voter.email}</td>
                      <td className="px-4 py-3 font-mono">{voter.voterId}</td>
                      <td className="px-4 py-3">{formatDate(voter.registeredAt)}</td>
                      <td className="px-4 py-3">{voter.ballotCount}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            ariaLabel={`Reset password for ${voter.name}`}
                            onClick={() => setResetConfirm(voter)}
                          >
                            Reset password
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            ariaLabel={`Remove voter ${voter.name}`}
                            startIcon={<TrashBinIcon />}
                            onClick={() => setConfirm(voter)}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {page.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-400">
              <span>
                Page {page.page} of {page.totalPages} · {page.total} voters
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
        </div>
      )}

      <Modal
        isOpen={view.kind !== "closed"}
        onClose={closeModal}
        className="m-4 max-w-md p-6"
      >
        {view.kind === "form" && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Register a voter
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The voter signs in using exactly these credentials.
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
                <Label htmlFor="new-voter-name" required>Full name</Label>
                <Input
                  id="new-voter-name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Ada Lovelace"
                  autoComplete="off"
                  maxLength={80}
                  required
                  error={Boolean(errors.name)}
                  hint={errors.name}
                />
              </div>
              <div>
                <Label htmlFor="new-voter-email" required>Email</Label>
                <Input
                  id="new-voter-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="voter@example.com"
                  autoComplete="off"
                  maxLength={254}
                  required
                  error={Boolean(errors.email)}
                  hint={errors.email}
                />
              </div>
              <div>
                <Label htmlFor="new-voter-id" required>{voterIdLabel}</Label>
                <Input
                  id="new-voter-id"
                  type="text"
                  value={form.voterId}
                  onChange={(e) => setField("voterId", e.target.value)}
                  placeholder={`e.g. ${voterIdLabel.replace(/\s+/g, "").toUpperCase()}12345`}
                  autoComplete="off"
                  maxLength={32}
                  required
                  error={Boolean(errors.voterId)}
                  hint={errors.voterId ?? `The member's ${voterIdLabel}`}
                />
              </div>
              <div>
                <Label htmlFor="new-voter-phone">WhatsApp / Phone number</Label>
                <Input
                  id="new-voter-phone"
                  type="tel"
                  value={form.phone ?? ""}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="e.g. 08012345678"
                  autoComplete="off"
                  maxLength={20}
                  hint="Optional — credentials will be sent via WhatsApp if provided"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="new-voter-password" required>Password</Label>
                  <button
                    type="button"
                    onClick={handleAutoGeneratePassword}
                    className="text-xs font-medium text-brand-500 hover:text-brand-600"
                  >
                    Auto-generate
                  </button>
                </div>
                <Input
                  id="new-voter-password"
                  type="text"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder="At least 4 characters"
                  autoComplete="off"
                  maxLength={64}
                  required
                  error={Boolean(errors.password)}
                  hint={errors.password ?? "Voters use this with their email to sign in"}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Register
                </Button>
              </div>
            </form>
          </>
        )}

        {view.kind === "success" && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-500/10 text-success-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Voter registered
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Share these credentials with the voter.
                </p>
              </div>
            </div>

            <dl className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-800/40">
              <Row label="Name" value={view.voter.name} />
              <Row label="Email" value={view.voter.email} />
              <Row label="Voter ID" value={view.voter.voterId} mono />
              <Row label="Password" value={view.voter.password} mono />
            </dl>

            <div className="mt-3 space-y-1">
              <p className={`text-xs font-medium ${view.emailSent ? "text-success-600 dark:text-success-400" : "text-error-600 dark:text-error-400"}`}>
                {view.emailSent ? "✓ Credentials emailed to voter" : "⚠ Email send failed"}
              </p>
              {view.phoneUsed && (
                <p className={`text-xs font-medium ${view.whatsappSent ? "text-success-600 dark:text-success-400" : "text-error-600 dark:text-error-400"}`}>
                  {view.whatsappSent ? `✓ WhatsApp sent to ${view.phoneUsed}` : `⚠ WhatsApp failed — share manually below`}
                </p>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              The password is shown only this once. Share via WhatsApp or copy before closing.
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <a
                href={whatsappUrl(view.voter, { orgName, voterIdLabel }, form.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#25D366] bg-[#25D366]/10 px-3 py-1.5 text-sm font-medium text-[#128C7E] hover:bg-[#25D366]/20 dark:text-[#25D366]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.103 1.522 5.826L.057 23.854a.5.5 0 0 0 .609.61l6.098-1.475A11.949 11.949 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.898a9.898 9.898 0 0 1-5.051-1.382l-.361-.214-3.742.906.944-3.643-.235-.374A9.862 9.862 0 0 1 2.103 12C2.103 6.529 6.529 2.103 12 2.103S21.897 6.529 21.897 12 17.471 21.898 12 21.898z"/>
                </svg>
                Share via WhatsApp
              </a>
              <Button
                variant="outline"
                size="sm"
                startIcon={<CopyIcon />}
                onClick={() => handleCopyCredentials(view.voter)}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" onClick={closeModal}>
                Done
              </Button>
            </div>
          </>
        )}

        {view.kind === "import" && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Import voters from CSV
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Upload a CSV file with <code className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">name</code>, <code className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">email</code>, and <code className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{csvIdColumn}</code> columns. Passwords are generated automatically and emailed to each voter.
            </p>
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
              <p className="font-medium text-gray-700 dark:text-gray-300">Expected CSV format:</p>
              <pre className="mt-1 font-mono">{`name,email,${csvIdColumn},phone\nAda Lovelace,ada@example.com,${sampleId}1,08012345678\nAlan Turing,alan@example.com,${sampleId}2,`}</pre>
              <p className="mt-2">The {voterIdLabel} column is required — a header of <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{csvIdColumn}</code> is accepted, as are <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">voter id</code>, <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">member id</code> and <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">id</code>. The <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">phone</code> column is optional — credentials are always emailed; WhatsApp is sent too if a phone number is provided. Maximum 200 rows per import.</p>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                CSV file
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] ?? null);
                  if (importError) setImportError(null);
                }}
                className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-900/30 dark:file:text-brand-400"
              />
            </div>
            {importError && (
              <div role="alert" className="mt-3 rounded-lg border border-error-500/30 bg-error-500/5 px-3 py-2 text-sm text-error-600 dark:text-error-400">
                {importError}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={closeModal}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleImport} loading={importLoading} disabled={!importFile}>
                {importLoading ? "Importing…" : "Import"}
              </Button>
            </div>
          </>
        )}

        {view.kind === "import-results" && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success-500/10 text-success-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {view.created.length} voter{view.created.length === 1 ? "" : "s"} imported
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Download the credentials and share with each voter.
                  {view.skipped.length > 0 && ` ${view.skipped.length} row${view.skipped.length === 1 ? " was" : "s were"} skipped.`}
                </p>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Voter ID</th>
                    <th className="px-3 py-2 font-medium">Password</th>
                    <th className="px-3 py-2 font-medium">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {view.created.map((v, i) => (
                    <tr key={i} className="text-gray-700 dark:text-gray-300">
                      <td className="px-3 py-2">{v.name}</td>
                      <td className="px-3 py-2 font-mono text-brand-500">{v.voterId}</td>
                      <td className="px-3 py-2 font-mono">{v.password}</td>
                      <td className="px-3 py-2">
                        <a
                          href={whatsappUrl(v, { orgName, voterIdLabel }, v.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Send via WhatsApp"
                          className="inline-flex items-center gap-1 text-[#128C7E] hover:underline dark:text-[#25D366]"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current shrink-0" aria-hidden="true">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.103 1.522 5.826L.057 23.854a.5.5 0 0 0 .609.61l6.098-1.475A11.949 11.949 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.898a9.898 9.898 0 0 1-5.051-1.382l-.361-.214-3.742.906.944-3.643-.235-.374A9.862 9.862 0 0 1 2.103 12C2.103 6.529 6.529 2.103 12 2.103S21.897 6.529 21.897 12 17.471 21.898 12 21.898z"/>
                          </svg>
                          WhatsApp
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {view.skipped.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  {view.skipped.length} skipped row{view.skipped.length === 1 ? "" : "s"}
                </summary>
                <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-600 dark:text-gray-400">
                      {view.skipped.map((s, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5">{s.row}</td>
                          <td className="px-3 py-1.5">{s.name}</td>
                          <td className="px-3 py-1.5">{s.email}</td>
                          <td className="px-3 py-1.5 text-error-500">{s.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Passwords are shown only once — download the CSV and distribute credentials before closing this window.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCredentialsCSV(view.created)}
              >
                Download CSV
              </Button>
              <Button size="sm" onClick={closeModal}>
                Done
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        className="m-4 max-w-md p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Remove voter
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {confirm
            ? `Remove ${confirm.name} (${confirm.email})?${
                confirm.ballotCount > 0
                  ? " This voter has already cast a ballot — removal will be blocked."
                  : ""
              }`
            : ""}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            Remove
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={resetConfirm !== null}
        onClose={() => setResetConfirm(null)}
        className="m-4 max-w-md p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Reset password
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {resetConfirm
            ? `Generate a new password for ${resetConfirm.name} (${resetConfirm.voterId})? Their current password will stop working immediately. The new password is shown only once — copy and share it through your usual channel.`
            : ""}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResetConfirm(null)}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleResetPassword} loading={resetting}>
            {resetting ? "Generating…" : "Generate new password"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-base font-semibold text-gray-900 dark:text-white ${
          mono ? "font-mono text-brand-500" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
