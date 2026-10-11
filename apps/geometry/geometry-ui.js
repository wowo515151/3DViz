export function countGeometryPoints(configuration, supercell) {
  return configuration.basis.length * supercell ** 3;
}

export function updateSceneStatus(ui, state) {
  const labels = { loading:"PREPARING GEOMETRY…", ready:"SCENE READY", error:"SCENE ERROR" };
  if (!Object.hasOwn(labels, state)) throw new RangeError(`Unknown scene status: ${state}`);
  ui.statusDot.className = `status-dot${state === "loading" ? "" : ` ${state}`}`;
  ui.statusText.textContent = labels[state];
}

export function renderConfigurationList(document, list, count, configurations, selectedId, onSelect) {
  count.textContent = `${configurations.length} forms`;
  let groupName = "";
  for (const config of configurations) {
    if (config.group !== groupName) {
      groupName = config.group;
      const heading = document.createElement("p");
      heading.className = "configuration-group";
      heading.textContent = groupName;
      list.append(heading);
    }
    const button = document.createElement("button");
    button.className = "configuration-button";
    button.type = "button";
    button.dataset.configuration = config.id;
    button.setAttribute("aria-pressed", String(config.id === selectedId));
    const glyph = document.createElement("span");
    glyph.className = `config-glyph config-glyph--${config.glyph}`;
    glyph.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 5; index += 1) glyph.append(document.createElement("i"));
    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = config.name;
    const note = document.createElement("small");
    note.textContent = config.note;
    text.append(title, note);
    const pointCount = document.createElement("span");
    pointCount.className = "config-count";
    pointCount.dataset.countFor = config.id;
    button.append(glyph, text, pointCount);
    button.addEventListener("click", () => onSelect(config.id));
    list.append(button);
  }
}

export function updateGeometryReadouts(ui, configurations, selectedId, supercell) {
  const config = configurations.find(item => item.id === selectedId);
  if (!config) throw new RangeError(`Unknown geometry configuration: ${selectedId}`);
  const points = countGeometryPoints(config, supercell);
  const dimensions = `${supercell} × ${supercell} × ${supercell}`;
  ui.sizeValue.textContent = dimensions;
  ui.sizeCaption.textContent = dimensions;
  ui.title.textContent = config.name.toUpperCase();
  ui.subtitle.textContent = `${config.group.toUpperCase()} · ${config.note.toUpperCase()}`;
  ui.total.textContent = `${points.toLocaleString()} ${points === 1 ? "PARTICLE" : "PARTICLES"}`;
  ui.legend.textContent = config.name.toUpperCase();
  ui.meta.textContent = `${dimensions} supercell · ${points.toLocaleString()} points`;
  for (const item of configurations) {
    const button = ui.list.querySelector(`[data-configuration="${item.id}"]`);
    button?.setAttribute("aria-pressed", String(item.id === selectedId));
    const count = ui.list.querySelector(`[data-count-for="${item.id}"]`);
    if (count) count.textContent = `${countGeometryPoints(item, supercell).toLocaleString()} points`;
  }
}
