ALTER TABLE "escalas" ADD COLUMN "ordem" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "registros" ADD COLUMN "ministerio_id" text;--> statement-breakpoint
CREATE INDEX "registros_ministerio_idx" ON "registros" USING btree ("ministerio_id");