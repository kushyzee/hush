"use client";

import { useForm } from "@tanstack/react-form";
import { loginSchema } from "../types";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
} from "@/shared/components/ui/field";
import logo from "@/app/icon.svg";
import Link from "next/link";
import Image from "next/image";

export default function LoginForm() {
  const form = useForm({
    defaultValues: { username: "", password: "" },
    validators: {
      onChange: loginSchema,
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      console.log("Login submitted:", value);
    },
  });

  return (
    <div className="w-full max-w-md mx-auto p-8 rounded-2xl bg-card border border-border shadow-md">
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="p-4 bg-(--brand-glow) rounded-full mb-6">
          <Image src={logo} alt="Hush logo" width={64} height={64} />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Welcome Back
        </h2>
        <p className="text-muted-foreground text-sm">
          Enter your credentials to access your chats
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        <FieldGroup>
          <form.Field name="username">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="your_username"
                    autoComplete="username"
                    className="bg-background border-input text-foreground"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="password">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="bg-background border-input text-foreground"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>
        </FieldGroup>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="w-full mt-2"
            >
              {isSubmitting ? "Unlocking vault…" : "Sign in"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="text-primary hover:underline underline-offset-4"
        >
          Create one
        </Link>
      </div>
    </div>
  );
}
