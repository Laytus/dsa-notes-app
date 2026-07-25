ALTER TABLE "categories" DROP CONSTRAINT "categories_name_not_blank";--> statement-breakpoint
ALTER TABLE "problems" DROP CONSTRAINT "problems_name_not_blank";--> statement-breakpoint
ALTER TABLE "tags" DROP CONSTRAINT "tags_name_not_blank";--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_name_not_blank" CHECK ("categories"."name" !~ '^[[:space:]]*$');--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_name_not_blank" CHECK ("problems"."name" !~ '^[[:space:]]*$');--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_name_not_blank" CHECK ("tags"."name" !~ '^[[:space:]]*$');