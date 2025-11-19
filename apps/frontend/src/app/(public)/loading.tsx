import { Skeleton } from "@/components/ui/skeleton";

export default function PublicLoading(): JSX.Element {
  return (
    <div className="container space-y-8 py-12">
      <Skeleton className="h-10 w-1/2" />
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`${index}-public-loading`}
            className="glass-panel space-y-4 rounded-2xl border p-4"
          >
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
