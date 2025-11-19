import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading(): JSX.Element {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={`${index}-admin-loading`} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
