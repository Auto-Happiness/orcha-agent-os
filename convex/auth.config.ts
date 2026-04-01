export default {
  providers: [
    {
      domain: process.env.CLERK_ISSUER_DOMAIN || "https://suited-ox-6.clerk.accounts.dev",
      applicationID: "convex",
    },
  ]
};
