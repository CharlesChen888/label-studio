import { Fragment, useContext } from "react";
import { Circle, Line } from "react-konva";
import { getRoot, types } from "mobx-state-tree";

import Constants from "../core/Constants";
import Registry from "../core/Registry";
import NormalizationMixin from "../mixins/Normalization";
import RegionsMixin from "../mixins/Regions";
import { ImageViewContext } from "../components/ImageView/ImageViewContext";
import { LabelOnPolygon } from "../components/ImageView/LabelOnRegion";
import { guidGenerator } from "../core/Helpers";
import { useRegionStyles } from "../hooks/useRegionColor";
import { AreaMixin } from "../mixins/AreaMixin";
import { KonvaRegionMixin } from "../mixins/KonvaRegion";
import { ImageModel } from "../tags/object/Image";
import { AliveRegion } from "./AliveRegion";
import { EditableRegion } from "./EditableRegion";

const ENDPOINT_CAP_LENGTH = 12;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const perpendicularCap = (x1, y1, x2, y2, halfLength) => {
  const length = Math.hypot(x2 - x1, y2 - y1);

  if (length === 0) return [];

  const normalX = (-(y2 - y1) / length) * halfLength;
  const normalY = ((x2 - x1) / length) * halfLength;

  return [
    [x1 - normalX, y1 - normalY, x1 + normalX, y1 + normalY],
    [x2 - normalX, y2 - normalY, x2 + normalX, y2 + normalY],
  ];
};

const Model = types
  .model({
    id: types.optional(types.identifier, guidGenerator),
    pid: types.optional(types.string, guidGenerator),
    type: "lineregion",
    object: types.late(() => types.reference(ImageModel)),
    x1: types.number,
    y1: types.number,
    x2: types.number,
    y2: types.number,
  })
  .volatile(() => ({
    startX: 0,
    startY: 0,
    scaleX: 1,
    scaleY: 1,
    fill: true,
    fillColor: Constants.FILL_COLOR,
    strokeColor: Constants.STROKE_COLOR,
    strokeWidth: Constants.STROKE_WIDTH,
    _supportsTransform: false,
    hideable: true,
    editableFields: [
      { property: "x1", label: "X1" },
      { property: "y1", label: "Y1" },
      { property: "x2", label: "X2" },
      { property: "y2", label: "Y2" },
    ],
  }))
  .views((self) => ({
    get store() {
      return getRoot(self);
    },
    get bboxCoords() {
      return {
        left: Math.min(self.x1, self.x2),
        top: Math.min(self.y1, self.y2),
        right: Math.max(self.x1, self.x2),
        bottom: Math.max(self.y1, self.y2),
      };
    },
    get canvasPoints() {
      if (!self.parent) return [];

      return [
        self.parent.internalToCanvasX(self.x1),
        self.parent.internalToCanvasY(self.y1),
        self.parent.internalToCanvasX(self.x2),
        self.parent.internalToCanvasY(self.y2),
      ];
    },
    get endpointCaps() {
      const [x1, y1, x2, y2] = self.canvasPoints;

      return perpendicularCap(x1, y1, x2, y2, ENDPOINT_CAP_LENGTH / 2 / (self.parent?.zoomScale || 1));
    },
  }))
  .actions((self) => ({
    afterCreate() {
      self.startX = self.x1;
      self.startY = self.y1;
    },

    setPositionInternal(x1, y1, x2, y2) {
      self.x1 = clamp(x1, 0, 100);
      self.y1 = clamp(y1, 0, 100);
      self.x2 = clamp(x2, 0, 100);
      self.y2 = clamp(y2, 0, 100);
    },

    setPosition(x1, y1, x2, y2) {
      self.setPositionInternal(
        self.parent.canvasToInternalX(x1),
        self.parent.canvasToInternalY(y1),
        self.parent.canvasToInternalX(x2),
        self.parent.canvasToInternalY(y2),
      );
    },

    setEndpoint(index, canvasX, canvasY) {
      const point = self.control?.getSnappedPoint?.({
        x: self.parent.canvasToInternalX(canvasX),
        y: self.parent.canvasToInternalY(canvasY),
      }) ?? { x: self.parent.canvasToInternalX(canvasX), y: self.parent.canvasToInternalY(canvasY) };

      if (index === 0) self.setPositionInternal(point.x, point.y, self.x2, self.y2);
      else self.setPositionInternal(self.x1, self.y1, point.x, point.y);
    },

    moveByCanvas(deltaX, deltaY) {
      const internalDeltaX = self.parent.canvasToInternalX(deltaX);
      const internalDeltaY = self.parent.canvasToInternalY(deltaY);
      const boundedDeltaX = clamp(internalDeltaX, -Math.min(self.x1, self.x2), 100 - Math.max(self.x1, self.x2));
      const boundedDeltaY = clamp(internalDeltaY, -Math.min(self.y1, self.y2), 100 - Math.max(self.y1, self.y2));

      self.setPositionInternal(
        self.x1 + boundedDeltaX,
        self.y1 + boundedDeltaY,
        self.x2 + boundedDeltaX,
        self.y2 + boundedDeltaY,
      );
    },

    setProperty(propName, value) {
      if (!self.isPropertyEditable(propName)) {
        throw new Error(`Property ${propName} of model ${self.type} is not editable`);
      }

      self[propName] = clamp(value, 0, 100);
    },

    updateImageSize() {},

    serialize() {
      return self.parent.createSerializedResult(self, {
        x1: self.x1,
        y1: self.y1,
        x2: self.x2,
        y2: self.y2,
      });
    },
  }));

const LineRegionModel = types.compose(
  "LineRegionModel",
  RegionsMixin,
  AreaMixin,
  NormalizationMixin,
  KonvaRegionMixin,
  EditableRegion,
  Model,
);

const HtxLineView = ({ item, setShapeRef }) => {
  const { store } = item;
  const regionStyles = useRegionStyles(item);
  const stage = item.parent?.stageRef;
  const { suggestion } = useContext(ImageViewContext) ?? {};

  if (!item.parent || !item.inViewPort) return null;

  const [x1, y1, x2, y2] = item.canvasPoints;
  const endpointCaps = item.endpointCaps;
  const selectRegion = (event) => {
    if (item.parent.getSkipInteractions() || item.isReadOnly()) return;

    event.cancelBubble = true;
    if (store.annotationStore.selected.isLinkingMode) {
      stage.container().style.cursor = Constants.DEFAULT_CURSOR;
    }
    item.setHighlight(false);
    item.onClickRegion(event);
  };
  const finishDrag = (target) => {
    item.moveByCanvas(target.x(), target.y());
    target.x(0);
    target.y(0);
    item.notifyDrawingFinished();
  };

  return (
    <Fragment>
      <Line
        ref={setShapeRef}
        points={[x1, y1, x2, y2]}
        stroke={regionStyles.strokeColor}
        strokeWidth={regionStyles.strokeWidth}
        strokeScaleEnabled={false}
        lineCap="round"
        hitStrokeWidth={16}
        draggable={!item.isReadOnly() && !item.isDrawing}
        listening={!suggestion}
        onClick={selectRegion}
        onMouseEnter={() => item.updateCursor(true)}
        onMouseLeave={() => item.updateCursor()}
        onDragStart={() => item.annotation.history.freeze(item.id)}
        onDragEnd={(event) => {
          finishDrag(event.target);
          item.annotation.history.unfreeze(item.id);
        }}
      />
      {endpointCaps.map((points, index) => (
        <Line
          key={`line-cap-${index}`}
          points={points}
          stroke={regionStyles.strokeColor}
          strokeWidth={regionStyles.strokeWidth * (item.selected ? 1.5 : 1)}
          strokeScaleEnabled={false}
          lineCap="round"
          listening={false}
        />
      ))}
      {item.selected &&
        [
          [x1, y1],
          [x2, y2],
        ].map(([x, y], index) => (
          <Circle
            key={`line-endpoint-${index}`}
            x={x}
            y={y}
            radius={7 / (item.parent.zoomScale || 1)}
            fill="transparent"
            draggable={!item.isReadOnly() && !suggestion}
            onClick={(event) => event.cancelBubble()}
            onDragStart={(event) => {
              event.cancelBubble = true;
              item.annotation.history.freeze(`${item.id}-endpoint-${index}`);
            }}
            onDragMove={(event) => {
              event.cancelBubble = true;
              item.setEndpoint(index, event.target.x(), event.target.y());
            }}
            onDragEnd={(event) => {
              event.cancelBubble = true;
              item.setEndpoint(index, event.target.x(), event.target.y());
              item.annotation.history.unfreeze(`${item.id}-endpoint-${index}`);
              item.notifyDrawingFinished();
            }}
          />
        ))}
    </Fragment>
  );
};

const HtxLine = AliveRegion(HtxLineView);

Registry.addTag("lineregion", LineRegionModel, HtxLine);
Registry.addRegionType(
  LineRegionModel,
  "image",
  (value) => value.type === "lineregion" || value.x1 !== undefined || value.value?.x1 !== undefined,
);

export { LineRegionModel, HtxLine };
