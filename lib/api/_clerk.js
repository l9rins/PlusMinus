// api/_clerk.js — Shared Clerk client helper
// Prevents module initialization crashes when CLERK_SECRET_KEY is missing.

import { createClerkClient } from "@clerk/backend";

let clerk = null;

try {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (secretKey) {
    clerk = createClerkClient({ secretKey });
  } else {
    // Return a dummy client that fails gracefully
    clerk = {
      users: {
        getUser: async (id) => {
          console.warn(`[api/_clerk] Clerk not initialized, cannot get user: ${id}`);
          return { username: "Anonymous", firstName: "Anonymous" };
        }
      },
      verifyToken: async (token) => {
        console.warn(`[api/_clerk] Clerk not initialized, cannot verify token`);
        throw new Error("Clerk not initialized");
      }
    };
  }
} catch (err) {
  console.error("[api/_clerk] Failed to initialize Clerk client:", err.message);
}

export { clerk };
