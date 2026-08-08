import { render, screen } from "@testing-library/react";
import { AnnotationAccepted } from "./AnnotationAccepted";

describe("AnnotationAccepted", () => {
  it("renders a hyphen for unreviewed values", () => {
    render(<AnnotationAccepted value="unreviewed" />);

    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
