import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { useAppState } from "./game/systems/appState";
import { useGameState } from "./game/systems/gameState";
import { playerTracking } from "./game/player/playerTracking";

// Console debugging handle (also used by automated playtests):
//   __JESTER__.game.getState().health, __JESTER__.player.position, ...
declare global {
  interface Window {
    __JESTER__?: {
      app: typeof useAppState;
      game: typeof useGameState;
      player: typeof playerTracking;
    };
  }
}
window.__JESTER__ = { app: useAppState, game: useGameState, player: playerTracking };

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error('Root element "#root" not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
