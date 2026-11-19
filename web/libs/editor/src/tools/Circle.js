import { types } from "mobx-state-tree";

import BaseTool, { DEFAULT_DIMENSIONS } from "./Base";
import ToolMixin from "../mixins/Tool";
import { TwoPointsDrawingTool } from "../mixins/DrawingTool";
import { NodeViews } from "../components/Node/Node";

const CircleTool = types
  .model("CircleTool", {
    group: "segmentation",
    shortcut: "tool:circle",
  })
  .views((self) => {
    const Super = {
      createRegionOptions: self.createRegionOptions,
    };

    return {
      get tagTypes() {
        return {
          stateTypes: "circlelabels",
          controlTagTypes: ["circlelabels", "circle"],
        };
      },
      get viewTooltip() {
        return "Circle region";
      },
      get iconComponent() {
        return self.dynamic ? NodeViews.CircleRegionModel.altIcon : NodeViews.CircleRegionModel.icon;
      },
      get defaultDimensions() {
        const { radius } = DEFAULT_DIMENSIONS.ellipse;
        const axisRadius = radius / Math.sqrt(2);

        return { width: axisRadius, height: axisRadius };
      },
      createRegionOptions({ x, y }) {
        return Super.createRegionOptions({ x, y, radius: 1 });
      },
    };
  })
  .actions((self) => ({
    draw(x, y) {
      const shape = self.getCurrentArea();

      if (!shape) return;

      const centerX = self.obj.internalToCanvasX(shape.startX);
      const centerY = self.obj.internalToCanvasY(shape.startY);
      const canvasX = self.obj.internalToCanvasX(x);
      const canvasY = self.obj.internalToCanvasY(y);
      const requestedRadius = Math.hypot(canvasX - centerX, canvasY - centerY);
      const maxRadius = Math.min(
        centerX,
        centerY,
        self.obj.stageWidth - centerX,
        self.obj.stageHeight - centerY,
      );
      const radius = Math.min(requestedRadius, maxRadius);

      shape.setPositionInternal(
        shape.startX,
        shape.startY,
        self.obj.canvasToInternalX(radius),
        self.obj.canvasToInternalX(radius),
        0,
      );
    },

    beforeCommitDrawing() {
      return self.getActiveShape.radius > Math.min(self.MIN_SIZE.X, self.MIN_SIZE.Y);
    },
  }));

const Circle = types.compose(CircleTool.name, ToolMixin, BaseTool, TwoPointsDrawingTool, CircleTool);

export { Circle };
