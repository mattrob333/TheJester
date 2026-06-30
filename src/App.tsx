import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { Game } from "./game/Game";
import { DebugOverlay } from "./ui/DebugOverlay";
import { Hud } from "./ui/Hud";

/**
 * App shell: a full-viewport <Canvas> with the HTML UI overlay layer on top.
 */
export default function App() {
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: [8, 6, 12], fov: 55, near: 0.1, far: 500 }}
        onCreated={({ gl }) => gl.setClearColor("#05060a")}
      >
        <Game />
      </Canvas>

      {/* HTML overlay layers (outside the canvas). */}
      <Hud />
      <DebugOverlay />
      <Leva collapsed={false} />
    </div>
  );
}
