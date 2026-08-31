import { Form } from "ra-core";
import { render } from "vitest-browser-react";
import { StoryWrapper, buildContact } from "@/test/StoryWrapper";
import { ContactInputs } from "./ContactInputs";

describe("ContactInputs", () => {
  it("renders postal_code and city fields in the address section", async () => {
    const screen = await render(
      <StoryWrapper data={{ contacts: [buildContact()] }}>
        <Form defaultValues={buildContact()}>
          <ContactInputs />
        </Form>
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByLabelText(/postal code/i))
      .toBeInTheDocument();
    await expect.element(screen.getByLabelText(/^city/i)).toBeInTheDocument();
  });

  it("allows filling postal_code and city fields", async () => {
    const contact = buildContact({
      postal_code: "75001",
      city: "Paris",
    });

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <Form defaultValues={contact}>
          <ContactInputs />
        </Form>
      </StoryWrapper>,
    );

    const postalCodeInput = screen.getByLabelText(/postal code/i);
    const cityInput = screen.getByLabelText(/^city/i);

    await expect.element(postalCodeInput).toHaveValue("75001");
    await expect.element(cityInput).toHaveValue("Paris");
  });

  it("shows a visible affordance to change the avatar photo", async () => {
    const screen = await render(
      <StoryWrapper data={{ contacts: [buildContact()] }}>
        <Form defaultValues={buildContact()}>
          <ContactInputs />
        </Form>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Change")).toBeInTheDocument();

    await screen.getByText("Change").click();

    await expect
      .element(screen.getByText("Upload and resize image"))
      .toBeInTheDocument();
  });
});
