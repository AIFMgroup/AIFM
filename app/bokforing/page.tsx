import Image from "next/image";
import Link from "next/link";

import { getSession } from "@/lib/auth/session";

export const revalidate = 0;

export default async function BookkeepingPage() {
  const session = await getSession();
  const firstName =
    (session as any)?.given_name || (session as any)?.name || "Medarbetare";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 px-8 py-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-4">
            <Image
              src="/AIFM_gubbe.png"
              alt="AIFM Logo"
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
            />
            <p className="text-lg text-gray-800">
              Hej {firstName}!
            </p>
          </Link>
        </div>
        <Link
          href="/"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Tillbaka
        </Link>
      </header>

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center px-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-gray-900">
            Bokföring
          </h1>
          <p className="mt-4 text-gray-600">
            Här kommer bokföringsstegen att visas...
          </p>
        </div>
      </main>
    </div>
  );
}
