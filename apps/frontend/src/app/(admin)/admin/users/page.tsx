export default function AdminUsersPage(): JSX.Element {
  return (
    <div className="border-lumi-border/60 bg-lumi-bg space-y-3 rounded-3xl border p-6">
      <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">Admin · Users</p>
      <h1 className="text-2xl font-semibold">User registry</h1>
      <p className="text-lumi-text-secondary text-sm">
        Admin user provisioning connects to the RBAC APIs in upcoming phases.
      </p>
    </div>
  );
}
