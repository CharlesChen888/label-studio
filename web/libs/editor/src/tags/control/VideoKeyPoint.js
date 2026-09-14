import { observer } from "mobx-react";
import { types } from "mobx-state-tree";

import Registry from "../../core/Registry";
import { guidGenerator } from "../../core/Helpers";
import ControlBase from "./Base";
import { AnnotationMixin } from "../../mixins/AnnotationMixin";
import SeparatedControlMixin from "../../mixins/SeparatedControlMixin";
import { ToolManagerMixin } from "../../mixins/ToolManagerMixin";
import { InteractivePromptMixin } from "../../mixins/InteractivePromptMixin";
import { customTypes } from "../../core/CustomTypes";

/**
 * VideoKeyPoint tag brings KeyPoint Tracking capabilities to videos.
 * It works in combination with the `<Video/>` and the `<Labels/>` tags.
 *
 * Use with the following data types: video
 * @example
 * <!--Video KeyPoint Tracking-->
 * <View>
 *   <Header>Label keypoints on the video:</Header>
 *   <Video name="video" value="$video" />
 *   <VideoKeyPoint name="kp" toName="video" />
 *
 *   <Labels name="videoLabels" toName="video">
 *     <Label value="Head" background="#944BFF"/>
 *     <Label value="Hand" background="#98C84E"/>
 *   </Labels>
 * </View>
 * @name VideoKeyPoint
 * @meta_title VideoKeyPoint Tag for Video Keypoint Annotation
 * @meta_description Customize Label Studio with the VideoKeyPoint tag for keypoint tracking on video frames.
 * @param {string} name Name of the element
 * @param {string} toName Name of the element to control (video)
 * @param {float=} [opacity=0.9] Opacity of keypoint
 * @param {string=} [fillColor=#8bad00] Keypoint fill color in hexadecimal
 * @param {number=} [strokeWidth=2] Width of the stroke
 * @param {string=} [strokeColor=#8bad00] Keypoint stroke color in hexadecimal
 * @param {small|medium|large} [pointSize=small] Size of keypoint
 */
const TagAttrs = types.model({
  toname: types.maybeNull(types.string),

  opacity: types.optional(customTypes.range(), "0.9"),
  fillcolor: types.optional(customTypes.color, "#8bad00"),

  snap: types.optional(types.string, "none"),

  strokecolor: types.optional(customTypes.color, "#8bad00"),
  strokewidth: types.optional(types.string, "2"),
  pointsize: types.optional(types.string, "small"),
  pointstyle: types.optional(types.string, "circle"),
});

const ModelAttrs = types
  .model("VideoKeyPointModel", {
    pid: types.optional(types.string, guidGenerator),
    type: "videokeypoint",
    _value: types.optional(types.string, ""),
  })
  .volatile(() => ({
    toolNames: ["VideoKeyPoint"],
  }));

const VideoKeyPointModel = types.compose(
  "VideoKeyPointModel",
  ControlBase,
  AnnotationMixin,
  SeparatedControlMixin,
  TagAttrs,
  ToolManagerMixin,
  ModelAttrs,
);

const VideoKeyPointControlModel = types.compose(
  "VideoKeyPointControlModel",
  VideoKeyPointModel,
  InteractivePromptMixin,
);

const HtxVideoKeyPoint = observer(() => {
  return null;
});

Registry.addTag("videokeypoint", VideoKeyPointControlModel, HtxVideoKeyPoint);

export { HtxVideoKeyPoint, VideoKeyPointModel };
