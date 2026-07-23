ALTER TABLE "notebooks" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
CREATE INDEX "notebooks_user_id_idx" ON "notebooks" USING btree ("user_id");