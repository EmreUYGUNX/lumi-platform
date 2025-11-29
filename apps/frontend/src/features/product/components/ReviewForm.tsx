"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sessionStore } from "@/store/session";

import { RatingStars } from "./RatingStars";

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().min(3).max(120),
  content: z.string().min(12).max(800),
  image: z.string().url().optional().or(z.literal("")),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  onSubmit: (input: {
    rating: number;
    title: string;
    content: string;
    media?: { url: string }[];
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function ReviewForm({ onSubmit, isSubmitting }: ReviewFormProps): JSX.Element {
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 5,
      title: "",
      content: "",
      image: "",
    },
  });

  const isAuthenticated = sessionStore((state) => state.isAuthenticated);

  const handleSubmit = async (values: ReviewFormValues) => {
    await onSubmit({
      rating: values.rating,
      title: values.title,
      content: values.content,
      media: values.image ? [{ url: values.image }] : undefined,
    });
    form.reset({ rating: 5, title: "", content: "", image: "" });
  };

  return (
    <div className="border-lumi-border/70 rounded-2xl border bg-white/70 p-4 shadow-md backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-lumi-text text-[11px] font-semibold uppercase tracking-[0.2em]">
            Write a Review
          </p>
          <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.16em]">
            Share your experience with other Lumi customers.
          </p>
        </div>
        {!isAuthenticated && (
          <div className="bg-lumi-warning/10 text-lumi-warning flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
            <AlertCircle className="h-3.5 w-3.5" />
            Login required
          </div>
        )}
      </div>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] uppercase tracking-[0.18em]">Rating</FormLabel>
                <FormControl>
                  <RatingStars
                    value={field.value}
                    interactive
                    size="lg"
                    onChange={(value) => field.onChange(value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] uppercase tracking-[0.18em]">Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Premium fit and finish"
                      className="uppercase tracking-[0.14em]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] uppercase tracking-[0.18em]">
                    Image URL (optional)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] uppercase tracking-[0.18em]">Review</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder="Tell us about fit, material, and styling."
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="bg-lumi-text w-full rounded-full uppercase tracking-[0.2em] text-white hover:opacity-90"
            disabled={isSubmitting || !isAuthenticated}
          >
            {isSubmitting ? "Sending..." : "Submit review"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
