import { Polar } from "@polar-sh/sdk";

export const polarClient = process.env.POLAR_ACCESS_TOKEN
  ? new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      server: "sandbox",
    })
  : null;
