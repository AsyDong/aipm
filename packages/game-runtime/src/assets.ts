import type {
  AssetManifest,
  AssetReference,
  IAssetManager,
} from '@english/contracts';

export interface LoadedAsset {
  asset: AssetReference;
  dispose(): void;
}
export class AssetManager implements IAssetManager {
  private cache = new Map<
    string,
    {
      original: AssetReference;
      loaded: Promise<LoadedAsset>;
      scopes: Set<string>;
    }
  >();
  private disposed = false;
  constructor(private load: (asset: AssetReference) => Promise<LoadedAsset>) {}
  async preload(manifest: AssetManifest) {
    if (this.disposed) throw new Error('Assets destroyed');
    if (
      new Set(manifest.assets.map((asset) => asset.key)).size !==
      manifest.assets.length
    )
      throw new Error('Duplicate asset key');
    await Promise.all(
      manifest.assets.map(async (asset) => {
        let entry = this.cache.get(asset.key);
        if (
          entry &&
          (entry.original.url !== asset.url ||
            entry.original.version !== asset.version)
        )
          throw new Error(`Asset key conflict: ${asset.key}`);
        if (!entry) {
          const loaded = this.load(asset).catch(() => this.load(asset));
          entry = { original: asset, loaded, scopes: new Set() };
          this.cache.set(asset.key, entry);
        }
        entry.scopes.add(manifest.scope);
        try {
          await entry.loaded;
        } catch (error) {
          this.cache.delete(asset.key);
          throw error;
        }
      }),
    );
  }
  get(key: string) {
    return this.cache.get(key)?.original;
  }
  async resolve(key: string) {
    return (await this.cache.get(key)?.loaded)?.asset;
  }
  async release(scope: string) {
    for (const entry of this.cache.values()) entry.scopes.delete(scope);
    await this.clearUnused();
  }
  async clearUnused() {
    const jobs: Promise<void>[] = [];
    for (const [key, entry] of this.cache) {
      if (entry.scopes.size) continue;
      this.cache.delete(key);
      jobs.push(
        entry.loaded.then(
          (loaded) => loaded.dispose(),
          () => {},
        ),
      );
    }
    await Promise.all(jobs);
  }
  async destroy() {
    this.disposed = true;
    for (const entry of this.cache.values()) entry.scopes.clear();
    await this.clearUnused();
  }
}

export async function loadBrowserAsset(
  asset: AssetReference,
): Promise<LoadedAsset> {
  const url = new URL(asset.url, location.href);
  if (
    url.origin !== location.origin ||
    !['http:', 'https:'].includes(url.protocol)
  )
    throw new Error('Asset origin is not permitted');
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok)
    throw new Error(`Asset unavailable: ${asset.key} (${response.status})`);
  const blob = await response.blob();
  if (blob.size > 10 * 1024 * 1024) throw new Error('Asset exceeds size limit');
  const objectUrl = URL.createObjectURL(blob);
  return {
    asset: { ...asset, url: objectUrl },
    dispose: () => URL.revokeObjectURL(objectUrl),
  };
}
