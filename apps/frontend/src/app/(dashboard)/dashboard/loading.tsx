import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading(): JSX.Element {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={`${index}-dashboard-placeholder`} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
