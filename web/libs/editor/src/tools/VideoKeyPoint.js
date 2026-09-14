import { types } from "mobx-state-tree";

import BaseTool from "./Base";
import ToolMixin from "../mixins/Tool";
import { NodeViews } from "../components/Node/Node";
import { DrawingTool } from "../mixins/DrawingTool";

const _Tool = types
  .model("VideoKeyPointTool", {
    default: types.optional(types.boolean, true),
    group: "segmentation",
    shortcut: "tool:videokeypoint",
  })
  .views((self) => ({
    get tagTypes() {
      return {
        stateTypes: "videokeypointlabels",
        controlTagTypes: ["videokeypointlabels", "videokeypoint"],
      };
    },
    get viewTooltip() {
      return "Video Key Point";
    },
    get iconComponent() {
      return NodeViews.VideoKeyPointRegionModel?.icon ?? NodeViews.KeyPointRegionModel?.icon;
    },
    isIncorrectControl() {
      return false;
    },
    isIncorrectLabel() {
      const obj = self.obj;
      if (!obj) return false;

      const labelStates = obj.activeStates?.() || [];
      if (labelStates.length === 0) return !!obj.hasStates;

      return false;
    },
  }))
  .actions((self) => ({
    clickEv(ev, [x, y]) {
      if (self.annotation?.isReadOnly()) return;

      const videoObj = self.obj;
      if (!videoObj) return;

      const wa = videoObj.workingArea;
      const waWidth = wa?.realWidth || 100;
      const waHeight = wa?.realHeight || 100;

      const normX = (x / waWidth) * 100;
      const normY = (y / waHeight) * 100;

      const area = videoObj.addVideoKeyPointRegion({
        x: normX,
        y: normY,
      });

      if (area) {
        area.notifyDrawingFinished?.();
      }
    },
  }));

const VideoKeyPoint = types.compose(_Tool.name, ToolMixin, BaseTool, DrawingTool, _Tool);

export { VideoKeyPoint };
