-- portfolios: rename description → excerpt, thumbnail → cover_image
ALTER TABLE "public"."portfolios" RENAME COLUMN "description" TO "excerpt";
ALTER TABLE "public"."portfolios" RENAME COLUMN "thumbnail" TO "cover_image";

-- categories: remove unused columns
ALTER TABLE "public"."categories" DROP COLUMN IF EXISTS "color";
ALTER TABLE "public"."categories" DROP COLUMN IF EXISTS "description";
ALTER TABLE "public"."categories" DROP COLUMN IF EXISTS "icon";

-- tags: remove unused columns and index
DROP INDEX IF EXISTS "public"."tags_post_count_idx";
ALTER TABLE "public"."tags" DROP COLUMN IF EXISTS "color";
ALTER TABLE "public"."tags" DROP COLUMN IF EXISTS "post_count";
