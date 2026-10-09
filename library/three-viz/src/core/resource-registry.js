import { VisualizationError } from "./errors.js";

/** Owner-scoped deterministic disposal for GPU and other explicitly disposable resources. */
export function createResourceRegistry() {
  const owners = new Map();
  const resources = new Map();
  let disposed = false;

  function assertLive() {
    if (disposed) throw new VisualizationError("REGISTRY_DISPOSED", "The resource registry has already been disposed.");
  }

  function disposeResource(resource, errors) {
    if (typeof resource?.dispose !== "function") return;
    try { resource.dispose(); } catch (error) { errors.push(error); }
  }

  function drop(resource, ownerId, errors) {
    const entry = resources.get(resource);
    if (!entry) return;
    entry.owners.delete(ownerId);
    owners.get(ownerId)?.delete(resource);
    if (entry.owners.size === 0) {
      resources.delete(resource);
      disposeResource(resource, errors);
    }
  }

  function createOwner(label = "owner") {
    assertLive();
    const ownerId = Symbol(String(label));
    owners.set(ownerId, new Set());
    let ownerDisposed = false;
    return Object.freeze({
      label: String(label),
      track(resource) {
        assertLive();
        if (ownerDisposed) throw new VisualizationError("OWNER_DISPOSED", `Resource owner '${label}' has been disposed.`);
        if ((typeof resource !== "object" && typeof resource !== "function") || resource === null) throw new VisualizationError("INVALID_RESOURCE", "Only object resources can be tracked.");
        let entry = resources.get(resource);
        if (!entry) { entry = { owners: new Set() }; resources.set(resource, entry); }
        entry.owners.add(ownerId);
        owners.get(ownerId).add(resource);
        return resource;
      },
      release(resource) {
        if (ownerDisposed || disposed) return;
        const errors = [];
        drop(resource, ownerId, errors);
        if (errors.length) throw new AggregateError(errors, `Failed to dispose a resource owned by '${label}'.`);
      },
      dispose() {
        if (ownerDisposed) return;
        ownerDisposed = true;
        const errors = [];
        for (const resource of [...(owners.get(ownerId) ?? [])]) drop(resource, ownerId, errors);
        owners.delete(ownerId);
        if (errors.length) throw new AggregateError(errors, `Failed to dispose resources owned by '${label}'.`);
      },
    });
  }

  function disposeAll() {
    if (disposed) return;
    disposed = true;
    const errors = [];
    for (const resource of resources.keys()) disposeResource(resource, errors);
    resources.clear();
    owners.clear();
    if (errors.length) throw new AggregateError(errors, "Failed to dispose all registered resources.");
  }

  return Object.freeze({
    createOwner,
    disposeAll,
    get stats() { return Object.freeze({ owners: owners.size, resources: resources.size, disposed }); },
  });
}
