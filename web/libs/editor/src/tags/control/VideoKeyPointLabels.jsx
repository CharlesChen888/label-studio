import { observer } from "mobx-react";
import { types } from "mobx-state-tree";

import LabelMixin from "../../mixins/LabelMixin";
import Registry from "../../core/Registry";
import SelectedModelMixin from "../../mixins/SelectedModel";
import Types from "../../core/Types";
import { HtxLabels, LabelsModel } from "./Labels/Labels";
import { VideoKeyPointModel } from "./VideoKeyPoint";
import ControlBase from "./Base";
import { InteractivePromptMixin } from "../../mixins/InteractivePromptMixin";

/**
 * The `VideoKeyPointLabels` tag creates labeled keypoints on video frames.
 * Combines VideoKeyPoint and Labels into one tag for convenient keypoint annotation.
 *
 * Use with the following data types: video.
 *
 * @example
 * <View>
 *   <Video name="video" value="$video" />
 *   <VideoKeyPointLabels name="kp_labels" toName="video">
 *     <Label value="Head" background="#ff0000" />
 *     <Label value="Hand" background="#00ff00" />
 *   </VideoKeyPointLabels>
 * </View>
 * @name VideoKeyPointLabels
 * @regions VideoKeyPointRegion
 * @meta_title VideoKeyPointLabels Tag for Video Keypoint Annotation
 * @meta_description Customize Label Studio with the VideoKeyPointLabels tag for labeled keypoint annotation on video.
 * @param {string} name Name of tag
 * @param {string} toName Name of video to label
 * @param {single|multiple=} [choice=single] Configure whether you can select one or multiple labels
 * @param {number} [maxUsages] Maximum number of times a label can be used per task
 * @param {boolean} [showInline=true] Show labels in the same visual line
 * @param {float=} [opacity=0.9] Opacity of keypoint
 * @param {string=} [fillColor] Keypoint fill color in hexadecimal
 * @param {string=} [strokeColor] Keypoint stroke color in hexadecimal
 * @param {number=} [strokeWidth=2] Width of stroke
 * @param {small|medium|large} [pointSize=small] Size of keypoint
 */
const ModelAttrs = types.model("VideoKeyPointLabelsModel", {
  type: "videokeypointlabels",
  children: Types.unionArray(["label", "header", "view", "hypertext"]),
});

const VideoKeyPointLabelsModel = types.compose(
  "VideoKeyPointLabelsModel",
  ControlBase,
  LabelsModel,
  ModelAttrs,
  VideoKeyPointModel,
  LabelMixin,
  SelectedModelMixin.props({ _child: "LabelModel" }),
  InteractivePromptMixin,
);

const HtxVideoKeyPointLabels = observer(({ item }) => {
  return <HtxLabels item={item} />;
});

Registry.addTag("videokeypointlabels", VideoKeyPointLabelsModel, HtxVideoKeyPointLabels);

export { HtxVideoKeyPointLabels, VideoKeyPointLabelsModel };
