import type { CollectionCardProps } from "./CollectionCard";
import { CollectionCard } from "./CollectionCard";

interface ExploreCollectionsProps {
  primary: CollectionCardProps[];
  secondary: CollectionCardProps[];
}

export function ExploreCollections({ primary, secondary }: ExploreCollectionsProps): JSX.Element {
  return (
    <section className="bg-white py-20 text-black">
      <div className="container space-y-14">
        <div className="space-y-2 text-center">
          <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.28em]">
            Explore
          </p>
          <h2 className="text-2xl font-bold uppercase tracking-[0.24em]">
            THE MAISON&apos;S COLLECTIONS
          </h2>
        </div>

        <div className="space-y-10">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {primary.map((collection) => (
              <CollectionCard key={collection.title} {...collection} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {secondary.map((collection) => (
              <CollectionCard key={collection.title} {...collection} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
