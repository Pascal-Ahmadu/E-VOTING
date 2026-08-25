import Link from "next/link";
import { BRANDING_DEFAULTS } from "@/lib/branding";

/**
 * The bare root. Every election lives under its organisation's own path, so
 * there is nothing to show a voter here — and deliberately no list of
 * organisations, which would tell any visitor who the platform's clients are.
 *
 * The two sign-in links are kept small and unadvertised: neither audience
 * should arrive here by design, but a completely unlinked console is one people
 * forget the address of.
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

      <div className="mt-10 flex flex-col items-center gap-3 border-t border-gray-200 pt-6 text-sm dark:border-gray-800">
        <Link
          href="/admin/sign-in"
          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Election administrator sign in
        </Link>
        <Link
          href="/platform/sign-in"
          className="text-gray-400 hover:text-gray-600 hover:underline dark:hover:text-gray-300"
        >
          Platform operator sign in
        </Link>
      </div>
    </div>
  );
}
