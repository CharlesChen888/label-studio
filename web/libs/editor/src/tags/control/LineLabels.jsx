import { observer } from "mobx-react";
import { types } from "mobx-state-tree";

import LabelMixin from "../../mixins/LabelMixin";
import Registry from "../../core/Registry";
import SelectedModelMixin from "../../mixins/SelectedModel";
import Types from "../../core/Types";
import { HtxLabels, LabelsModel } from "./Labels/Labels";
import { LineModel } from "./Line";
import ControlBase from "./Base";

/**
 * The `LineLabels` tag creates labeled two-point line segments with short perpendicular endpoint caps.
 *
 * Use with the following data types: image.
 * @example
 * <View>
 *   <LineLabels name="labels" toName="image">
 *     <Label value="Boundary" />
 *   </LineLabels>
 *   <Image name="image" value="$image" />
 * </View>
 * @name LineLabels
 * @regions LineRegion
 * @param {string} name - Name of the element
 * @param {string} toName - Name of the image to label
 * @param {single|multiple=} [choice=single] - Configure whether one or multiple labels can be selected
 * @param {number} [maxUsages] - Maximum number of times a label can be used per task
 * @param {boolean} [showInline=true] - Show labels in the same visual line
 * @param {float=} [opacity=0.6] - Opacity of line
 * @param {string=} [strokeColor] - Stroke color in hexadecimal
 * @param {number=} [strokeWidth=2] - Width of the line
 * @param {pixel|none} [snap=none] - Snap endpoints to image pixels
 */
const ModelAttrs = types.model("LineLabelsModel", {
  type: "linelabels",
  children: Types.unionArray(["label", "header", "view", "hypertext"]),
});

const LineLabelsModel = types.compose(
  "LineLabelsModel",
  ControlBase,
  LabelsModel,
  ModelAttrs,
  LineModel,
  LabelMixin,
  SelectedModelMixin.props({ _child: "LabelModel" }),
);

const HtxLineLabels = observer(({ item }) => <HtxLabels item={item} />);

Registry.addTag("linelabels", LineLabelsModel, HtxLineLabels);

export { HtxLineLabels, LineLabelsModel };
