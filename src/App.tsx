import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { Game } from "./game/Game";
import { DebugOverlay } from "./ui/DebugOverlay";
import { DamageFlash } from "./ui/DamageFlash";
import { Hud } from "./ui/Hud";
import { TitleScreen } from "./ui/TitleScreen";
import { LoadingScreen } from "./ui/LoadingScreen";
import { VictoryScreen } from "./ui/VictoryScreen";
import { DeathOverlay } from "./ui/DeathOverlay";
import { useAppState } from "./game/systems/appState";

/**
 * App shell: a full-viewport <Canvas> with the HTML UI overlay layers on top.
 *
 * The canvas mounts immediately (even behind the title screen) so shaders
 * compile and the physics world warms up while the player is reading the
 * menu — by the time they hit "enter the arena", the world is already hot.
 *
 * Dev tooling (leva panel, stats, debug overlay) is hidden by default and
 * toggled with the backquote (`) key.
 */
export default function App() {
  const devMode = useAppState((s) => s.devMode);
  const phase = useAppState((s) => s.phase);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Backquote") useAppState.getState().toggleDevMode();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
      {phase === "playing" && <DamageFlash />}
      {phase === "playing" && <DeathOverlay />}
      <TitleScreen />
      <LoadingScreen />
      <VictoryScreen />
      {devMode && <DebugOverlay />}
      <Leva collapsed hidden={!devMode} />
    </div>
  );
}
