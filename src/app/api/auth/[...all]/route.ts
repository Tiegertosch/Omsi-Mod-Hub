import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Better-Auth-Endpunkte (u. a. Links aus Bestätigungs- und Reset-E-Mails).
export const { GET, POST } = toNextJsHandler(auth);
