import { toNodeHandler } from "better-auth/node";
import { auth } from "@/lib/auth";

// better-auth parses the body itself.
export const config = { api: { bodyParser: false } };

export default toNodeHandler(auth.handler);
