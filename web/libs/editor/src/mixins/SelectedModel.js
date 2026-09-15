import { types } from "mobx-state-tree";

import Tree from "../core/Tree";
import { isDefined } from "../utils/utilities";

const SelectedModelMixin = types
  .model()
  .volatile(() => {
    return {
      isSeparated: false,
    };
  })
  .views((self) => ({
    get tiedChildren() {
      return Tree.filterChildrenOfType(self, self._child);
    },

    get selectedLabels() {
      return self.tiedChildren.filter((c) => c.selected === true);
    },

    getSelectedColor() {
      // return first selected label color
      const sel = self.tiedChildren.find((c) => c.selected === true);

      return sel && sel.background;
    },

    get selectedColor() {
      // return first selected label color
      const sel = self.tiedChildren.find((c) => c.selected === true);

      return sel && sel.background;
    },

    get isSelected() {
      return self.selectedLabels.length > 0;
    },

    // right now this is duplicate code from the above and it's done for clarity
    get holdsState() {
      return self.selectedLabels.length > 0;
    },

    selectedValues() {
      return self.selectedLabels.map((c) => (c.alias ? c.alias : c.value)).filter((val) => isDefined(val));
    },

    getResultValue() {
      return {
        [self.valueType]: self.selectedValues(),
      };
    },

    // return labels that are selected and have an alias only
    get selectedAliases() {
      return self.selectedLabels.filter((c) => c.alias).map((c) => c.alias);
    },

    getSelectedString(joinstr = " ") {
      return self.selectedValues().join(joinstr);
    },

    findLabel(value) {
      return self.tiedChildren.find(
        (c) =>
          (c.alias === value && isDefined(value)) || c.value === value || (!isDefined(c.value) && !isDefined(value)),
      );
    },

    get emptyLabel() {
      return self.allowempty ? self.findLabel(null) : null;
    },
  }))
  .actions((self) => ({
    /**
     * Get current color from Label settings
     */
    unselectAll() {
      self.tiedChildren.forEach((c) => c.setSelected(false));
    },

    checkMaxUsages() {
      return self.tiedChildren.filter((c) => !c.canBeUsed());
    },

    selectFirstVisible() {
      const f = self.tiedChildren.find((c) => c.visible);

      f && f.toggleSelected();

      return f;
    },

    selectNextLabel(currentLabel) {
      const children = self.tiedChildren;
      const visibleChildren = children.filter((c) => c.visible);

      if (visibleChildren.length === 0) return null;

      // 优先以传入的基准标签定位（创建区域后选中状态可能已被清空，
      // 所以需要外部在清空前先记录当前选中的标签）
      let baseIndex = -1;

      if (currentLabel) {
        baseIndex = visibleChildren.findIndex((c) => c === currentLabel || c.id === currentLabel.id);
      }

      if (baseIndex === -1) {
        // 没有可用的基准标签时，回退到当前选中的标签
        const selected = visibleChildren.find((c) => c.selected === true);
        baseIndex = selected ? visibleChildren.indexOf(selected) : -1;
      }

      if (baseIndex === -1) {
        // 找不到基准标签，选择第一个可见标签
        const firstLabel = visibleChildren[0];
        firstLabel.setSelected(true);

        return firstLabel;
      }

      // 选择基准标签的下一个（最后一个之后循环回第一个）
      const nextIndex = (baseIndex + 1) % visibleChildren.length;
      const nextLabel = visibleChildren[nextIndex];
      nextLabel.setSelected(true);

      return nextLabel;
    },

    /**
     * Change states of tags according to values from result
     * @param {string|string[]} value
     */
    updateFromResult(value) {
      self.unselectAll();
      const values = Array.isArray(value) ? (value.length ? value : [null]) : [value];

      if (values.length) {
        values.map((v) => self.findLabel(v)).forEach((label) => label?.setSelected(true));
      } else if (self.allowempty) {
        self.findLabel(null)?.setSelected(true);
      }
    },
  }));

export default SelectedModelMixin;
