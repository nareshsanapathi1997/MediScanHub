ALTER TABLE "Sample" ADD COLUMN "assigneeId" UUID;

ALTER TABLE "Sample"
  ADD CONSTRAINT "Sample_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Sample_assigneeId_idx" ON "Sample"("assigneeId");
