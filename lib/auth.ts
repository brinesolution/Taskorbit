import { checkout, polar, portal } from "@polar-sh/better-auth";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import prisma from "@/lib/db";
import { polarClient } from "@/lib/polar";

const socialProviders = {
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
      }
    : {}),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
};

const plugins =
  polarClient && process.env.POLAR_SUCCESS_URL
    ? [
        polar({
          client: polarClient,
          createCustomerOnSignUp: true,
          use: [
            checkout({
              products: [
                {
                  productId: "2113287e-e2ac-4b2d-be86-04ade7fbec92",
                  slug: "pro",
                },
              ],
              successUrl: process.env.POLAR_SUCCESS_URL,
              authenticatedUsersOnly: true,
            }),
            portal(),
          ],
        }),
      ]
    : [];

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },

  socialProviders,
  plugins,
});
