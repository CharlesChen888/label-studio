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
 * @param {boolean} [autogroup=false]     - Enable automatic grouping of sequence keypoints into polygon regions
 * @param {number} [groupSize=3]          - Fallback group size when auto grouping is enabled and no UI override is set
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
    autogroup: types.optional(types.boolean, false),
    groupsize: types.maybeNull(types.string),
  })
  .views((self) => ({
    get hasStates() {
      const states = self.states();

      return states && states.length > 0;
    },

    get sequenceLabels() {
      return self.tiedChildren.filter((label) => label?.isEmpty !== true);
    },

    get sequenceGroupingEnabled() {
      return self.sequence && self.autogroup;
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
  .volatile(() => ({
    _isRebuildingGroups: false,
  }))
  .actions((self) => ({
    _getAutoGroupParentId(itemIndex = null) {
      const itemPart = itemIndex ?? "null";

      return `__kp-seq-group__:${self.name}:${itemPart}`;
    },

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

    _getOrderedSequenceRegions({ itemIndex = null, insertedRegion = null, insertionLabel = null, removedRegion = null } = {}) {
      const labels = self.sequenceLabels;
      const regions = self
        ._getSequenceRegions({ itemIndex, removedRegion })
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

      return regions;
    },

    _getSequenceGroupSize() {
      const fromSettings = Number(self.annotation?.store?.settings?.keypointSequenceGroupSize);
      const fromTag = Number(self.groupsize);
      const sequenceGroupSize = Number.isFinite(fromSettings) && fromSettings >= 3 ? Math.floor(fromSettings) : fromTag;

      if (!Number.isFinite(sequenceGroupSize) || sequenceGroupSize < 3) return 3;

      return Math.floor(sequenceGroupSize);
    },

    _getAutoGroupPolygonRegions(itemIndex = null) {
      const parentID = self._getAutoGroupParentId(itemIndex);

      return self.annotation.regionStore.regions.filter((region) => {
        if (region.type !== "polygonregion") return false;
        if (region.parentID !== parentID) return false;
        if (region.object?.name !== self.toname) return false;
        if ((region.item_index ?? null) !== itemIndex) return false;

        return region.results.some((result) => result.from_name === self && result.type === self.resultType);
      });
    },

    _rebuildSequenceGroupPolygons(itemIndex = null) {
      if (!self.sequenceGroupingEnabled || self._isRebuildingGroups) return;

      const objectTag = self.annotation.names.get(self.toname);

      if (!objectTag) return;

      const labels = self.sequenceLabels;
      const orderedRegions = self._getOrderedSequenceRegions({ itemIndex });
      const groupSize = self._getSequenceGroupSize();
      const parentID = self._getAutoGroupParentId(itemIndex);

      self._isRebuildingGroups = true;

      try {
        self._getAutoGroupPolygonRegions(itemIndex).forEach((region) => region.deleteRegion());

        for (let start = 0; start < orderedRegions.length; start += groupSize) {
          const groupRegions = orderedRegions.slice(start, start + groupSize);

          if (groupRegions.length < 3) continue;

          const points = groupRegions.map((region) => [region.x, region.y]);

          // Compute convex hull to ensure the polygon is convex and edges don't cross
          const hullPoints = computeConvexHull(points);

          if (hullPoints.length < 3) continue;

          const groupStartLabel = labels[start]?.value ?? labels[0]?.value;

          if (!groupStartLabel) continue;

          self.annotation.createResult(
            {
              points: hullPoints,
              closed: true,
              parentID,
            },
            {
              [self.valueType]: [groupStartLabel],
            },
            self,
            objectTag,
            true,
          );
        }
      } finally {
        self._isRebuildingGroups = false;
      }
    },

    isLabelAllowed(label, itemIndex = null) {
      if (!self.sequence) return true;

      const labels = self.sequenceLabels;
      if (!labels.length) return true;

      const labelIndex = labels.findIndex((l) => l.value === label.value);
      if (labelIndex === -1) return true;

      const numFilled = self._getSequenceRegions({ itemIndex }).length;

      return labelIndex <= numFilled;
    },

    rebalanceSequenceLabels({ insertedRegion = null, insertionLabel = null, removedRegion = null, itemIndex = null } = {}) {
      if (!self.sequence) return;

      const labels = self.sequenceLabels;

      if (!labels.length) return;

      const targetItemIndex = itemIndex ?? insertedRegion?.item_index ?? removedRegion?.item_index ?? null;
      const regions = self._getOrderedSequenceRegions({
        itemIndex: targetItemIndex,
        insertedRegion,
        insertionLabel,
        removedRegion,
      });

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

      self._rebuildSequenceGroupPolygons(targetItemIndex);
    },

    onRegionCreated(region, currentLabel) {
      self.rebalanceSequenceLabels({ insertedRegion: region, insertionLabel: currentLabel });
    },

    onRegionDelete(region) {
      if (self._isRebuildingGroups) return;

      self.rebalanceSequenceLabels({ removedRegion: region });
    },

    onRegionChanged(region) {
      if (self._isRebuildingGroups) return;
      if (region.type !== "keypointregion") return;

      // When a keypoint moves, rebuild the auto-grouped polygons so they follow the new positions
      self._rebuildSequenceGroupPolygons(region.item_index ?? null);
    },
  }));

const HtxKeyPointLabels = observer(({ item }) => {
  return <HtxLabels item={item} />;
});

Registry.addTag("keypointlabels", KeyPointLabelsModel, HtxKeyPointLabels);

export { HtxKeyPointLabels, KeyPointLabelsModel };

/**
 * Compute the convex hull of a set of 2D points using Graham Scan algorithm.
 * Returns points in counter-clockwise order forming a convex polygon.
 * @param {Array<[number, number]>} points - Array of [x, y] coordinate pairs
 * @returns {Array<[number, number]>} - Convex hull points in CCW order
 */
function computeConvexHull(points) {
  if (points.length < 3) return points;

  // Find the point with the lowest y-coordinate (and leftmost if tied)
  const startIdx = points.reduce((minIdx, p, i, arr) => {
    if (p[1] < arr[minIdx][1] || (p[1] === arr[minIdx][1] && p[0] < arr[minIdx][0])) {
      return i;
    }
    return minIdx;
  }, 0);

  const start = points[startIdx];

  // Sort points by polar angle with start point
  const sorted = points
    .map((p, i) => ({ point: p, index: i }))
    .filter(({ index }) => index !== startIdx)
    .sort((a, b) => {
      const angleA = Math.atan2(a.point[1] - start[1], a.point[0] - start[0]);
      const angleB = Math.atan2(b.point[1] - start[1], b.point[0] - start[0]);

      if (angleA !== angleB) return angleA - angleB;

      // If angles are equal, sort by distance (farther first)
      const distA = (a.point[0] - start[0]) ** 2 + (a.point[1] - start[1]) ** 2;
      const distB = (b.point[0] - start[0]) ** 2 + (b.point[1] - start[1]) ** 2;
      return distB - distA;
    })
    .map(({ point }) => point);

  // Cross product of vectors OA and OB
  const cross = (O, A, B) => {
    return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  };

  // Graham Scan
  const hull = [start, sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], sorted[i]) <= 0) {
      hull.pop();
    }
    hull.push(sorted[i]);
  }

  return hull;
}
