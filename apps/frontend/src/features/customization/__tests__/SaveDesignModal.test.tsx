import { useState } from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SaveDesignModal } from "../components/editor/SaveDesignModal";

describe("SaveDesignModal", () => {
  it("allows editing fields and saving", async () => {
    const user = userEvent.setup();

    const onOpenChange = vi.fn();
    const onNameChange = vi.fn();
    const onTagsChange = vi.fn();
    const onIsPublicChange = vi.fn();
    const onAutoSaveEnabledChange = vi.fn();
    const onSave = vi.fn();

    const Harness = () => {
      const [name, setName] = useState("My design");
      const [tags, setTags] = useState<string[]>(["initial"]);
      const [isPublic, setIsPublic] = useState(false);
      const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

      return (
        <SaveDesignModal
          open
          onOpenChange={onOpenChange}
          name={name}
          onNameChange={(value) => {
            onNameChange(value);
            setName(value);
          }}
          tags={tags}
          onTagsChange={(value) => {
            onTagsChange(value);
            setTags(value);
          }}
          isPublic={isPublic}
          onIsPublicChange={(value) => {
            onIsPublicChange(value);
            setIsPublic(value);
          }}
          autoSaveEnabled={autoSaveEnabled}
          onAutoSaveEnabledChange={(value) => {
            onAutoSaveEnabledChange(value);
            setAutoSaveEnabled(value);
          }}
          canSave
          isSaving={false}
          statusLabel="All changes saved"
          onSave={onSave}
        />
      );
    };

    render(<Harness />);

    const nameInput = screen.getByLabelText("Design name") as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Holiday");
    expect(onNameChange).toHaveBeenLastCalledWith("Holiday");

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Public (share link)"));
    expect(onIsPublicChange).toHaveBeenCalledWith(true);

    const tagsInput = screen.getByLabelText("Tags") as HTMLInputElement;
    await user.clear(tagsInput);
    await user.type(tagsInput, "holiday, logo, v1 ");
    await user.tab();
    expect(onTagsChange).toHaveBeenCalledWith(["holiday", "logo", "v1"]);

    await user.click(screen.getByRole("switch", { name: "Auto-save toggle" }));
    expect(onAutoSaveEnabledChange).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalled();
  });
});
