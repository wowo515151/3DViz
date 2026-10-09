import { VisualizationError } from "./errors.js";
import { createResourceRegistry } from "./resource-registry.js";

function option(value, fallback) { return value === undefined ? fallback : value; }

function assertDefinition(container, definition) {
  if (!container || typeof container.appendChild !== "function" || typeof container.removeChild !== "function") {
    throw new VisualizationError("INVALID_CONTAINER", "mount() requires a DOM element that can contain a canvas.");
  }
  if (!definition || typeof definition !== "object" || !definition.adapter || typeof definition.adapter.create !== "function") {
    throw new VisualizationError("INVALID_DEFINITION", "mount() definition must include an adapter with a create(context, definition, data) method.");
  }
  if (typeof definition.adapter.capabilities !== "undefined" && !Array.isArray(definition.adapter.capabilities)) {
    throw new VisualizationError("INVALID_CAPABILITIES", "adapter.capabilities must be an array of capability names.");
  }
  if (!definition.configuration || typeof definition.configuration !== "object") {
    throw new VisualizationError("INVALID_CONFIGURATION", "mount() definition must include a configuration object.");
  }
}

function containerSize(container) {
  return {
    width: Math.max(1, Math.floor(container.clientWidth || container.getBoundingClientRect?.().width || 1)),
    height: Math.max(1, Math.floor(container.clientHeight || container.getBoundingClientRect?.().height || 1)),
  };
}

function vector3(THREE, input, fallback) {
  const value = input ?? fallback;
  if (!Array.isArray(value) || value.length !== 3 || value.some(item => !Number.isFinite(item))) {
    throw new VisualizationError("INVALID_CAMERA_VECTOR", "Camera position, target, and up vectors must contain three finite numbers.");
  }
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function createCamera(THREE, mode, settings, aspect) {
  const near = option(settings.near, 0.1);
  const far = option(settings.far, 2000);
  let camera;
  if (mode === "orthographic") {
    const height = option(settings.orthographicHeight, 10);
    camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2, height / 2, -height / 2, near, far);
  } else {
    camera = new THREE.PerspectiveCamera(option(settings.fov, 45), aspect, near, far);
  }
  camera.position.copy(vector3(THREE, settings.position, [5, 5, 5]));
  camera.up.copy(vector3(THREE, settings.up, [0, 1, 0]));
  const target = vector3(THREE, settings.target, [0, 0, 0]);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return { camera, target };
}

/** Load the mapped runtime only when mount() is called, allowing the page to retain its HTML fallback on failure. */
export async function loadThreeRuntime({ controls = false } = {}) {
  let THREE;
  try {
    THREE = await import("three");
  } catch (cause) {
    throw new VisualizationError("THREE_LOAD_FAILED", "Three.js could not be loaded. Check the approved CDN, version, and network connection.", { cause });
  }
  let OrbitControls;
  if (controls) {
    try {
      ({ OrbitControls } = await import("three/addons/controls/OrbitControls.js"));
    } catch (cause) {
      throw new VisualizationError("CONTROLS_LOAD_FAILED", "OrbitControls could not be loaded from the configured Three.js runtime.", { cause });
    }
  }
  return { THREE, OrbitControls };
}

/** Public async entry point. The browser import map resolves the bare Three.js specifiers. */
export async function mount(container, definition) {
  assertDefinition(container, definition);
  const runtime = await loadThreeRuntime({ controls: definition.controls?.enabled === true });
  return createViewerWithRuntime(container, definition, runtime);
}

/** Internal test seam: initialize the viewer with an injected Three.js-compatible runtime. */
export async function createViewerWithRuntime(container, definition, runtime) {
  assertDefinition(container, definition);
  const THREE = runtime?.THREE;
  if (!THREE?.Scene || !THREE?.WebGLRenderer || !THREE?.PerspectiveCamera || !THREE?.Vector3) {
    throw new VisualizationError("INVALID_RUNTIME", "The injected runtime does not provide the required Three.js classes.");
  }
  if (definition.camera?.modes?.includes("orthographic") && typeof THREE.OrthographicCamera !== "function") {
    throw new VisualizationError("ORTHOGRAPHIC_UNAVAILABLE", "Orthographic camera mode was requested but is not available in the runtime.");
  }
  if (definition.adapter.capabilities?.includes("selection") && (!THREE.Raycaster || !THREE.Vector2)) {
    throw new VisualizationError("SELECTION_UNAVAILABLE", "Selection was requested but the runtime does not provide raycasting classes.");
  }

  const size = containerSize(container);
  const registry = createResourceRegistry();
  const coreResources = registry.createOwner("viewer-core");
  const adapterResources = registry.createOwner("scene-adapter");
  const callbacks = definition.callbacks ?? {};
  const adapterDefinition = definition.adapter;
  const sceneCapabilities = new Set(adapterDefinition.capabilities ?? []);
  if ([...sceneCapabilities].some(capability => typeof capability !== "string" || capability.length === 0)) {
    throw new VisualizationError("INVALID_CAPABILITIES", "Capability names must be non-empty strings.");
  }
  const cameraModes = definition.camera?.modes;
  if (cameraModes !== undefined && (!Array.isArray(cameraModes) || cameraModes.some(mode => mode !== "perspective" && mode !== "orthographic"))) {
    throw new VisualizationError("INVALID_CAMERA_MODES", "camera.modes must contain only 'perspective' or 'orthographic'.");
  }
  const enabledCameraModes = new Set(cameraModes ?? [definition.camera?.type ?? "perspective"]);
  const configuredCameraMode = definition.camera?.type ?? "perspective";
  if (configuredCameraMode !== "perspective" && configuredCameraMode !== "orthographic") {
    throw new VisualizationError("INVALID_CAMERA_MODE", "camera.type must be 'perspective' or 'orthographic'.");
  }
  const cameraModeEnabled = enabledCameraModes.size > 1;
  if (cameraModeEnabled && enabledCameraModes.size !== 2) throw new VisualizationError("INVALID_CAMERA_MODES", "Camera switching requires both perspective and orthographic modes.");
  if (cameraModeEnabled && !enabledCameraModes.has("perspective")) throw new VisualizationError("INVALID_CAMERA_MODES", "Camera switching must include perspective mode.");
  if (definition.controls?.enabled === true && typeof runtime.OrbitControls !== "function") {
    throw new VisualizationError("CONTROLS_UNAVAILABLE", "Controls are enabled but OrbitControls was not loaded.");
  }
  const cameraSettingsForValidation = definition.camera ?? {};
  const fov = option(cameraSettingsForValidation.fov, 45);
  const near = option(cameraSettingsForValidation.near, 0.1);
  const far = option(cameraSettingsForValidation.far, 2000);
  const orthoHeight = option(cameraSettingsForValidation.orthographicHeight, 10);
  if (!(Number.isFinite(fov) && fov > 0 && fov < 180)) throw new VisualizationError("INVALID_CAMERA_FOV", "camera.fov must be greater than zero and less than 180 degrees.");
  if (!(Number.isFinite(near) && near > 0 && Number.isFinite(far) && far > near)) throw new VisualizationError("INVALID_CAMERA_CLIPPING", "Camera near must be positive and far must be greater than near.");
  if (!(Number.isFinite(orthoHeight) && orthoHeight > 0)) throw new VisualizationError("INVALID_ORTHOGRAPHIC_HEIGHT", "camera.orthographicHeight must be positive and finite.");
  const controlsSettings = definition.controls ?? {};
  const minDistance = option(controlsSettings.minDistance, 0.1);
  const maxDistance = option(controlsSettings.maxDistance, 1000);
  const dampingFactor = option(controlsSettings.dampingFactor, 0.05);
  if (!(Number.isFinite(minDistance) && minDistance > 0 && Number.isFinite(maxDistance) && maxDistance > minDistance)) {
    throw new VisualizationError("INVALID_CONTROL_DISTANCE", "Control minDistance must be positive and maxDistance must be greater than minDistance.");
  }
  if (!(Number.isFinite(dampingFactor) && dampingFactor > 0 && dampingFactor <= 1)) {
    throw new VisualizationError("INVALID_DAMPING_FACTOR", "controls.dampingFactor must be greater than zero and at most one.");
  }
  const maxPixelRatio = option(definition.renderer?.maxPixelRatio, 2);
  if (!(Number.isFinite(maxPixelRatio) && maxPixelRatio > 0)) throw new VisualizationError("INVALID_PIXEL_RATIO", "renderer.maxPixelRatio must be positive and finite.");

  let renderer;
  let scene;
  let adapterInstance;
  let adapterCreated = false;
  let canvasAttached = false;
  let activeControls;
  let resizeObserver;
  let disposed = false;
  let playing = false;
  let resumePlayingAfterVisibility = false;
  let resumeDampingAfterVisibility = false;
  let lastFrameTime;
  let elapsedSeconds = 0;
  const listeners = [];
  const cameras = new Map();
  const targets = new Map();
  const resetStates = new Map();
  const errors = [];
  const cameraChangeListeners = new Set();

  function addListener(target, type, callback, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, callback, options);
    listeners.push(() => target.removeEventListener(type, callback, options));
  }

  function report(error) {
    try { callbacks.onError?.(error); } catch { /* User callbacks must not break cleanup. */ }
  }

  function cleanup({ initializing = false } = {}) {
    if (disposed && !initializing) return;
    disposed = true;
    playing = false;
    try { renderer?.setAnimationLoop?.(null); } catch (error) { errors.push(error); }
    try { resizeObserver?.disconnect(); } catch (error) { errors.push(error); }
    for (const remove of listeners.splice(0)) {
      try { remove(); } catch (error) { errors.push(error); }
    }
    try { activeControls?.dispose?.(); } catch (error) { errors.push(error); }
    cameraChangeListeners.clear();
    if (adapterCreated) {
      try { adapterInstance?.dispose?.(); } catch (error) { errors.push(error); }
    }
    try { adapterResources.dispose(); } catch (error) { errors.push(error); }
    if (canvasAttached && renderer?.domElement?.parentNode === container) {
      try { container.removeChild(renderer.domElement); } catch (error) { errors.push(error); }
    }
    try { coreResources.dispose(); } catch (error) { errors.push(error); }
    try { registry.disposeAll(); } catch (error) { errors.push(error); }
    if (errors.length && !initializing) throw new AggregateError(errors, "One or more viewer resources failed to dispose.");
  }

  try {
    const rendererSettings = definition.renderer ?? {};
    renderer = new THREE.WebGLRenderer({
      antialias: option(rendererSettings.antialias, true),
      alpha: option(rendererSettings.alpha, false),
      preserveDrawingBuffer: option(rendererSettings.preserveDrawingBuffer, false),
      powerPreference: option(rendererSettings.powerPreference, "high-performance"),
    });
    coreResources.track(renderer);
    renderer.setPixelRatio?.(Math.min(container.ownerDocument?.defaultView?.devicePixelRatio ?? 1, option(rendererSettings.maxPixelRatio, 2)));
    renderer.setSize(size.width, size.height);
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (rendererSettings.toneMapping && rendererSettings.toneMapping in THREE && "toneMapping" in renderer) {
      renderer.toneMapping = THREE[rendererSettings.toneMapping];
    }
    if (Number.isFinite(rendererSettings.toneMappingExposure) && "toneMappingExposure" in renderer) {
      renderer.toneMappingExposure = rendererSettings.toneMappingExposure;
    }
    scene = new THREE.Scene();
    if (definition.configuration.backgroundColor !== undefined && typeof THREE.Color === "function") {
      scene.background = new THREE.Color(definition.configuration.backgroundColor);
    }

    const cameraSettings = definition.camera ?? {};
    const initialMode = cameraSettings.type ?? "perspective";
    if (!enabledCameraModes.has(initialMode)) throw new VisualizationError("INVALID_CAMERA_MODE", "camera.type must be included in camera.modes.");
    for (const mode of enabledCameraModes) {
      const created = createCamera(THREE, mode, cameraSettings, size.width / size.height);
      cameras.set(mode, created.camera);
      targets.set(mode, created.target);
    }
    let activeMode = initialMode;
    let activeCamera = cameras.get(activeMode);
    let currentAspect = size.width / size.height;
    let currentOrthographicHeight = option(cameraSettings.orthographicHeight, 10);
    for (const [mode, camera] of cameras) {
      resetStates.set(mode, { position: camera.position.clone(), up: camera.up.clone(), target: targets.get(mode).clone() });
    }

    function notifyCameraChange() {
      for (const listener of [...cameraChangeListeners]) {
        try { listener(activeCamera); } catch (error) { report(error); }
      }
    }

    function render() {
      if (disposed) return;
      try {
        activeControls?.update?.();
        notifyCameraChange();
        renderer.render(scene, activeCamera);
      } catch (error) { report(error); }
    }

    function renderWithoutUpdatingControls() {
      if (disposed) return;
      try { notifyCameraChange(); renderer.render(scene, activeCamera); } catch (error) { report(error); }
    }

    function renderInitialFrame() {
      activeControls?.update?.();
      notifyCameraChange();
      renderer.render(scene, activeCamera);
    }

    function createControls() {
      activeControls?.dispose?.();
      activeControls = undefined;
      if (definition.controls?.enabled !== true) return;
      activeControls = new runtime.OrbitControls(activeCamera, renderer.domElement);
      activeControls.target.copy(targets.get(activeMode));
      activeControls.enableDamping = option(definition.controls.enableDamping, false);
      activeControls.dampingFactor = option(definition.controls.dampingFactor, 0.05);
      activeControls.minDistance = option(definition.controls.minDistance, 0.1);
      activeControls.maxDistance = option(definition.controls.maxDistance, 1000);
      activeControls.addEventListener?.("change", renderWithoutUpdatingControls);
    }

    function resize() {
      if (disposed) return;
      const next = containerSize(container);
      currentAspect = next.width / next.height;
      renderer.setSize(next.width, next.height);
      for (const [mode, camera] of cameras) {
        if (mode === "perspective") camera.aspect = currentAspect;
        else {
          const height = currentOrthographicHeight;
          camera.left = -height * currentAspect / 2;
          camera.right = height * currentAspect / 2;
          camera.top = height / 2;
          camera.bottom = -height / 2;
        }
        camera.updateProjectionMatrix();
      }
      render();
    }

    const adapterContext = Object.freeze({
      THREE,
      scene,
      renderer,
      resourceRegistry: registry,
      resources: adapterResources,
      getActiveCamera: () => activeCamera,
      onCameraChange(listener) {
        if (typeof listener !== "function") throw new VisualizationError("INVALID_CAMERA_LISTENER", "onCameraChange() requires a function.");
        cameraChangeListeners.add(listener);
        try { listener(activeCamera); } catch (error) { report(error); }
        return () => cameraChangeListeners.delete(listener);
      },
      requestRender: render,
      callbacks: Object.freeze({ onError: report, onSelection: callbacks.onSelection }),
    });
    adapterInstance = await adapterDefinition.create(adapterContext, definition, definition.data);
    adapterCreated = true;
    if (!adapterInstance || typeof adapterInstance.update !== "function" || typeof adapterInstance.dispose !== "function") {
      throw new VisualizationError("INVALID_ADAPTER_INSTANCE", "adapter.create() must return an object with update() and dispose() methods.");
    }
    if (adapterInstance.capabilities) {
      if (!Array.isArray(adapterInstance.capabilities)) throw new VisualizationError("INVALID_CAPABILITIES", "The adapter instance capabilities must be an array.");
      for (const capability of adapterInstance.capabilities) sceneCapabilities.add(capability);
    }
    if (sceneCapabilities.has("selection") && typeof adapterInstance.describeSelection !== "function") {
      throw new VisualizationError("INVALID_SELECTION_ADAPTER", "A selection-capable adapter must implement describeSelection(hit).");
    }

    function animationFrame(timestamp) {
      if (disposed || (!playing && !activeControls?.enableDamping)) return;
      const now = Number.isFinite(timestamp) ? timestamp / 1000 : (container.ownerDocument?.defaultView?.performance?.now?.() ?? Date.now()) / 1000;
      const delta = lastFrameTime === undefined ? 0 : Math.min(0.1, Math.max(0, now - lastFrameTime));
      lastFrameTime = now;
      if (playing) {
        elapsedSeconds += delta;
        try { adapterInstance.updateFrame?.({ elapsedSeconds, deltaSeconds: delta }); } catch (error) { pause(); report(error); }
      }
      render();
    }

    function startLoop() {
      if (disposed || container.ownerDocument?.hidden) return;
      lastFrameTime = undefined;
      renderer.setAnimationLoop(animationFrame);
    }

    function play() {
      if (!sceneCapabilities.has("animation")) throw new VisualizationError("UNSUPPORTED_CAPABILITY", "The scene does not declare the 'animation' capability.");
      playing = true;
      if (container.ownerDocument?.hidden) {
        resumePlayingAfterVisibility = true;
        return;
      }
      startLoop();
    }

    function pause() {
      playing = false;
      lastFrameTime = undefined;
      if (!activeControls?.enableDamping) renderer.setAnimationLoop(null);
      render();
    }

    function ensureAlive() {
      if (disposed) throw new VisualizationError("VIEWER_DISPOSED", "This viewer has been disposed.");
    }

    function capabilityMethod(capability, method) {
      if (!sceneCapabilities.has(capability)) return undefined;
      if (typeof adapterInstance[method] !== "function") throw new VisualizationError("MISSING_ADAPTER_METHOD", `The adapter declares '${capability}' but does not implement ${method}().`);
      return (...args) => {
        ensureAlive();
        const result = adapterInstance[method](...args);
        if (result && typeof result.then === "function") return result.then(value => { render(); return value; }, error => { report(error); throw error; });
        render();
        return result;
      };
    }

    createControls();
    const canvas = renderer.domElement;
    if (!canvas) throw new VisualizationError("MISSING_CANVAS", "WebGLRenderer did not create a canvas.");
    container.appendChild(canvas);
    canvasAttached = true;

    if (sceneCapabilities.has("selection")) {
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const onPointerUp = event => {
        if (disposed) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, activeCamera);
        const hit = raycaster.intersectObjects(scene.children, true)[0];
        if (!hit) return;
        let selection;
        try { selection = adapterInstance.describeSelection(hit); } catch (error) { report(error); return; }
        if (selection !== undefined && selection !== null) {
          try { callbacks.onSelection?.(selection); } catch (error) { report(error); }
        }
      };
      addListener(canvas, "pointerup", onPointerUp);
    }

    const view = container.ownerDocument?.defaultView;
    if (view?.ResizeObserver) {
      resizeObserver = new view.ResizeObserver(resize);
      resizeObserver.observe(container);
    } else addListener(view, "resize", resize);
    addListener(container.ownerDocument, "visibilitychange", () => {
      if (container.ownerDocument.hidden) {
        resumePlayingAfterVisibility = playing;
        resumeDampingAfterVisibility = Boolean(activeControls?.enableDamping);
        if (playing) pause();
        if (resumeDampingAfterVisibility) renderer.setAnimationLoop(null);
      } else if (resumePlayingAfterVisibility || resumeDampingAfterVisibility) {
        const resumePlaying = resumePlayingAfterVisibility;
        resumePlayingAfterVisibility = false;
        resumeDampingAfterVisibility = false;
        if (resumePlaying) play();
        else startLoop();
      }
    });

    renderInitialFrame();

    const controller = {
      capabilities: Object.freeze([...sceneCapabilities, ...(cameraModeEnabled ? ["cameraModes"] : [])]),
      get cameraMode() { return activeMode; },
      async update(data, configuration = {}) {
        ensureAlive();
        try {
          await adapterInstance.update(data, configuration);
        } catch (error) {
          report(error);
          throw error;
        }
        render();
      },
      resetView() {
        ensureAlive();
        const reset = resetStates.get(activeMode);
        activeCamera.position.copy(reset.position);
        activeCamera.up.copy(reset.up);
        activeCamera.lookAt(reset.target);
        targets.set(activeMode, reset.target.clone());
        activeControls?.target.copy(reset.target);
        if (activeMode === "orthographic") {
          const height = option(cameraSettings.orthographicHeight, 10);
          currentOrthographicHeight = height;
          activeCamera.left = -height * currentAspect / 2;
          activeCamera.right = height * currentAspect / 2;
          activeCamera.top = height / 2;
          activeCamera.bottom = -height / 2;
        }
        activeCamera.updateProjectionMatrix();
        render();
      },
      getCameraPose() {
        ensureAlive();
        const target = activeControls?.target ?? targets.get(activeMode);
        return Object.freeze({
          mode: activeMode,
          position: Object.freeze([activeCamera.position.x, activeCamera.position.y, activeCamera.position.z]),
          up: Object.freeze([activeCamera.up.x, activeCamera.up.y, activeCamera.up.z]),
          target: Object.freeze([target.x, target.y, target.z]),
        });
      },
      setCameraPose(pose) {
        ensureAlive();
        if (!pose || typeof pose !== "object") throw new VisualizationError("INVALID_CAMERA_POSE", "Camera pose must include a camera mode, position, up vector, and target.");
        if (pose.mode !== activeMode) {
          if (!enabledCameraModes.has(pose.mode)) throw new VisualizationError("INVALID_CAMERA_MODE", `Camera mode '${pose.mode}' is not enabled.`);
          controller.setCameraMode(pose.mode);
        }
        const position = vector3(THREE, pose.position, undefined);
        const up = vector3(THREE, pose.up, undefined);
        const target = vector3(THREE, pose.target, undefined);
        if (position.distanceTo(target) === 0) throw new VisualizationError("INVALID_CAMERA_POSE", "Camera position must be away from its target.");
        activeCamera.position.copy(position);
        activeCamera.up.copy(up);
        targets.set(activeMode, target.clone());
        if (activeControls) activeControls.target.copy(target);
        activeCamera.lookAt(target);
        activeCamera.updateProjectionMatrix();
        activeControls?.update?.();
        render();
      },
      setOrbitAngle(angle) {
        ensureAlive();
        if (!Number.isFinite(angle)) throw new VisualizationError("INVALID_ORBIT_ANGLE", "Orbit angle must be finite radians.");
        const target = activeControls?.target ?? targets.get(activeMode);
        const offsetX = activeCamera.position.x - target.x;
        const offsetY = activeCamera.position.y - target.y;
        const offsetZ = activeCamera.position.z - target.z;
        const radius = Math.hypot(offsetX, offsetY, offsetZ);
        if (radius === 0) throw new VisualizationError("INVALID_ORBIT_POSITION", "The camera must be away from its orbit target.");
        const polar = Math.acos(Math.max(-1, Math.min(1, offsetY / radius)));
        activeCamera.position.set(
          target.x + radius * Math.sin(polar) * Math.sin(angle),
          target.y + radius * Math.cos(polar),
          target.z + radius * Math.sin(polar) * Math.cos(angle),
        );
        activeCamera.lookAt(target);
        activeControls?.update?.();
        render();
      },
      dispose() { cleanup(); },
    };

    const setTime = capabilityMethod("time", "setTime");
    const setLayerVisible = capabilityMethod("layers", "setLayerVisible");
    const setSlice = capabilityMethod("slices", "setSlice");
    const setThreshold = capabilityMethod("thresholds", "setThreshold");
    const setFilter = capabilityMethod("filters", "setFilter");
    const setHighlight = capabilityMethod("highlights", "setHighlight");
    for (const [key, method] of Object.entries({ setTime, setLayerVisible, setSlice, setThreshold, setFilter, setHighlight })) {
      if (method) controller[key] = method;
    }
    if (cameraModeEnabled) {
      controller.setCameraMode = mode => {
        ensureAlive();
        if (!enabledCameraModes.has(mode)) throw new VisualizationError("INVALID_CAMERA_MODE", `Camera mode '${mode}' is not enabled.`);
        if (mode === activeMode) return;
        const oldPosition = activeCamera.position.clone();
        const oldTarget = activeControls?.target.clone() ?? targets.get(activeMode).clone();
        const nextCamera = cameras.get(mode);
        const distance = oldPosition.distanceTo(oldTarget);
        nextCamera.position.copy(oldPosition);
        targets.set(mode, oldTarget);
        nextCamera.lookAt(oldTarget);
        if (mode === "orthographic") {
          const height = cameraSettings.orthographicHeight ?? distance * Math.tan((option(cameraSettings.fov, 45) * Math.PI) / 360) * 2;
          currentOrthographicHeight = height;
          nextCamera.left = -height * currentAspect / 2;
          nextCamera.right = height * currentAspect / 2;
          nextCamera.top = height / 2;
          nextCamera.bottom = -height / 2;
        }
        nextCamera.updateProjectionMatrix();
        activeMode = mode;
        activeCamera = nextCamera;
        createControls();
        render();
      };
    }
    if (sceneCapabilities.has("animation")) {
      if (typeof adapterInstance.updateFrame !== "function") throw new VisualizationError("INVALID_ANIMATION_ADAPTER", "An animation-capable adapter must implement updateFrame(frame).");
      controller.play = () => { ensureAlive(); play(); };
      controller.pause = () => { ensureAlive(); pause(); };
    }

    if (activeControls?.enableDamping) startLoop();
    if (definition.configuration.autoplay === true) {
      if (!sceneCapabilities.has("animation")) throw new VisualizationError("AUTOPLAY_UNSUPPORTED", "configuration.autoplay requires an animation-capable scene adapter.");
      controller.play();
    }
    return controller;
  } catch (cause) {
    cleanup({ initializing: true });
    if (cause instanceof VisualizationError) throw cause;
    throw new VisualizationError("MOUNT_FAILED", "The visualization viewer could not be initialized.", { cause });
  }
}
