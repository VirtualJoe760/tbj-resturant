CREATE TABLE "dayparts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"starts_at" text NOT NULL,
	"ends_at" text NOT NULL,
	"days" integer[] DEFAULT '{0,1,2,3,4,5,6}' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "daypart_ids" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "images" text[] DEFAULT '{}' NOT NULL;