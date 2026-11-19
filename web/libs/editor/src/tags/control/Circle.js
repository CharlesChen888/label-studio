import { types } from "mobx-state-tree";

import Registry from "../../core/Registry";
import ControlBase from "./Base";
import { customTypes } from "../../core/CustomTypes";
import { AnnotationMixin } from "../../mixins/AnnotationMixin";
import SeparatedControlMixin from "../../mixins/SeparatedControlMixin";
import { ToolManagerMixin } from "../../mixins/ToolManagerMixin";

/**
 * The `Circle` tag adds a circular region to an image. The stored x and y values are the circle center and radius is measured as a percentage of the image width.
 *
 * Use with the following data types: image.
 * @example
 * <View>
 *   <Circle name="circle" toName="image" />
 *   <Image name="image" value="$image" />
 * </View>
 * @name Circle
 * @regions CircleRegion
 * @param {string} name - Name of the element
 * @param {string} toName - Name of the image to label
 * @param {float} [opacity=0.6] - Opacity of circle
 * @param {string} [fillColor] - Circle fill color in hexadecimal
 * @param {string} [strokeColor=#f48a42] - Stroke color in hexadecimal
 * @param {number} [strokeWidth=1] - Width of the stroke
 * @param {boolean} [smart] - Show smart tool for interactive pre-annotations
 * @param {boolean} [smartOnly] - Only show smart tool for interactive pre-annotations
 */
const TagAttrs = types.model({
  toname: types.maybeNull(types.string),
  opacity: types.optional(customTypes.range(), "0.2"),
  fillcolor: types.optional(customTypes.color, "#f48a42"),
  strokewidth: types.optional(types.string, "1"),
  strokecolor: types.optional(customTypes.color, "#f48a42"),
  fillopacity: types.maybeNull(customTypes.range()),
  canrotate: types.optional(types.boolean, false),
});

const Model = types
  .model({
    type: "circle",
  })
  .views((self) => ({
    get hasStates() {
      const states = self.states();

      return states && states.length > 0;
    },
  }))
  .volatile(() => ({
    toolNames: ["Circle"],
  }));

const CircleModel = types.compose(
  "CircleModel",
  ControlBase,
  AnnotationMixin,
  SeparatedControlMixin,
  TagAttrs,
  Model,
  ToolManagerMixin,
);

const HtxView = () => null;

Registry.addTag("circle", CircleModel, HtxView);

export { HtxView, CircleModel };
