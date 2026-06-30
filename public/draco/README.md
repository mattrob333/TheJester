# Draco decoder (optional self-hosting)

The `loadGltf` helper (`src/lib/loadGltf.ts`) decompresses Draco-encoded glTF.
By default it points at the Google-hosted decoder:

    https://www.gstatic.com/draco/versioned/decoders/1.5.7/

That requires **no files in this folder** and works out of the box.

## To self-host instead (offline / no third-party CDN)

1. Copy the decoder files from the three.js distribution
   (`node_modules/three/examples/jsm/libs/draco/`) into this directory:
   - `draco_decoder.js`
   - `draco_decoder.wasm`
   - `draco_wasm_wrapper.js`
2. Set `DRACO_DECODER_PATH = "/draco/"` in `src/lib/loadGltf.ts`.

These files are served statically from `/draco/` by Vite.
