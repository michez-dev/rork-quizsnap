import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../create-context";
import { registerUser, loginUser, logoutUser } from "@/backend/store";

export const authRouter = createTRPCRouter({
  register: publicProcedure
    .input(z.object({
      email: z.string().email("Please enter a valid email"),
      password: z.string().min(6, "Password must be at least 6 characters"),
    }))
    .mutation(({ input }) => {
      const result = registerUser(input.email, input.password);
      if ("error" in result) {
        throw new Error(result.error);
      }
      return {
        user: { id: result.user.id, email: result.user.email, createdAt: result.user.createdAt },
        token: result.token,
      };
    }),

  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(({ input }) => {
      const result = loginUser(input.email, input.password);
      if ("error" in result) {
        throw new Error(result.error);
      }
      return {
        user: { id: result.user.id, email: result.user.email, createdAt: result.user.createdAt },
        token: result.token,
      };
    }),

  logout: protectedProcedure.mutation(({ ctx }) => {
    if (ctx.token) {
      logoutUser(ctx.token);
    }
    return { success: true };
  }),

  me: protectedProcedure.query(({ ctx }) => {
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      createdAt: ctx.user.createdAt,
    };
  }),
});
