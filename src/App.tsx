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
  const [connectedCount , setConnectedCount] = useState<number>(0);

  useEffect(() => {
    const sio = io("http://localhost:3001");
    //const sio = io("https://whack-a-john-production.up.railway.app");
    if (!sio) {
      return;
    }
    sio.on("connect", () => {
      console.log("Connected to socket");
    });
    sio.on("disconnect", () => {
      console.log("Disconnected from socket");
    });
    sio.on("count", (count: number) => {
      setConnectedCount(count);
      console.log("Connected count: ", count);
    });
    setSocket(sio);
    return () => {
      sio?.close();
    };
  }, []);

  const joinSoloGame = () => {
    setPlaying(true);
    socket?.emit("joinRoom", {
      room: null,
      gameType: "solo",
      name: "Player 1",
    });
  };

  const joinGame = (e: React.FormEvent<HTMLFormElement>) => {
    // TODO: handle form type stuff more correctly
    e.preventDefault();
    // @ts-ignore
    const gameType = e.target.gameType.value;
    if (gameType === "") {
      return;
    }
    // @ts-ignore
    if (e.target.gameType.value === "solo") {
      joinSoloGame();
      return;
    }
    setPlaying(true);
    socket?.emit("joinRoom", {
      // @ts-ignore
      room: e.target.roomName.value,
      gameType: "multiplayer",
      // @ts-ignore
      name: e.target.playerName.value,
    });
  };

  return (
    <div className="App">
      {playing ? (
        <Game socket={socket} />
      ) : (
        <StartScreen
          joinGame={joinGame}
        />
      )}
      <div>
        Total Connected: {connectedCount}
      </div>
    </div>
  );
}

function StartScreen({
  joinGame,
}: {
  joinGame: (e: any) => void;
}) {
  const [selectedGameType, setSelectedGameType] = useState<string>("solo");
  return (
    <section
      style={{
        width: "600px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "left",
        gap: 6,
      }}
    >
      <h1 style={{
        fontSize: 48,
        fontWeight: "bold",
        textAlign: "center",
        padding: 0,
        margin: 0,
      }}>Whack-a-John</h1>
      <div>
        <h2>Objective</h2>
        Click on the holes to whack John. Don't whack NYX!
        
        <h2>Rules</h2>
        The rules are simple:
        <ol>
          <li>Get one point for each time you Whack John</li>
          <li>Lose a point if you miss</li>
          <li>Don't whack NYX, you will lose!</li>
          <li>If you score is negative, you will lose!</li>
        </ol>
        Johnny is quite nimble, so he will move around the board. You will have to be quick to whack him! He also gets faster as the game goes on, so
        be careful!
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
        <form className="joinForm" onSubmit={(e) => joinGame(e)}>
          <select
            name="gameType"
            value={selectedGameType}
            onChange={(e) => {
              setSelectedGameType(e.target.value);
            }}
          >
            {["solo", "multiplayer"].map((g) => (
              <option value={g} key={g}>
                {g}
              </option>
            ))}
          </select>
          {selectedGameType === "multiplayer" ? (
            <div className="inputGroup">
              <input required name="playerName" type="text" placeholder="Your Name" />
              <input required name="roomName" type="text" placeholder="Room Name" />
            </div>
          ) : null}
          <button
            style={{
              fontSize: 16,
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            Join Game
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
      setGameState(gs);
    });
    socket?.on("playerState", (ps: PlayerState) => {
      setPlayerState(ps);
    });

    socket?.on("playerList", (d) => {
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
