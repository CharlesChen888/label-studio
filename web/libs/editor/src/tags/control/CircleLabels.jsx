import { observer } from "mobx-react";
import { types } from "mobx-state-tree";

import LabelMixin from "../../mixins/LabelMixin";
import Registry from "../../core/Registry";
import SelectedModelMixin from "../../mixins/SelectedModel";
import Types from "../../core/Types";
import { HtxLabels, LabelsModel } from "./Labels/Labels";
import { CircleModel } from "./Circle";
import ControlBase from "./Base";

/**
 * The `CircleLabels` tag creates labeled circular regions. The center is stored as x and y, and radius is stored as a percentage of the image width.
 *
 * Use with the following data types: image.
 * @example
 * <View>
 *   <CircleLabels name="labels" toName="image">
 *     <Label value="Object" />
 *   </CircleLabels>
 *   <Image name="image" value="$image" />
 * </View>
 * @name CircleLabels
 * @regions CircleRegion
 * @param {string} name - Name of the element
 * @param {string} toName - Name of the image to label
 * @param {single|multiple=} [choice=single] - Configure whether one or multiple labels can be selected
 * @param {number} [maxUsages] - Maximum number of times a label can be used per task
 * @param {boolean} [showInline=true] - Show labels in the same visual line
 * @param {float=} [opacity=0.6] - Opacity of circle
 * @param {string=} [fillColor] - Circle fill color in hexadecimal
 * @param {string=} [strokeColor] - Stroke color in hexadecimal
 * @param {number=} [strokeWidth=1] - Width of stroke
 */
const ModelAttrs = types.model("CircleLabelsModel", {
  type: "circlelabels",
  children: Types.unionArray(["label", "header", "view", "hypertext"]),
});

const Composition = types.compose(
  ControlBase,
  LabelsModel,
  ModelAttrs,
  CircleModel,
  LabelMixin,
  SelectedModelMixin.props({ _child: "LabelModel" }),
);

const CircleLabelsModel = types.compose("CircleLabelsModel", Composition);
const HtxCircleLabels = observer(({ item }) => <HtxLabels item={item} />);

Registry.addTag("circlelabels", CircleLabelsModel, HtxCircleLabels);

export { HtxCircleLabels, CircleLabelsModel };
