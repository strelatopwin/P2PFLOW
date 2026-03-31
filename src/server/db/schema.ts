import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const accessRequestsTable = pgTable("access_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  approved: boolean("approved").notNull().default(false),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AccessRequestRow = typeof accessRequestsTable.$inferSelect;
