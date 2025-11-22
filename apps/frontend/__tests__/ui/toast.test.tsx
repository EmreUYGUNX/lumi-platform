import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Toaster } from "@/components/ui/toaster";
import { reducer, resetToastState, toast } from "@/hooks/use-toast";

afterEach(() => {
  resetToastState();
});

describe("Toast notifications", () => {
  it("renders a toast and allows dismissal", async () => {
    const user = userEvent.setup();
    render(<Toaster />);

    act(() => {
      toast({ title: "Saved", description: "Profile updated" });
    });

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Profile updated")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByText("Saved")).not.toBeInTheDocument());
  });

  it("keeps only the most recent toast when the queue exceeds the limit", async () => {
    render(<Toaster />);

    act(() => {
      toast({ title: "Toast 1" });
      toast({ title: "Toast 2" });
    });

    await waitFor(() => expect(screen.getByText("Toast 2")).toBeInTheDocument());
    expect(screen.queryByText("Toast 1")).not.toBeInTheDocument();
  });

  it("reducer updates and removes toast entries", () => {
    const baseState = { toasts: [] as { id: string; open?: boolean; description?: string }[] };
    const added = reducer(baseState, {
      type: "ADD_TOAST",
      toast: { id: "toast-1", title: "Hello", description: "World", open: true },
    });
    expect(added.toasts).toHaveLength(1);

    const updated = reducer(added, {
      type: "UPDATE_TOAST",
      toast: { id: "toast-1", description: "Updated copy" },
    });
    expect(updated.toasts[0]?.description).toBe("Updated copy");

    const dismissed = reducer(updated, { type: "DISMISS_TOAST", toastId: "toast-1" });
    expect(dismissed.toasts[0]?.open).toBe(false);

    const dismissedAll = reducer(dismissed, { type: "DISMISS_TOAST" });
    expect(dismissedAll.toasts.every((toastItem) => toastItem.open === false)).toBe(true);

    const removed = reducer(dismissedAll, { type: "REMOVE_TOAST" });
    expect(removed.toasts).toHaveLength(0);
  });
});
