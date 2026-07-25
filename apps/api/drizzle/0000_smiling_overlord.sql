CREATE TYPE "public"."problem_difficulty" AS ENUM('Easy', 'Medium', 'Hard');--> statement-breakpoint
CREATE TYPE "public"."problem_status" AS ENUM('To solve', 'Attempted', 'Solved', 'Needs review', 'Mastered');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_not_blank" CHECK (btrim("categories"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "problem_tags" (
	"problem_id" bigint NOT NULL,
	"tag_id" bigint NOT NULL,
	CONSTRAINT "problem_tags_pk" PRIMARY KEY("problem_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "problems_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"category_id" bigint NOT NULL,
	"difficulty" "problem_difficulty",
	"status" "problem_status" DEFAULT 'To solve' NOT NULL,
	"last_reviewed_on" date,
	"times_solved" integer DEFAULT 0 NOT NULL,
	"solution_url" text,
	"solution_label" text,
	"source_url" text,
	"source_label" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problems_name_not_blank" CHECK (btrim("problems"."name") <> ''),
	CONSTRAINT "problems_times_solved_nonnegative" CHECK ("problems"."times_solved" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_not_blank" CHECK (btrim("tags"."name") <> '')
);
--> statement-breakpoint
ALTER TABLE "problem_tags" ADD CONSTRAINT "problem_tags_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_tags" ADD CONSTRAINT "problem_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_lower_unique" ON "categories" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "problem_tags_tag_id_problem_id_idx" ON "problem_tags" USING btree ("tag_id","problem_id");--> statement-breakpoint
CREATE INDEX "problems_category_id_idx" ON "problems" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_lower_unique" ON "tags" USING btree (lower("name"));