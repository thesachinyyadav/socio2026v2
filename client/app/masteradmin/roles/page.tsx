import Link from "next/link";
import RolesManagementTable from "./RolesManagementTable";
import { getRolesTableData } from "./actions";

export const dynamic = "force-dynamic";

export default async function MasterAdminRolesPage() {
  try {
    const initialData = await getRolesTableData();

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                  SOCIO Module 11
                </p>
                <h1 className="mt-2 text-3xl font-black text-slate-900">
                  Master Admin Role Control
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Manage global and domain-scoped role access in one place.
                </p>
              </div>

              <Link
                href="/masteradmin"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Back to Admin Home
              </Link>
            </div>
          </div>

          <RolesManagementTable initialData={initialData} />
        </div>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Unable to Load Roles Panel</h1>
          <p className="mt-3 text-sm text-slate-600">
            {error?.message || "You may not have permission to view this page."}
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
