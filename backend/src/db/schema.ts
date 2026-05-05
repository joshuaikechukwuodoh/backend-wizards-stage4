import { pgTable, uuid, varchar, integer, real, timestamp, text, index } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  name: varchar("name").unique().notNull(),
  gender: varchar("gender"),
  gender_probability: real("gender_probability"),
  age: integer("age"),
  age_group: varchar("age_group"),
  country_id: varchar("country_id", { length: 2 }),
  country_name: varchar("country_name"),
  country_probability: real("country_probability"),
  created_at: timestamp("created_at").defaultNow()
}, (table) => {
  return {
    ageIdx: index("idx_profiles_age").on(table.age),
    genderIdx: index("idx_profiles_gender").on(table.gender),
    countryIdx: index("idx_profiles_country").on(table.country_id),
    ageGroupIdx: index("idx_profiles_age_group").on(table.age_group),
    genderAgeIdx: index("idx_profiles_gender_age").on(table.gender, table.age),
    countryGenderIdx: index("idx_profiles_country_gender").on(table.country_id, table.gender),
  };
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  github_id: varchar("github_id").unique().notNull(),
  github_username: varchar("github_username").notNull(),
  github_email: varchar("github_email"),
  github_avatar: varchar("github_avatar"),
  role: varchar("role", { length: 10 }).notNull().default("analyst"),
  created_at: timestamp("created_at").defaultNow()
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  user_id: uuid("user_id").notNull(),
  refresh_token: text("refresh_token").unique().notNull(),
  expires_at: timestamp("expires_at").notNull(),
  created_at: timestamp("created_at").defaultNow()
});