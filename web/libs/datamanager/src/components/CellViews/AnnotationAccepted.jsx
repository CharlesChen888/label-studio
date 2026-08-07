import { Badge } from "@humansignal/ui";

export const AnnotationAccepted = ({ value }) => {
  if (value === "accepted") {
    return <Badge variant="positive">AC</Badge>;
  }

  if (value === "rejected") {
    return <Badge variant="negative">X</Badge>;
  }

  return null;
};

AnnotationAccepted.userSelectable = false;
