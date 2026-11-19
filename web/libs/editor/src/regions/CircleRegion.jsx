import { Fragment, useContext } from "react";
import { Circle } from "react-konva";
import { getRoot, types } from "mobx-state-tree";

import Constants from "../core/Constants";
import Registry from "../core/Registry";
import NormalizationMixin from "../mixins/Normalization";
import RegionsMixin from "../mixins/Regions";

import { ImageViewContext } from "../components/ImageView/ImageViewContext";
import { LabelOnEllipse } from "../components/ImageView/LabelOnRegion";
import { guidGenerator } from "../core/Helpers";
import { useRegionStyles } from "../hooks/useRegionColor";
import { AreaMixin } from "../mixins/AreaMixin";
import { KonvaRegionMixin } from "../mixins/KonvaRegion";
import { ImageModel } from "../tags/object/Image";
import { createDragBoundFunc } from "../utils/image";
import { AliveRegion } from "./AliveRegion";
import { EditableRegion } from "./EditableRegion";

const normalizeRadius = (radiusX, radiusY = radiusX) => {
  const radii = [radiusX, radiusY].map(Math.abs);
  return Math.max(0, (radii[0] + radii[1]) / 2);
};

const Model = types
  .model({
    id: types.optional(types.identifier, guidGenerator),
    pid: types.optional(types.string, guidGenerator),
    type: "circleregion",
    object: types.late(() => types.reference(ImageModel)),
    x: types.number,
    y: types.number,
    radius: types.number,
  })
  .volatile(() => ({
    startX: 0,
    startY: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: types.number,
    fill: true,
    fillColor: Constants.FILL_COLOR,
    fillOpacity: 0.2,
    strokeColor: Constants.STROKE_COLOR,
    strokeWidth: Constants.STROKE_WIDTH,
    _supportsTransform: true,
    hideable: true,
    keepRatio: true,
    editableFields: [
      { property: "x", label: "X" },
      { property: "y", label: "Y" },
      { property: "radius", label: "Radius" },
    ],
  }))
  .volatile(() => ({
    useTransformer: true,
    preferTransformer: true,
    supportsRotate: false,
    supportsScale: true,
  }))
  .views((self) => ({
    get store() {
      return getRoot(self);
    },
    get radiusYInternal() {
      return self.parent?.canvasToInternalY(self.parent.internalToCanvasX(self.radius)) ?? self.radius;
    },
    get radiusX() {
      return self.radius;
    },
    get radiusY() {
      return self.radiusYInternal;
    },
    get bboxCoords() {
      return {
        left: self.x - self.radius,
        top: self.y - self.radiusYInternal,
        right: self.x + self.radius,
        bottom: self.y + self.radiusYInternal,
      };
    },
    get canvasX() {
      return self.parent?.internalToCanvasX(self.x);
    },
    get canvasY() {
      return self.parent?.internalToCanvasY(self.y);
    },
    get canvasRadius() {
      return self.parent?.internalToCanvasX(self.radius);
    },
    get canvasRadiusX() {
      return self.canvasRadius;
    },
    get canvasRadiusY() {
      return self.canvasRadius;
    },
  }))
  .actions((self) => ({
    afterCreate() {
      self.startX = self.x;
      self.startY = self.y;
    },

    coordsInside(x, y) {
      const deltaX = self.parent?.internalToCanvasX(x - self.x) ?? x - self.x;
      const deltaY = self.parent?.internalToCanvasY(y - self.y) ?? y - self.y;

      return deltaX * deltaX + deltaY * deltaY <= self.canvasRadius * self.canvasRadius;
    },

    setPositionInternal(x, y, radiusX, radiusY = radiusX) {
      self.x = x;
      self.y = y;
      self.radius = normalizeRadius(radiusX, radiusY);
    },

    setPosition(x, y, radiusX, radiusY = radiusX) {
      self.setPositionInternal(
        self.parent.canvasToInternalX(x),
        self.parent.canvasToInternalY(y),
        self.parent.canvasToInternalX(radiusX),
        self.parent.canvasToInternalX(radiusY),
      );
    },

    setScale(x, y) {
      self.scaleX = x;
      self.scaleY = y;
    },

    setFill(color) {
      self.fill = color;
    },

    setProperty(propName, value) {
      if (!self.isPropertyEditable(propName)) {
        throw new Error(`Property ${propName} of model ${self.type} is not editable`);
      }

      self[propName] = propName === "radius" ? Math.max(0, value) : value;
    },

    updateImageSize() {},

    serialize() {
      return self.parent.createSerializedResult(self, {
        x: self.x,
        y: self.y,
        radius: self.radius,
      });
    },
  }));

const CircleRegionModel = types.compose(
  "CircleRegionModel",
  RegionsMixin,
  AreaMixin,
  NormalizationMixin,
  KonvaRegionMixin,
  EditableRegion,
  Model,
);

const HtxCircleView = ({ item, setShapeRef }) => {
  const { store } = item;
  const regionStyles = useRegionStyles(item);
  const stage = item.parent?.stageRef;
  const { suggestion } = useContext(ImageViewContext) ?? {};

  if (!item.parent || !item.inViewPort) return null;

  const updatePosition = (target) => {
    const radiusX = target.radius() * target.scaleX();
    const radiusY = target.radius() * target.scaleY();

    item.setPosition(target.x(), target.y(), radiusX, radiusY);
    target.scaleX(1);
    target.scaleY(1);
  };

  return (
    <Fragment>
      <Circle
        x={item.canvasX}
        y={item.canvasY}
        ref={(element) => setShapeRef(element)}
        radius={item.canvasRadius}
        fill={regionStyles.fillColor}
        stroke={regionStyles.strokeColor}
        strokeWidth={regionStyles.strokeWidth}
        strokeScaleEnabled={false}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
        shadowBlur={0}
        scaleX={item.scaleX}
        scaleY={item.scaleY}
        opacity={1}
        name={`${item.id} _transformable`}
        onTransform={({ target }) => {
          target.setAttr("skewX", 0);
          target.setAttr("skewY", 0);
        }}
        onTransformEnd={({ target }) => {
          updatePosition(target);
          item.notifyDrawingFinished();
        }}
        onDragStart={(event) => {
          if (item.parent.getSkipInteractions()) {
            event.currentTarget.stopDrag(event.evt);
            return;
          }
          item.annotation.history.freeze(item.id);
        }}
        onDragEnd={({ target }) => {
          updatePosition(target);
          item.annotation.history.unfreeze(item.id);
          item.notifyDrawingFinished();
        }}
        dragBoundFunc={createDragBoundFunc(item, {
          x: item.x - item.bboxCoords.left,
          y: item.y - item.bboxCoords.top,
        })}
        onMouseOver={() => {
          if (store.annotationStore.selected.isLinkingMode) item.setHighlight(true);
          item.updateCursor(true);
        }}
        onMouseOut={() => {
          if (store.annotationStore.selected.isLinkingMode) item.setHighlight(false);
          item.updateCursor();
        }}
        onClick={(event) => {
          if (item.parent.getSkipInteractions()) return;
          if (store.annotationStore.selected.isLinkingMode) {
            stage.container().style.cursor = Constants.DEFAULT_CURSOR;
          }
          item.setHighlight(false);
          item.onClickRegion(event);
        }}
        draggable={!item.isReadOnly()}
        listening={!suggestion}
      />
      <LabelOnEllipse item={item} color={regionStyles.strokeColor} strokewidth={regionStyles.strokeWidth} />
    </Fragment>
  );
};

const HtxCircle = AliveRegion(HtxCircleView);

Registry.addTag("circleregion", CircleRegionModel, HtxCircle);
Registry.addRegionType(CircleRegionModel, "image");

export { CircleRegionModel, HtxCircle };
