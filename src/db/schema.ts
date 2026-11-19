import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** People the app has seen, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const prompts = sqliteTable(
  "prompts",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    model: text("model").notNull(),
    compareModel: text("compare_model"),
    systemInstruction: text("system_instruction").notNull().default(""),
    temperature: real("temperature").notNull().default(1),
    topP: real("top_p").notNull().default(0.95),
    maxOutputTokens: integer("max_output_tokens").notNull().default(2048),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("prompts_owner_updated").on(table.ownerId, table.updatedAt)],
);

/**
 * One message of a prompt. A user turn and the model's answer sit at
 * consecutive positions; with compare on, the second model's answer shares
 * the position in slot 1.
 */
export const turns = sqliteTable(
  "turns",
  {
    id: text("id").primaryKey(),
    promptId: text("prompt_id").notNull(),
    position: integer("position").notNull(),
    slot: integer("slot").notNull().default(0),
    role: text("role", { enum: ["user", "model"] }).notNull(),
    text: text("text").notNull().default(""),
    model: text("model"),
    rating: integer("rating").notNull().default(0),
    error: text("error"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("turns_prompt").on(table.promptId, table.position, table.slot)],
);

export const apps = sqliteTable(
  "apps",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    visibility: text("visibility", { enum: ["private", "organization"] })
      .notNull()
      .default("private"),
    remixedFromId: text("remixed_from_id"),
    remixedFromName: text("remixed_from_name"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("apps_owner").on(table.ownerId, table.updatedAt),
    index("apps_visibility").on(table.visibility, table.updatedAt),
  ],
);

export const appVersions = sqliteTable(
  "app_versions",
  {
    id: text("id").primaryKey(),
    appId: text("app_id").notNull(),
    number: integer("number").notNull(),
    instruction: text("instruction").notNull(),
    html: text("html").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("app_versions_number").on(table.appId, table.number)],
);
