import { GameStateProvider } from "./game/GameStateProvider";
import { GameView } from "./game/GameView";
import { getUserId } from "./lib/amplify";

function App() {
  return (
    <GameStateProvider userId={getUserId()}>
      <GameView currentUserId={getUserId()} />
    </GameStateProvider>
  );
}

export default App;
