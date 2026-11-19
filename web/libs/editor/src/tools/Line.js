import { types } from "mobx-state-tree";

import BaseTool, { DEFAULT_DIMENSIONS } from "./Base";
import ToolMixin from "../mixins/Tool";
import { TwoPointsDrawingTool } from "../mixins/DrawingTool";
import { NodeViews } from "../components/Node/Node";

const LineTool = types
  .model("LineTool", {
    group: "segmentation",
    shortcut: "tool:line",
  })
  .views((self) => {
    const Super = {
      createRegionOptions: self.createRegionOptions,
    };

    return {
      get tagTypes() {
        return {
          stateTypes: "linelabels",
          controlTagTypes: ["linelabels", "line"],
        };
      },
      get viewTooltip() {
        return "Line segment";
      },
      get iconComponent() {
        return self.dynamic ? NodeViews.LineRegionModel.altIcon : NodeViews.LineRegionModel.icon;
      },
      get defaultDimensions() {
        const { length } = DEFAULT_DIMENSIONS.vector;

        return { width: length, height: length };
      },
      createRegionOptions({ x, y }) {
        return Super.createRegionOptions({ x1: x, y1: y, x2: x, y2: y });
      },
    };
  })
  .actions((self) => ({
    draw(x, y) {
      const shape = self.getCurrentArea();

      if (!shape) return;

      const point = self.control?.getSnappedPoint?.({ x, y }) ?? { x, y };

      shape.setPositionInternal(shape.startX, shape.startY, point.x, point.y);
    },

    beforeCommitDrawing() {
      const shape = self.getActiveShape;
      const startX = self.obj.internalToCanvasX(shape.x1);
      const startY = self.obj.internalToCanvasY(shape.y1);
      const endX = self.obj.internalToCanvasX(shape.x2);
      const endY = self.obj.internalToCanvasY(shape.y2);
      const minimum = Math.min(
        self.obj.internalToCanvasX(self.MIN_SIZE.X),
        self.obj.internalToCanvasY(self.MIN_SIZE.Y),
      );

      return Math.hypot(endX - startX, endY - startY) > minimum;
    },
  }));

const Line = types.compose(LineTool.name, ToolMixin, BaseTool, TwoPointsDrawingTool, LineTool);

export { Line };
