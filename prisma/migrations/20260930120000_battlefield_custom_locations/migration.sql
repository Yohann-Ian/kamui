-- Location chips a Battlefield's search bar offers beyond the presets (added with
-- "+ New Location"). Additive only.

-- AlterTable
ALTER TABLE "Battlefield" ADD COLUMN     "customLocations" TEXT[] DEFAULT ARRAY[]::TEXT[];

