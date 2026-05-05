import * as z from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, "username is required")
    .max(32, "username can't be more than 32 characters"),
  password: z
    .string()
    .min(8, "password must be at least 8 characters")
    .max(128, "password can't be more than 128 characters"),
});

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(1, "username is required")
      .max(32, "username can't be more than 32 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Only letters, numbers, and underscores allowed",
      ),
    display_name: z
      .string()
      .min(1, "display name is required")
      .max(128, "display name can't be more than 128 characters"),
    password: z
      .string()
      .min(8, "password must be at least 8 characters")
      .max(128, "password can't be more than 128 characters"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
