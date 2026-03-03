import { createTRPCRouter } from "./create-context";
import { authRouter } from "./routes/auth";
import { syncRouter } from "./routes/sync";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  sync: syncRouter,
});

export type AppRouter = typeof appRouter;
