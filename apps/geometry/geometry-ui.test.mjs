import assert from "node:assert/strict";
import test from "node:test";
import { GEOMETRY_CONFIGURATIONS } from "./geometry-model.js";
import { countGeometryPoints, renderConfigurationList, updateGeometryReadouts, updateSceneStatus } from "./geometry-ui.js";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.textContent = "";
  }

  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  click() { this.listeners.click?.(); }

  querySelector(selector) {
    const match = selector.match(/^\[data-(configuration|count-for)="([^"]+)"\]$/);
    if (!match) return null;
    const [, key, value] = match;
    const datasetKey = key === "configuration" ? "configuration" : "countFor";
    return this.children.flatMap(child => [child, ...child.children]).find(child => child.dataset?.[datasetKey] === value) ?? null;
  }
}

const fakeDocument = { createElement: tagName => new FakeElement(tagName) };

function makeReadoutUi() {
  const list = new FakeElement("div");
  return {
    list,
    size: { value: "3" },
    sizeValue: new FakeElement("output"),
    sizeCaption: new FakeElement("span"),
    title: new FakeElement("p"),
    subtitle: new FakeElement("p"),
    total: new FakeElement("span"),
    legend: new FakeElement("strong"),
    meta: new FakeElement("span"),
    statusDot: new FakeElement("i"),
    statusText: new FakeElement("span"),
  };
}

test("configuration list renders every form, current counts, and a working selection callback", () => {
  const list = new FakeElement("div");
  const count = new FakeElement("span");
  const selected = [];
  renderConfigurationList(fakeDocument, list, count, GEOMETRY_CONFIGURATIONS, "ci", id => selected.push(id));

  assert.equal(count.textContent, "23 forms");
  const buttons = list.children.filter(child => child.tagName === "button");
  assert.equal(buttons.length, 23);
  assert.equal(buttons.filter(button => button.attributes["aria-pressed"] === "true").length, 1);
  assert.equal(list.querySelector('[data-configuration="ci"]').attributes["aria-pressed"], "true");
  list.querySelector('[data-configuration="hcp"]').click();
  assert.deepEqual(selected, ["hcp"]);
});

test("selection and supercell changes keep all point counts and accessible readouts in sync", () => {
  const ui = makeReadoutUi();
  const count = new FakeElement("span");
  renderConfigurationList(fakeDocument, ui.list, count, GEOMETRY_CONFIGURATIONS, "ci", () => {});

  updateGeometryReadouts(ui, GEOMETRY_CONFIGURATIONS, "ci", 3);
  assert.equal(ui.total.textContent, "54 PARTICLES");
  assert.equal(ui.meta.textContent, "3 × 3 × 3 supercell · 54 points");
  assert.equal(ui.list.querySelector('[data-count-for="ci"]').textContent, "54 points");

  updateGeometryReadouts(ui, GEOMETRY_CONFIGURATIONS, "fluorite", 6);
  assert.equal(ui.title.textContent, "FLUORITE ARRANGEMENT");
  assert.equal(ui.subtitle.textContent, "RELATED PATTERNS · FCC POINTS WITH TETRAHEDRAL SITES FILLED");
  assert.equal(ui.total.textContent, "2,592 PARTICLES");
  assert.equal(ui.meta.textContent, "6 × 6 × 6 supercell · 2,592 points");
  assert.equal(ui.list.querySelector('[data-count-for="fluorite"]').textContent, "2,592 points");
  assert.equal(ui.list.querySelector('[data-configuration="ci"]').attributes["aria-pressed"], "false");
  assert.equal(ui.list.querySelector('[data-configuration="fluorite"]').attributes["aria-pressed"], "true");

  updateGeometryReadouts(ui, GEOMETRY_CONFIGURATIONS, "zeolite-cages", 2);
  assert.equal(ui.total.textContent, "96 PARTICLES");
  assert.equal(ui.legend.textContent, "ZEOLITE-STYLE CAGE FRAMEWORK");
  assert.equal(ui.list.querySelector('[data-count-for="zeolite-cages"]').textContent, "96 points");
});

test("configuration point counts and unknown selection handling stay defined", () => {
  assert.equal(countGeometryPoints(GEOMETRY_CONFIGURATIONS.find(item => item.id === "cp"), 1), 1);
  assert.equal(countGeometryPoints(GEOMETRY_CONFIGURATIONS.find(item => item.id === "fluorite"), 6), 2592);
  assert.throws(() => updateGeometryReadouts(makeReadoutUi(), GEOMETRY_CONFIGURATIONS, "missing", 3), RangeError);
});

test("scene status reports loading, success, and renderer errors accurately", () => {
  const ui = makeReadoutUi();
  updateSceneStatus(ui, "loading");
  assert.equal(ui.statusDot.className, "status-dot");
  assert.equal(ui.statusText.textContent, "PREPARING GEOMETRY…");
  updateSceneStatus(ui, "ready");
  assert.equal(ui.statusDot.className, "status-dot ready");
  assert.equal(ui.statusText.textContent, "SCENE READY");
  updateSceneStatus(ui, "error");
  assert.equal(ui.statusDot.className, "status-dot error");
  assert.equal(ui.statusText.textContent, "SCENE ERROR");
  assert.throws(() => updateSceneStatus(ui, "unknown"), RangeError);
});
