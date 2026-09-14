import type { KonvaEventObject } from "konva/lib/Node";
import { observer } from "mobx-react";
import { type FC, useMemo } from "react";
import { Circle, Group } from "react-konva";
import { useRegionStyles } from "../../../hooks/useRegionColor";
import type { WorkingArea } from "./types";
import { LabelOnBbox } from "../../../components/ImageView/LabelOnRegion";
import Constants from "../../../core/Constants";

interface KeyPointProps {
  id: string;
  reg: any;
  frame: number;
  selected: boolean;
  draggable: boolean;
  listening: boolean;
  box: { x: number; y: number; width?: number };
  workingArea: WorkingArea;
  onClick?: (e: KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: KonvaEventObject<DragEvent>) => void;
  allowOutsideBounds?: boolean;
}

const POINT_SIZES: Record<string, number> = {
  small: 4,
  medium: 7,
  large: 10,
};

const VideoKeyPointPure: FC<KeyPointProps> = ({
  id,
  reg,
  box,
  frame,
  workingArea,
  selected,
  draggable,
  listening,
  onClick,
  onDragMove,
  ...rest
}) => {
  const style = useRegionStyles(reg, { includeFill: true });
  const { realWidth: waWidth, realHeight: waHeight, scale: waScale } = workingArea;

  const pointSize = useMemo(() => {
    const sizeName = reg.pointsize || reg.control?.pointsize || "small";
    const baseRadius = POINT_SIZES[sizeName] ?? 5;
    const dataRadius = box.width ? (box.width * waWidth) / 100 : 0;

    return dataRadius || baseRadius;
  }, [box.width, reg.pointsize, reg.control?.pointsize, waWidth]);

  const canvasPos = useMemo(
    () => ({
      x: (box.x * waWidth) / 100,
      y: (box.y * waHeight) / 100,
    }),
    [box.x, box.y, waWidth, waHeight],
  );

  const onDrag = (e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const newX = (node.x() / waWidth) * 100;
    const newY = (node.y() / waHeight) * 100;

    reg.updateShape({ x: newX, y: newY }, frame);
    if (onDragMove) onDragMove(e);
  };

  const dragBoundFunc = (position: { x: number; y: number }) => ({
    x: Math.max(0, Math.min(waWidth, position.x)),
    y: Math.max(0, Math.min(waHeight, position.y)),
  });

  const isTexting = !!reg.texting;
  const labelText = reg.getLabelText?.(",") ?? "";
  const showLabels = reg.store?.settings?.showLabels;

  return (
    <Group>
      <LabelOnBbox
        x={canvasPos.x + pointSize + 2}
        y={canvasPos.y - pointSize - 2}
        isTexting={isTexting}
        text={labelText}
        score={reg.score}
        showLabels={showLabels}
        zoomScale={waScale}
        color={style.strokeColor}
        onClickLabel={reg.onClickRegion}
      />
      <Circle
        id={id}
        x={canvasPos.x}
        y={canvasPos.y}
        radius={pointSize}
        fill={style.fillColor ?? style.strokeColor ?? "#8bad00"}
        stroke={selected ? "#0055ff" : (style.strokeColor ?? "#8bad00")}
        strokeWidth={selected ? 2 : (style.strokeWidth ? Number(style.strokeWidth) : 1.5)}
        strokeScaleEnabled={false}
        draggable={draggable}
        listening={listening}
        dragBoundFunc={dragBoundFunc}
        opacity={reg.hidden ? 0 : (style.opacity ? Number(style.opacity) : 1)}
        onClick={onClick}
        onDragStart={() => {
          reg.annotation?.history?.freeze(reg.id);
        }}
        onDragMove={onDrag}
        onDragEnd={() => {
          reg.annotation?.history?.unfreeze(reg.id);
          reg.notifyDrawingFinished?.();
        }}
        onMouseEnter={(e) => {
          reg.setHighlight?.(true);
          const stage = e?.target?.getStage?.();
          if (stage) stage.container().style.cursor = Constants.POINTER_CURSOR;
        }}
        onMouseLeave={(e) => {
          reg.setHighlight?.(false);
          const stage = e?.target?.getStage?.();
          if (stage) stage.container().style.cursor = Constants.DEFAULT_CURSOR;
        }}
        {...rest}
      />
    </Group>
  );
};

export const VideoKeyPointShape = observer(VideoKeyPointPure);
