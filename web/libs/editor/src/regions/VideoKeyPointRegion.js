import { types } from "mobx-state-tree";

import NormalizationMixin from "../mixins/Normalization";
import RegionsMixin from "../mixins/Regions";
import Registry from "../core/Registry";
import { AreaMixin } from "../mixins/AreaMixin";
import { onlyProps, VideoRegion } from "./VideoRegion";
import { interpolateProp } from "../utils/props";

export const isVideoKeyPointRegionValue = (value = {}) => {
  if (
    value.type === "videokeypointregion" ||
    value.type === "videokeypoint" ||
    value.type === "videokeypointlabels"
  ) {
    return true;
  }

  const sequence = value.sequence ?? value.value?.sequence;

  if (!Array.isArray(sequence) || sequence.length === 0) return false;

  return sequence.some(
    (keyframe) =>
      keyframe &&
      keyframe.x !== undefined &&
      keyframe.y !== undefined &&
      keyframe.height === undefined &&
      keyframe.vertices === undefined,
  );
};

const Model = types
  .model("VideoKeyPointRegionModel", {
    type: "videokeypointregion",
  })
  .volatile(() => ({
    props: ["x", "y", "width"],
  }))
  .views((self) => ({
    getShape(frame) {
      let prev;
      let next;

      for (const item of self.sequence) {
        if (item.frame === frame) {
          return onlyProps(self.props, item);
        }

        if (item.frame > frame) {
          next = item;
          break;
        }
        prev = item;
      }

      if (!prev) return null;
      if (!next) return onlyProps(self.props, prev);

      return Object.fromEntries(self.props.map((prop) => [prop, interpolateProp(prev, next, frame, prop)]));
    },

    getVisibility() {
      return true;
    },
  }))
  .actions((self) => ({
    updateShape(data, frame) {
      const newItem = {
        ...data,
        frame,
        enabled: true,
      };

      const kp = self.closestKeypoint(frame);
      const index = self.sequence.findIndex((item) => item.frame >= frame);

      if (index < 0) {
        self.sequence = [...self.sequence, newItem];
      } else {
        const keypoint = {
          ...(self.sequence[index] ?? {}),
          ...data,
          enabled: kp?.enabled ?? true,
          frame,
        };

        self.sequence = [
          ...self.sequence.slice(0, index),
          keypoint,
          ...self.sequence.slice(index + (self.sequence[index].frame === frame)),
        ];
      }
    },
  }));

const VideoKeyPointRegionModel = types.compose(
  "VideoKeyPointRegionModel",
  RegionsMixin,
  VideoRegion,
  AreaMixin,
  NormalizationMixin,
  Model,
);

Registry.addRegionType(VideoKeyPointRegionModel, "video", isVideoKeyPointRegionValue);

export { VideoKeyPointRegionModel };
