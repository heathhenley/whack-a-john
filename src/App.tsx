import { useEffect, useState } from "react";
import io from "socket.io-client";
import { Socket } from "socket.io-client";
import holeImg from "./assets/hole.png";
import johnImg from "./assets/john.png";
import nyxImg from "./assets/nyx.png";
import "./App.css";

const NUM_ROWS = 3;
const NUM_COLS = 3;
const START_SPEED_MS = 2000;
const MIN_SPEED_MS = 600;
const JOHN_CHANCE = 0.9; // chance of John appearing vs Nyx

type HoleState = "empty" | "john" | "nyx";

type GameState = {
  holes: HoleState[][];
  score: number;
  speedMs: number;
  statusMessage: string | null;
  totalWhacks: number;
  state: "playing" | "lost";
};

const Hole = ({
  holeState,
  onClickHandler,
}: {
  holeState: HoleState;
  onClickHandler: () => void;
}) => {
  return (
    <div
      style={{
        backgroundImage: `url(${holeImg})`,
        width: 256,
        height: 164,
        paddingTop: 8,
      }}
      onClick={() => onClickHandler()}
    >
      {holeState === "empty" ? null : holeState === "john" ? (
        <div>
          <img src={johnImg} width={96} height={96} />
        </div>
      ) : holeState === "nyx" ? (
        <div>
          <img src={nyxImg} width={96} height={96} />
        </div>
      ) : null}
    </div>
  );
};

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playing, setPlaying] = useState<boolean>(false);

  useEffect(() => {
    const sio = io("http://localhost:3001");
    setSocket(sio);
    socket?.on("connect", () => {
      console.log("Connected to socket");
    });
    socket?.on("disconnect", () => {
      console.log("Disconnected from socket");
    });
    return () => {
      socket?.close();
    };
  }, [setSocket]);

  return (
    <div className="App">
      {playing ? (
        <Game socket={socket} />
      ) : (
        <StartScreen
          setPlaying={(b: boolean) => {
            setPlaying(b);
            socket?.emit("startGame", { reset: false });
          }}
        />
      )}
      {socket ? (
        <div> Connected to socket </div>
      ) : (
        <div> Not connected to socket </div>
      )}
    </div>
  );
}

function StartScreen({
  setPlaying,
}: {
  setPlaying: (playing: boolean) => void;
}) {
  return (
    <section
      style={{
        width: "400px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        margin: "auto",
        textAlign: "left",
        gap: 16,
      }}
    >
      <h1>Whack-a-John</h1>
      <h2>How to Play</h2>
      <div>
        Click on the holes to whack John. You get a point for every John you
        whack. But you lose a point if you miss! The game will get faster as it
        goes on. If you click on a hole with Nix, you lose!
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: "bold",
          textAlign: "center",
          padding: 24,
        }}
      >
        Ready to play?
      </div>
      <div>
        <button
          style={{
            fontSize: 16,
            fontWeight: "bold",
            textAlign: "center",
          }}
          onClick={() => setPlaying(true)}
        >
          Start
        </button>
      </div>
    </section>
  );
}

function Game({ socket }: { socket: Socket | null }) {
  const [gameState, setGameState] = useState<GameState>();

  useEffect(() => {
    socket?.on("gameState", (gs: GameState) => {
      console.log("Received game state", gs);
      setGameState(gs);
    });
  }, [socket]);

  const onClickHandler = (row: number, col: number) => {
    if (!gameState || gameState.state !== "playing") {
      return;
    }
    socket?.emit("whack", { row: row, col: col });
  };

  if (!gameState) {
    return <div> Loading... </div>;
  }

  return (
    <div>
      <div>
        <div
          style={{
            fontSize: 32,
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          Score: {gameState.score}
        </div>
        <div
          style={{
            paddingBottom: 16,
          }}
        >
          Total Whacks: {gameState.totalWhacks}, JR Pop Time: {gameState.speedMs} ms
        </div>
        {gameState.holes.map((row, ridx) => (
          <div key={`row${ridx}`} style={{ display: "flex" }}>
            {row.map((holeState, cidx) => (
              <Hole
                key={`hole${ridx}${cidx}`}
                holeState={holeState}
                onClickHandler={() => {
                  onClickHandler(ridx, cidx);
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: "bold",
          textAlign: "center",
          padding: 24,
          height: 32,
        }}
      >
        {gameState.statusMessage && gameState.statusMessage}
      </div>
      {gameState.state === "lost" && (
        <div>
          <button
            style={{
              fontSize: 16,
              fontWeight: "bold",
              textAlign: "center",
            }}
            onClick={() => {
              socket?.emit("startGame", { reset: true });
            }}
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
