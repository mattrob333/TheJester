import { useGLTF } from "@react-three/drei";
import type { Object3D } from "three";

/**
 * Draco decoder location.
 *
 * By default we use the Google-hosted gstatic decoder (drei's built-in default),
 * which requires no committed binaries. To SELF-HOST instead, drop the decoder
 * files into `public/draco/` (from the three.js `examples/jsm/libs/draco/`
 * distribution) and set this to "/draco/".
 *
 * See README → "Asset pipeline".
 */
export const DRACO_DECODER_PATH =
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

/** Minimal structural type covering what game code reads off a loaded glTF. */
export interface GltfResult {
  scene: Object3D;
  nodes: Record<string, Object3D>;
  materials: Record<string, unknown>;
}

/**
 * Project-standard glTF/glb loader.
 *
 * Wraps drei's `useGLTF` with Draco decompression enabled. EVERY model in the
 * game must enter through this helper (pipeline rule — see README): glb only,
 * no FBX/OBJ committed.
 *
 * @param path Path under `public/` (e.g. "/models/player.glb").
 */
export function loadGltf(path: string): GltfResult {
  return useGLTF(path, DRACO_DECODER_PATH) as unknown as GltfResult;
}

/** Preload a model so it is ready before the component mounts. */
loadGltf.preload = (path: string): void => {
  useGLTF.preload(path, DRACO_DECODER_PATH);
};

/** Drop a model from drei's cache (e.g. on arena teardown). */
loadGltf.clear = (path: string): void => {
  useGLTF.clear(path);
};
