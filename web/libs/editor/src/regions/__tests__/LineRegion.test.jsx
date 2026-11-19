import { types } from "mobx-state-tree";
import { importModulesWithBunReload } from "./moduleReload";

mockModule("../../tags/object/Image", () => {
  const { types } = require("mobx-state-tree");

  return {
    ImageModel: types
      .model("LineTestImageModel", { id: types.identifier })
      .volatile(() => ({ zoomScale: 2, whRatio: 2 }))
      .views(() => ({
        get naturalWidth() {
          return 200;
        },
        get naturalHeight() {
          return 100;
        },
      }))
      .actions(() => ({
        createSerializedResult(_region, value) {
          return { value: { ...value }, original_width: 200, original_height: 100, image_rotation: 0 };
        },
        internalToCanvasX(value) {
          return value * 2;
        },
        internalToCanvasY(value) {
          return value;
        },
        canvasToInternalX(value) {
          return value / 2;
        },
        canvasToInternalY(value) {
          return value;
        },
      })),
  };
});

let LineRegionModel;
let TestRoot;

const loadModels = async () => {
  const [lineModule, imageModule] = await importModulesWithBunReload(["../LineRegion", "../../tags/object/Image"]);

  LineRegionModel = lineModule.LineRegionModel;
  TestRoot = types.model("LineRegionTestRoot", {
    image: types.optional(imageModule.ImageModel, { id: "image" }),
    region: LineRegionModel,
  });
};

const createRegion = (overrides = {}) =>
  TestRoot.create({
    image: { id: "image" },
    region: {
      id: "line-1",
      pid: "line-1",
      object: "image",
      x1: 20,
      y1: 30,
      x2: 80,
      y2: 30,
      results: [],
      ...overrides,
    },
  }).region;

describe("LineRegion", () => {
  let region;

  beforeAll(loadModels);

  beforeEach(async () => {
    await loadModels();
    region = createRegion();
  });

  it("uses four editable endpoint coordinates", () => {
    expect(region.editableFields.map(({ property }) => property)).toEqual(["x1", "y1", "x2", "y2"]);

    region.setProperty("x1", -4);
    region.setProperty("y2", 120);

    expect(region.x1).toBe(0);
    expect(region.y2).toBe(100);
  });

  it("renders vertical endpoint caps for a horizontal line", () => {
    const [startCap, endCap] = region.endpointCaps;

    expect(startCap[0]).toBe(startCap[2]);
    expect(endCap[0]).toBe(endCap[2]);
    expect(startCap[3] - startCap[1]).toBeCloseTo(6);
    expect(endCap[3] - endCap[1]).toBeCloseTo(6);
  });

  it("keeps endpoint caps perpendicular to a diagonal line", () => {
    const diagonal = createRegion({ id: "line-diagonal", x1: 10, y1: 10, x2: 60, y2: 60 });
    const canvasDelta = { x: diagonal.canvasPoints[2] - diagonal.canvasPoints[0], y: diagonal.canvasPoints[3] - diagonal.canvasPoints[1] };

    diagonal.endpointCaps.forEach(([x1, y1, x2, y2]) => {
      const capDelta = { x: x2 - x1, y: y2 - y1 };
      expect(canvasDelta.x * capDelta.x + canvasDelta.y * capDelta.y).toBeCloseTo(0);
    });
  });

  it("updates one endpoint and clamps movement at image bounds", () => {
    region.setEndpoint(1, 190, 95);
    expect([region.x2, region.y2]).toEqual([95, 95]);

    region.moveByCanvas(-100, 50);
    expect([region.x1, region.y1, region.x2, region.y2]).toEqual([0, 35, 75, 100]);
  });

  it("serializes exactly two endpoints", () => {
    expect(region.serialize()).toEqual({
      value: { x1: 20, y1: 30, x2: 80, y2: 30 },
      original_width: 200,
      original_height: 100,
      image_rotation: 0,
    });
  });

  it("registers the line region model and detector", () => {
    const RegistryModule = requireActual("../../core/Registry");
    const Registry = RegistryModule.default ?? RegistryModule;

    expect(Registry.getModelByTag("lineregion")).toBe(LineRegionModel);
    expect(LineRegionModel.detectByValue({ x1: 1, y1: 2, x2: 3, y2: 4 })).toBe(true);
  });
});
