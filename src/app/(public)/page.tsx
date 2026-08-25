import Link from "next/link";
import { BRANDING_DEFAULTS } from "@/lib/branding";

/**
 * The bare root. Every election lives under its organisation's own path, so
 * there is nothing to show here — and deliberately no list of organisations,
 * which would tell any visitor who the platform's clients are.
 */
export default function RootPage() {
  return (
    <div className="w-full max-w-md self-center text-center">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
        {BRANDING_DEFAULTS.orgName}
      </h1>
      <p className="mt-3 text-base text-gray-500 dark:text-gray-400">
        Elections are hosted at each organisation&apos;s own address. Use the
        link your election administrator sent you.
      </p>
      <p className="mt-8 text-sm text-gray-400">
        <Link
          href="/admin/sign-in"
          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Election administrator sign in
        </Link>
      </p>
    </div>
  );
}
