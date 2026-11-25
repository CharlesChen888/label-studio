import { FlipHorizontal, FlipVertical } from "@humansignal/icons";
import { observer } from "mobx-react";
import { types } from "mobx-state-tree";

import { Tool } from "../components/Toolbar/Tool";
import ToolMixin from "../mixins/Tool";
import BaseTool from "./Base";

const API_BASE = window.APP_SETTINGS?.hostname ?? "";

function getCsrfToken() {
  const match = document.cookie.split(";").find((cookie) => cookie.trim().startsWith("csrftoken="));
  return match ? match.trim().split("=")[1] : "";
}

const ToolView = observer(({ item }) => (
  <>
    <Tool
      icon={<FlipHorizontal />}
      ariaLabel="flip-horizontal"
      label="Flip Horizontal"
      onClick={() => item.flip("horizontal")}
    />
    <Tool
      icon={<FlipVertical />}
      ariaLabel="flip-vertical"
      label="Flip Vertical"
      onClick={() => item.flip("vertical")}
    />
  </>
));

const _Tool = types
  .model("FlipTool", {
    group: "control",
  })
  .views((self) => ({
    get viewClass() {
      return () => <ToolView item={self} />;
    },
  }))
  .actions((self) => ({
    async flip(direction) {
      const image = self.obj;
      const taskId = image?.store?.task?.id;
      const dataField = image?.usedValue?.replace(/^\$/, "");

      if (!taskId || !dataField) return;

      try {
        const response = await fetch(`${API_BASE}/api/tasks/${taskId}/flip-image/`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCsrfToken(),
          },
          body: JSON.stringify({
            direction,
            data_field: dataField,
            item_index: image.multiImage ? image.currentImage : undefined,
          }),
        });
        const result = await response.json();

        if (!response.ok) throw new Error(result?.detail ?? "Unable to flip image");

        if (window.confirm("The flipped image was saved as a new task. Delete the original task?")) {
          const deleteResponse = await fetch(`${API_BASE}/api/tasks/${taskId}/`, {
            method: "DELETE",
            credentials: "same-origin",
            headers: { "X-CSRFToken": getCsrfToken() },
          });
          if (!deleteResponse.ok) window.alert("The new task was created, but the original task could not be deleted.");
        }

        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("task", result.task.id);
        nextUrl.searchParams.delete("annotation");
        window.location.assign(nextUrl.toString());
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Unable to flip image");
      }
    },
  }));

const Flip = types.compose(_Tool.name, ToolMixin, BaseTool, _Tool);

export { Flip };
