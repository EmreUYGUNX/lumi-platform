DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaVisibility') THEN
    CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'INTERNAL');
  END IF;
END $$;

ALTER TABLE "media_assets"
  ADD COLUMN IF NOT EXISTS "visibility" "MediaVisibility" NOT NULL DEFAULT 'PUBLIC';
