import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

/* ---------------------------------------------------------------------------
   Auth.js — shape required by @auth/drizzle-adapter.
--------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
  /**
   * Secret path segment for the calendar feed. Apple Calendar and Google
   * Calendar fetch a subscription URL unauthenticated, so the URL itself is
   * the credential. Null until the user first asks for the feed.
   */
  calendarToken: text("calendar_token").unique(),
  /**
   * Days of silence before a follow-up nudge. Null means off, which is the
   * default: nobody is opted into email they did not ask for.
   */
  followUpDays: integer("follow_up_days"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/**
 * One row per nudge actually sent. This is what makes the cron idempotent — it
 * can run twice in a minute, or be retried after a crash, without emailing
 * anyone twice — and it is also the "only once per application" rule: a weekly
 * reminder about the same dead application is nagging, not a service.
 */
export const reminders = pgTable(
  "reminders",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reminders_application_idx").on(t.applicationId)],
);

/* ---------------------------------------------------------------------------
   Billing — filled in during phase 4. `plan` and `periodEnd` live here so the
   render path never has to call the payment provider's API.
--------------------------------------------------------------------------- */

export const planEnum = pgEnum("plan", ["free", "pro", "teams"]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
]);

export const subscriptions = pgTable("subscriptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  customerId: text("customer_id"),
  subscriptionId: text("subscription_id"),
  plan: planEnum("plan").notNull().default("free"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Webhook idempotency: the provider's event id is the primary key. */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------------------------------------------------------------------------
   The docket itself.
--------------------------------------------------------------------------- */

/**
 * A column on the board. Every user owns their own ordered set, seeded with a
 * default funnel on first use and editable from there.
 *
 * `kind` is not decoration: the board needs to know where an entry starts and
 * which columns end the process, and that must survive the user renaming
 * "Offer received" to whatever they like.
 */
export const stageKindEnum = pgEnum("stage_kind", ["start", "middle", "won", "lost"]);

export const stages = pgTable(
  "stages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Sparse ordering, so a column can be inserted between two others. */
    position: integer("position").notNull(),
    kind: stageKindEnum("kind").notNull().default("middle"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stages_user_position_idx").on(t.userId, t.position)],
);

export const applications = pgTable(
  "applications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Per-user sequential protocol number. Nº 001 belongs to each docket. */
    protocolNumber: integer("protocol_number").notNull(),
    company: text("company").notNull(),
    website: text("website"),
    position: text("position").notNull(),
    city: text("city"),
    country: text("country"),
    notes: text("notes"),
    /** Cache of the latest status_events row; status_events stays the history. */
    stageId: text("stage_id").references(() => stages.id, { onDelete: "set null" }),
    /** The pasted job ad. Kept so the detector can be re-run as the dictionary grows. */
    jobDescription: text("job_description"),
    /**
     * IANA zone captured from the browser when the entry was stamped. The
     * stamp must keep showing the local time of the moment it was created,
     * even when the person reads it later from another country.
     */
    timezone: text("timezone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("applications_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("applications_user_company_idx").on(t.userId, t.company),
    uniqueIndex("applications_user_protocol_idx").on(t.userId, t.protocolNumber),
    index("applications_stage_idx").on(t.stageId),
  ],
);

export const applicationTags = pgTable(
  "application_tags",
  {
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    /** Preserves the order the detector found them in. */
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.applicationId, t.tag] }),
    index("application_tags_tag_idx").on(t.tag),
  ],
);

/** Append-only. Never update or delete a row here. */
export const statusEvents = pgTable(
  "status_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    stageId: text("stage_id").references(() => stages.id, { onDelete: "set null" }),
    /** Kept alongside the reference so history survives a column being deleted. */
    stageName: text("stage_name").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
  },
  (t) => [index("status_events_application_idx").on(t.applicationId, t.occurredAt)],
);

/**
 * A scheduled interview. Reached only through its application, which is what
 * ties it to an owner — there is no userId here on purpose, so a row cannot
 * disagree with its parent about who it belongs to.
 */
export const interviews = pgTable(
  "interviews",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    /** Minutes. The calendar needs a duration to emit a real DTEND. */
    durationMinutes: integer("duration_minutes").notNull().default(60),
    location: text("location"),
    notes: text("notes"),
    /**
     * IANA zone the interview was scheduled in. Without it the month grid has
     * to guess, and a 09:00 in Auckland lands on the wrong day in UTC.
     */
    timezone: text("timezone"),
    /** Minutes before the start for the VALARM the calendar clients fire. */
    remindMinutes: integer("remind_minutes").notNull().default(60),
    /** Stable across edits so subscribed calendars update instead of duplicating. */
    uid: text("uid")
      .notNull()
      .$defaultFn(() => `${crypto.randomUUID()}@docket.app`),
    /** Bumped on every edit; calendar clients use it to pick the newer copy. */
    sequence: integer("sequence").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("interviews_application_starts_idx").on(t.applicationId, t.startsAt)],
);

/* --------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many, one }) => ({
  applications: many(applications),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(users, { fields: [applications.userId], references: [users.id] }),
  stage: one(stages, { fields: [applications.stageId], references: [stages.id] }),
  tags: many(applicationTags),
  events: many(statusEvents),
  interviews: many(interviews),
}));

export const stagesRelations = relations(stages, ({ one, many }) => ({
  user: one(users, { fields: [stages.userId], references: [users.id] }),
  applications: many(applications),
}));

export const interviewsRelations = relations(interviews, ({ one }) => ({
  application: one(applications, {
    fields: [interviews.applicationId],
    references: [applications.id],
  }),
}));

export const applicationTagsRelations = relations(applicationTags, ({ one }) => ({
  application: one(applications, {
    fields: [applicationTags.applicationId],
    references: [applications.id],
  }),
}));

export const statusEventsRelations = relations(statusEvents, ({ one }) => ({
  application: one(applications, {
    fields: [statusEvents.applicationId],
    references: [applications.id],
  }),
}));

export const schema = {
  users,
  accounts,
  sessions,
  verificationTokens,
  subscriptions,
  webhookEvents,
  applications,
  applicationTags,
  statusEvents,
  stages,
  interviews,
  reminders,
  usersRelations,
  stagesRelations,
  interviewsRelations,
  applicationsRelations,
  applicationTagsRelations,
  statusEventsRelations,
};

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type Stage = typeof stages.$inferSelect;
export type StageKind = (typeof stageKindEnum.enumValues)[number];
export type Interview = typeof interviews.$inferSelect;
