import { Game, Prediction, User } from "@btc-guessr/transport";
import { useEffect, useState } from "react";
import { ulid } from "ulidx";

function App() {
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem("userId");
  });
  useEffect(() => {
    if (userId) {
      return;
    }

    const newUserId = ulid();
    localStorage.setItem("userId", newUserId);
    setUserId(newUserId);
  }, [userId]);

  if (!userId) {
    return null;
  }

  return <div>works</div>;
}

export default App;

interface AppState {
  game: Game;
  users: User[] & { prediction: Prediction["prediction"] };
}

interface GameProps {
  initialGame: Game;
  initialUsers: User[] & { prediction: Prediction["prediction"] };
}

function Game({ initialGame, initialUsers }: GameProps) {
  const [appState, setAppState] = useState<AppState>({
    game: initialGame,
    users: initialUsers,
  });

  return <div>{appState.game.value}</div>;
}
