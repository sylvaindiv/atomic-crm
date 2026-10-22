import { render } from "vitest-browser-react";
import { Form } from "ra-core";
import { commands } from "vitest/browser";
import { useWatch } from "react-hook-form";
import { StoryWrapper } from "@/test/StoryWrapper";
import { NextActionInputs } from "./NextActionInputs";

const Deadline = () => {
  const value = useWatch({ name: "next_action.due_date" });
  return (
    <>
      <NextActionInputs />
      <output data-testid="date">{value}</output>
    </>
  );
};

describe("note deadline", () => {
  it("opens the picker on the field and preserves a bare date in distant timezones", async () => {
    const original = HTMLInputElement.prototype.showPicker;
    const showPicker = vi.fn();
    HTMLInputElement.prototype.showPicker = showPicker;
    try {
      await commands.setTimezone("Pacific/Honolulu");
      const screen = await render(
        <StoryWrapper>
          <Form>
            <Deadline />
          </Form>
        </StoryWrapper>,
      );
      const input = screen.getByLabelText("Due date");
      await input.click();
      expect(showPicker).toHaveBeenCalledOnce();
      await input.fill("2026-10-25");
      await expect
        .element(screen.getByTestId("date"))
        .toHaveTextContent("2026-10-25");
      await commands.setTimezone("Pacific/Kiritimati");
      await expect.element(input).toHaveValue("2026-10-25");
      await expect
        .element(screen.getByTestId("date"))
        .toHaveTextContent("2026-10-25");
    } finally {
      HTMLInputElement.prototype.showPicker = original;
      await commands.setTimezone("Europe/Paris");
    }
  });

  it("keeps native input usable without showPicker", async () => {
    const original = HTMLInputElement.prototype.showPicker;
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      const screen = await render(
        <StoryWrapper>
          <Form>
            <Deadline />
          </Form>
        </StoryWrapper>,
      );
      const input = screen.getByLabelText("Due date");
      await input.click();
      await input.fill("2026-10-25");
      await expect
        .element(screen.getByTestId("date"))
        .toHaveTextContent("2026-10-25");
    } finally {
      HTMLInputElement.prototype.showPicker = original;
    }
  });
});
