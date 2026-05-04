import * as z from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Required.").max(32, "Max 32 characters."),
  password: z
    .string()
    .min(8, "Min 8 characters.")
    .max(128, "Max 128 characters."),
});

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "At least 3 characters.")
      .max(32, "Max 32 characters.")
      .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores."),
    display_name: z
      .string()
      .min(1, "Required.")
      .max(128, "Max 128 characters."),
    password: z
      .string()
      .min(8, "At least 8 characters.")
      .max(128, "Max 128 characters."),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
