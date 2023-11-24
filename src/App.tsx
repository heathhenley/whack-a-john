import { useEffect, useState } from "react";
import io from "socket.io-client";
import { Socket } from "socket.io-client";
import holeImg from "./assets/hole.png";
import johnImg from "./assets/john.png";
import nyxImg from "./assets/nyx.png";
import "./App.css";

type HoleState = "empty" | "john" | "nyx";

type GameState = {
  holes: HoleState[][];
  score: number;
  speedMs: number;
  statusMessage: string | null;
  totalWhacks: number;
  state: "playing" | "lost";
};

type PlayerState = {
  totalWhacks: number;
  statusMessage: string | null;
  playerState: "notReady" | "playing" | "ready" | "lost" | "won";
  score: number;
  name: string;
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
    //const sio = io("https://whack-a-john-production.up.railway.app");
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

  const joinSoloGame = () => {
    setPlaying(true);
    socket?.emit("joinRoom", {
      room: null,
      gameType: "solo",
      name: "Player 1",
    });
  };

  const joinMultiplayerGame = (e: any) => {
    e.preventDefault();
    const name = e.target[0].value;
    const room = e.target[1].value;
    setPlaying(true);
    socket?.emit("joinRoom", {
      room: room,
      gameType: "multiplayer",
      name: name,
    });
  }

  return (
    <div className="App">
      {playing ? (
        <Game socket={socket} />
      ) : (
        <StartScreen
          joinSoloGame={joinSoloGame}
          joinMultiplayerGame={joinMultiplayerGame}
        />
      )}
    </div>
  );
}

function StartScreen({
  joinSoloGame,
  joinMultiplayerGame,
}: {
  joinSoloGame: () => void;
  joinMultiplayerGame: (e: any) => void; // fix this any
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
          onClick={joinSoloGame}
        >
          Join Solo Game
        </button>
      </div>
      <div>
        <form onSubmit={joinMultiplayerGame}>
          <input type="text" placeholder="Your Name" />
          <input type="text" placeholder="Room Name" />
          <button
            style={{
              fontSize: 16,
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            Join Multiplayer Game
          </button>
        </form>
      </div>
    </section>
  );
}

function Game({ socket }: { socket: Socket | null }) {
  const [gameState, setGameState] = useState<GameState>();
  const [playerState, setPlayerState] = useState<PlayerState>();
  const [playerList, setPlayerList] = useState<PlayerState[]>();

  useEffect(() => {
    socket?.on("gameState", (gs: GameState) => {
      //console.log("Received game state", gs);
      setGameState(gs);
    });
    socket?.on("playerState", (ps: PlayerState) => {
      console.log("Received player state", ps);
      setPlayerState(ps);
    });

    socket?.on("playerList", (d) => {
      console.log("Received player list");
      console.log(d);
      setPlayerList(d);
    });

    return () => {
      socket?.off("gameState");
      socket?.off("playerState");
      socket?.off("playerList");
    };
  }, [socket]);

  const playerReady = () => {
    socket?.emit("ready");
  };

  const onClickHandler = (row: number, col: number) => {
    if (!gameState || gameState.state !== "playing") {
      return;
    }
    socket?.emit("whack", { row: row, col: col });
  };

  if (!gameState) {
    return <div> Loading... </div>;
  }
  if (!playerState) {
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
          Score: {playerState.score}
        </div>
        <div
          style={{
            paddingBottom: 16,
          }}
        >
          Total Whacks: {playerState.totalWhacks}, Johnny Pop Time:{" "}
          {gameState.speedMs} ms
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
      {gameState.statusMessage && (
        <div
          style={{
            fontSize: 18,
            fontWeight: "bold",
            textAlign: "center",
            padding: 24,
            height: 32,
          }}
        >
          Game Alert: {gameState.statusMessage}
        </div>
      )}
      {playerState.statusMessage && (
        <div
          style={{
            fontSize: 18,
            fontWeight: "bold",
            textAlign: "center",
            padding: 24,
            height: 32,
          }}
        >
          Player Alert: {playerState.statusMessage}
        </div>
      )}
      {playerState.playerState === "notReady" ? (
        <div
          style={{
            padding: 12,
          }}
        >
          <button
            style={{
              fontSize: 16,
              fontWeight: "bold",
              textAlign: "center",
            }}
            onClick={playerReady}
          >
            Ready?
          </button>
        </div>
      ) : null}
      {playerList && playerList.length > 0 ? (
        <div>
          <h2>Players</h2>
          {playerList.map((player) => (
            <div key={player.name}>
              {player.name}, {player.playerState}, {player.score}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default App;
