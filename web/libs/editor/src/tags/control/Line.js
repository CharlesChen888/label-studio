import { types } from "mobx-state-tree";

import Registry from "../../core/Registry";
import ControlBase from "./Base";
import { customTypes } from "../../core/CustomTypes";
import Types from "../../core/Types";
import { AnnotationMixin } from "../../mixins/AnnotationMixin";
import SeparatedControlMixin from "../../mixins/SeparatedControlMixin";
import { ToolManagerMixin } from "../../mixins/ToolManagerMixin";

/**
 * The `Line` tag adds a two-point line segment to an image. Both endpoints are shown with short perpendicular caps.
 *
 * Use with the following data types: image.
 * @example
 * <View>
 *   <Line name="line" toName="image" />
 *   <Image name="image" value="$image" />
 * </View>
 * @name Line
 * @regions LineRegion
 * @param {string} name - Name of the element
 * @param {string} toName - Name of the image to label
 * @param {float} [opacity=0.6] - Opacity of line
 * @param {string} [strokeColor=#f48a42] - Stroke color in hexadecimal
 * @param {number} [strokeWidth=2] - Width of the line
 * @param {pixel|none} [snap=none] - Snap endpoints to image pixels
 * @param {boolean} [smart] - Show smart tool for interactive pre-annotations
 * @param {boolean} [smartOnly] - Only show smart tool for interactive pre-annotations
 */
const TagAttrs = types.model({
  toname: types.maybeNull(types.string),
  opacity: types.optional(customTypes.range(), "0.2"),
  strokewidth: types.optional(types.string, "2"),
  strokecolor: types.optional(customTypes.color, "#f48a42"),
  snap: types.optional(types.string, "none"),
});

const Validation = types.model({
  controlledTags: Types.unionTag(["Image"]),
});

const Model = types
  .model({
    type: "line",
    _value: types.optional(types.string, ""),
  })
  .volatile(() => ({
    toolNames: ["Line"],
  }));

const LineModel = types.compose(
  "LineModel",
  ControlBase,
  AnnotationMixin,
  SeparatedControlMixin,
  TagAttrs,
  Validation,
  ToolManagerMixin,
  Model,
);

const HtxView = () => null;

Registry.addTag("line", LineModel, HtxView);

export { HtxView, LineModel };
