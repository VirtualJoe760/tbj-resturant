import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db/client";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-change-me-in-env-0123456789",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  // Google / Facebook are enabled per client after they sign (docs/13-accounts-roles.md).
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
      : {}),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? { facebook: { clientId: process.env.FACEBOOK_CLIENT_ID, clientSecret: process.env.FACEBOOK_CLIENT_SECRET } }
      : {}),
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "customer", input: false },
      isTestAccount: { type: "boolean", defaultValue: false, input: false },
      disabled: { type: "boolean", defaultValue: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (sess) => {
          const u = await db.query.user.findFirst({ where: (t, { eq }) => eq(t.id, sess.userId) });
          if (u?.disabled) return false; // test accounts are switched off on live sites
          return { data: sess };
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export const socialEnabled = {
  google: !!process.env.GOOGLE_CLIENT_ID,
  facebook: !!process.env.FACEBOOK_CLIENT_ID,
};
