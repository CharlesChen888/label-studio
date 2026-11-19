import { types } from "mobx-state-tree";
import { importModulesWithBunReload } from "./moduleReload";

mockModule("../../tags/object/Image", () => {
  const { types } = require("mobx-state-tree");

  return {
    ImageModel: types
      .model("CircleTestImageModel", { id: types.identifier })
      .volatile(() => ({ whRatio: 2 }))
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

let CircleRegionModel;
let TestRoot;

const loadModels = async () => {
  const [circleModule, imageModule] = await importModulesWithBunReload(["../CircleRegion", "../../tags/object/Image"]);

  CircleRegionModel = circleModule.CircleRegionModel;
  TestRoot = types.model("CircleRegionTestRoot", {
    image: types.optional(imageModule.ImageModel, { id: "image" }),
    region: CircleRegionModel,
  });
};

describe("CircleRegion", () => {
  let region;

  beforeAll(loadModels);

  beforeEach(async () => {
    await loadModels();
    region = TestRoot.create({
      image: { id: "image" },
      region: {
        id: "circle-1",
        pid: "circle-1",
        object: "image",
        x: 50,
        y: 50,
        radius: 10,
        results: [],
      },
    }).region;
  });

  it("exposes center and radius as editable properties", () => {
    expect(region.editableFields.map(({ property }) => property)).toEqual(["x", "y", "radius"]);

    region.setProperty("x", 40);
    region.setProperty("y", 45);
    region.setProperty("radius", 12);

    expect([region.x, region.y, region.radius]).toEqual([40, 45, 12]);

    region.setProperty("radius", -2);
    expect(region.radius).toBe(0);
  });

  it("keeps a visual circle on non-square images", () => {
    expect(region.canvasRadiusX).toBe(20);
    expect(region.canvasRadiusY).toBe(20);
    expect(region.radiusX).toBe(10);
    expect(region.radiusY).toBe(20);
    expect(region.radiusYInternal).toBe(20);
    expect(region.bboxCoords).toEqual({ left: 40, top: 30, right: 60, bottom: 70 });
  });

  it("normalizes unequal transform radii", () => {
    region.setPosition(80, 60, 30, 10);

    expect(region.x).toBe(40);
    expect(region.y).toBe(60);
    expect(region.radius).toBe(10);
  });

  it("serializes a center and one radius", () => {
    expect(region.serialize()).toEqual({
      value: { x: 50, y: 50, radius: 10 },
      original_width: 200,
      original_height: 100,
      image_rotation: 0,
    });
  });

  it("registers the circle region model", () => {
    const RegistryModule = requireActual("../../core/Registry");
    const Registry = RegistryModule.default ?? RegistryModule;

    expect(Registry.getModelByTag("circleregion")).toBe(CircleRegionModel);
  });
});
