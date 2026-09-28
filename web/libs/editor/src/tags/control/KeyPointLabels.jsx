import { observer } from "mobx-react";
import { types } from "mobx-state-tree";

import LabelMixin from "../../mixins/LabelMixin";
import Registry from "../../core/Registry";
import SelectedModelMixin from "../../mixins/SelectedModel";
import Types from "../../core/Types";
import { HtxLabels, LabelsModel } from "./Labels/Labels";
import { KeyPointModel } from "./KeyPoint";
import ControlBase from "./Base";

/**
 * The `KeyPointLabels` tag creates labeled keypoints. Use to apply labels to identified key points, such as identifying facial features for a facial recognition labeling project.
 *
 * Use with the following data types: image.
 * @example
 * <!--Basic keypoint image labeling configuration for multiple regions-->
 * <View>
 *   <KeyPointLabels name="kp-1" toName="img-1">
 *     <Label value="Face" />
 *     <Label value="Nose" />
 *   </KeyPointLabels>
 *   <Image name="img-1" value="$img" />
 * </View>
 * @name KeyPointLabels
 * @regions KeyPointRegion
 * @meta_title Keypoint Label Tag for Labeling Keypoints
 * @meta_description Customize Label Studio with the KeyPointLabels tag to label keypoints for computer vision machine learning and data science projects.
 * @param {string} name                  - Name of the element
 * @param {string} toName                - Name of the image to label
 * @param {single|multiple=} [choice=single] - Configure whether you can select one or multiple labels
 * @param {number} [maxUsages]           - Maximum number of times a label can be used per task
 * @param {boolean} [showInline=true]    - Show labels in the same visual line
 * @param {float=} [opacity=0.9]         - Opacity of the keypoint
 * @param {number=} [strokeWidth=1]      - Width of the stroke
 * @param {pixel|none} [snap=none]       - Snap keypoint to image pixels
 * @param {boolean} [sequence=false]      - Enable keypoint sequence mode with ordered auto-labeling and relabel on insert/delete
 *
 */

const Validation = types.model({
  controlledTags: Types.unionTag(["Image"]),
});

const ModelAttrs = types
  .model("KeyPointLabelsModel", {
    type: "keypointlabels",
    children: Types.unionArray(["label", "header", "view", "hypertext"]),
    autoselectnextlabel: types.optional(types.boolean, false),
    sequence: types.optional(types.boolean, false),
  })
  .views((self) => ({
    get hasStates() {
      const states = self.states();

      return states && states.length > 0;
    },

    get sequenceLabels() {
      return self.tiedChildren.filter((label) => label?.isEmpty !== true);
    },
  }));

const Composition = types.compose(
  ControlBase,
  LabelsModel,
  ModelAttrs,
  KeyPointModel,
  Validation,
  LabelMixin,
  SelectedModelMixin.props({ _child: "LabelModel" }),
);

const KeyPointLabelsModel = types
  .compose("KeyPointLabelsModel", Composition)
  .actions((self) => ({
    _getSequenceResult(region) {
      if (!region?.results) return null;

      return region.results.find((result) => result.from_name === self && result.type === self.resultType) ?? null;
    },

    _getRegionLabelOrderIndex(region, labels) {
      const result = self._getSequenceResult(region);
      const labelValue = result?.mainValue?.[0];
      const index = labels.findIndex((label) => label.value === labelValue);

      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    },

    _getSequenceRegions({ itemIndex = null, removedRegion = null } = {}) {
      return self.annotation.regionStore.regions.filter((region) => {
        if (region === removedRegion) return false;
        if (region.type !== "keypointregion") return false;
        if (region.object?.name !== self.toname) return false;
        if ((region.item_index ?? null) !== itemIndex) return false;

        return !!self._getSequenceResult(region);
      });
    },

    rebalanceSequenceLabels({ insertedRegion = null, insertionLabel = null, removedRegion = null, itemIndex = null } = {}) {
      if (!self.sequence) return;

      const labels = self.sequenceLabels;

      if (!labels.length) return;

      const targetItemIndex = itemIndex ?? insertedRegion?.item_index ?? removedRegion?.item_index ?? null;
      const regions = self
        ._getSequenceRegions({ itemIndex: targetItemIndex, removedRegion })
        .sort((a, b) => {
          const aIndex = self._getRegionLabelOrderIndex(a, labels);
          const bIndex = self._getRegionLabelOrderIndex(b, labels);

          if (aIndex !== bIndex) return aIndex - bIndex;

          return (a.ouid ?? 0) - (b.ouid ?? 0);
        });

      if (insertedRegion) {
        const existingIndex = regions.indexOf(insertedRegion);

        if (existingIndex >= 0) regions.splice(existingIndex, 1);

        const insertionValue = insertionLabel?.value ?? insertionLabel;
        const preferredIndex = labels.findIndex((label) => label.value === insertionValue);
        const insertionIndex = preferredIndex >= 0 ? Math.min(preferredIndex, regions.length) : regions.length;

        regions.splice(insertionIndex, 0, insertedRegion);
      }

      if (regions.length > labels.length) {
        const excessRegions = regions.slice(labels.length);
        excessRegions.forEach((region) => region.deleteRegion());
        regions.splice(labels.length);
      }

      regions.forEach((region, index) => {
        const sequenceLabel = labels[index];
        const result = self._getSequenceResult(region);

        if (!result || !sequenceLabel) return;
        if (result.mainValue?.[0] === sequenceLabel.value) return;

        result.setValue([sequenceLabel.value]);
        region.updateAppearenceFromState?.();
      });
    },

    onRegionCreated(region, currentLabel) {
      self.rebalanceSequenceLabels({ insertedRegion: region, insertionLabel: currentLabel });
    },

    onRegionDelete(region) {
      self.rebalanceSequenceLabels({ removedRegion: region });
    },
  }));

const HtxKeyPointLabels = observer(({ item }) => {
  return <HtxLabels item={item} />;
});

Registry.addTag("keypointlabels", KeyPointLabelsModel, HtxKeyPointLabels);

export { HtxKeyPointLabels, KeyPointLabelsModel };
