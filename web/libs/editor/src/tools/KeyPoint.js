import { types } from "mobx-state-tree";

import BaseTool from "./Base";
import ToolMixin from "../mixins/Tool";
import { NodeViews } from "../components/Node/Node";
import { DrawingTool } from "../mixins/DrawingTool";

const _Tool = types
  .model("KeyPointTool", {
    default: types.optional(types.boolean, true),
    group: "segmentation",
    shortcut: "tool:key-point",
    smart: true,
  })
  .views(() => ({
    get tagTypes() {
      return {
        stateTypes: "keypointlabels",
        controlTagTypes: ["keypointlabels", "keypoint"],
      };
    },
    get viewTooltip() {
      return "Key Point";
    },
    get iconComponent() {
      return self.dynamic ? NodeViews.KeyPointRegionModel.altIcon : NodeViews.KeyPointRegionModel.icon;
    },
  }))
  .actions((self) => ({
    clickEv(ev, [x, y]) {
      if (!self.canStartDrawing()) return;
      if (!self.isAllowedInteraction(ev)) return;

      const c = self.control;

      if (c.type === "keypointlabels" && !c.isSelected) return;
      if (self.annotation.isReadOnly()) return;

      // 创建区域前记录当前选中的标签作为基准，
      // 因为创建后标签选中状态会被 afterCreateResult 清空
      const currentLabel = c.selectedLabels?.[0];

      const keyPoint = self.createRegion({
        ...self.control?.getSnappedPoint({
          x,
          y,
        }),
        // strokeWidth is visual only, so it's in screen dimensions in config
        width: self.obj.canvasToInternalX(Number(c.strokewidth)),
        dynamic: self.dynamic,
        negative: self.dynamic && ev.altKey,
      });

      keyPoint.setDrawing(false);
      keyPoint.notifyDrawingFinished();

      // 如果开启了自动选择下一个标签（XML 配置或标注页面设置面板），自动选择下一个标签
      const autoSelectNextLabel = c.autoselectnextlabel || self.annotation.store.settings.autoSelectNextLabel;
      if (autoSelectNextLabel) {
        c.selectNextLabel(currentLabel);
      }
    },
  }));

const KeyPoint = types.compose(_Tool.name, ToolMixin, BaseTool, DrawingTool, _Tool);

export { KeyPoint };
