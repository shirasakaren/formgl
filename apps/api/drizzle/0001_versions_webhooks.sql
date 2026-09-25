CREATE TABLE "form_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"status" integer,
	"ok" boolean DEFAULT false NOT NULL,
	"duration_ms" integer,
	"error" text,
	"response_body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"url" text NOT NULL,
	"kind" text DEFAULT 'json' NOT NULL,
	"secret" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "live" jsonb;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "live_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "live_hash" text;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "live_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_versions_form_idx" ON "form_versions" USING btree ("form_id","version");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_hook_idx" ON "webhook_deliveries" USING btree ("webhook_id","created_at");--> statement-breakpoint
CREATE INDEX "webhooks_form_idx" ON "webhooks" USING btree ("form_id");--> statement-breakpoint
-- forms published before versioning: what respondents see today becomes version 1
UPDATE "forms" SET "live" = jsonb_build_object('title', "title", 'description', "description", 'fields', "fields", 'theme', "theme", 'settings', "settings"), "live_version" = 1, "live_published_at" = coalesce("published_at", "updated_at") WHERE "status" <> 'draft';
--> statement-breakpoint
INSERT INTO "form_versions" ("form_id", "version", "snapshot", "note", "created_at") SELECT "id", 1, "live", 'Published before version history', coalesce("published_at", "updated_at") FROM "forms" WHERE "live" IS NOT NULL;
