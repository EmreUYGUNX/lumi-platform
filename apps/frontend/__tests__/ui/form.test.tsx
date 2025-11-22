import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useForm } from "react-hook-form";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface FormValues {
  email: string;
}

describe("Form components", () => {
  it("links labels to controls for accessibility", () => {
    const { result: form } = renderHook(() =>
      useForm<FormValues>({
        defaultValues: { email: "" },
      }),
    );

    const Harness = () => (
      <Form {...form.current}>
        <form>
          <FormField
            control={form.current.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <input placeholder="you@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    );

    render(<Harness />);

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input.getAttribute("id")).toContain("form-item");
  });

  it("surfaces validation errors through FormMessage", async () => {
    const FormWithSubmit = () => {
      const form = useForm<FormValues>({
        defaultValues: { email: "" },
      });

      return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(() => {})}>
            <FormField
              control={form.control}
              name="email"
              rules={{ required: "Email is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <input placeholder="validation@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <button type="submit">Submit</button>
          </form>
        </Form>
      );
    };

    render(<FormWithSubmit />);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    });

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });
});
