import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

type HoleState = "empty" | "john" | "nyx";
/*
type GameStateClient = {
  holes: HoleState[][];
  score: number;
  speedMs: number;
  statusMessage: string | null;
  totalWhacks: number;
  state: "paused" | "playing" | "lost";
};*/

const NUM_ROWS = 3;
const NUM_COLS = 3;
const START_SPEED_MS = 2000;
const MIN_SPEED_MS = 600;
const JOHN_CHANCE = 0.9; // chance of John appearing vs Nyx

type Game = {
  holes: HoleState[][];
  players: string[]; // player ids
  state: "paused" | "playing" | "over";
  speedMs: number;
  lastPopTime: number | null;
  statusMessage: string | null; // msg for all players in game
  gameType: "solo" | "multiplayer";
};

type Player = {
  id: string;
  name: string;
  score: number;
  statusMessage: string | null; // msg for just this player
  totalWhacks: number;
  playerState: "notReady" | "playing" | "ready" | "lost" | "won";
};

const games = new Map<string, Game>();
const players = new Map<string, Player>();

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`listening on *:${port}`);
});

const newGame = (gameType: "solo" | "multiplayer"): Game => {
  return {
    holes: Array(NUM_ROWS).fill("empty").map(() => Array(NUM_COLS).fill("empty")),  
    players: [],
    state: "paused",
    speedMs: START_SPEED_MS,
    lastPopTime: null,
    statusMessage: null,
    gameType: gameType,
  };
};

const handleWhack = (
  room: string,
  playerId: string,
  data: { row: number; col: number }
) => {
  const game = games.get(room);
  const player = players.get(playerId);
  const { row, col } = data;
  if (game.holes[row][col] === "john") {
    player.score += 1;
    player.statusMessage = "You whacked John!";
    if (game.gameType === "multiplayer") {
      game.statusMessage = `${player.name} whacked John!`;
    }
    if (game.speedMs > MIN_SPEED_MS) {
      game.speedMs -= 50;
    }
  } else if (game.holes[row][col] === "nyx") {
    game.state = "over";
    player.playerState = "lost";
    player.statusMessage = "You monster...you whacked Nyx! YOU LOSE!";
    if (game.gameType === "multiplayer") {
      game.statusMessage = `${player.name} whacked Nyx! THEY'RE OUT!`;
    }
  } else {
    player.statusMessage = "You missed!";
    player.score -= 1;
  }
};

const advanceGame = (game: Game) => {
  if (game.state !== "playing") return;
  const now = Date.now();
  if (game.lastPopTime === null || now - game.lastPopTime > game.speedMs) {
    // pop a random hole
    const randRow = Math.floor(Math.random() * NUM_ROWS);
    const randCol = Math.floor(Math.random() * NUM_COLS);
    // if hole is empty, pop John or Nyx
    if (game.holes[randRow][randCol] === "empty") {
      const isJohn = Math.random() < JOHN_CHANCE;
      game.lastPopTime = now;
      game.holes.map((row, ri) => {
        row.map((col, ci) => {
          game.holes[ri][ci] = "empty";
          if (ri === randRow && ci === randCol) {
            game.holes[ri][ci] = isJohn ? "john" : "nyx";
          }
        });
      });
    } // if hole is not empty, do nothing, it will pop again next tick
  }
};

// runs each tick to update game status
const updateGameStatus = (game: Game) => {
  // check if all players are ready and start game if not already started
  const allPlayersReady = game.players.every((p) => {
    const player = players.get(p);
    return player.playerState === "ready";
  });
  if (allPlayersReady && game.state !== "playing") {
    game.state = "playing";
    game.players.forEach((p) => {
      const player = players.get(p);
      player.playerState = "playing";
    });
    return;
  }

  // check end game conditions
  if (game.state === "playing") {
    // check if all players are out
    const allPlayersLost = game.players.every((p) => {
      const player = players.get(p);
      return player.playerState === "lost";
    });
    if (allPlayersLost) {
      game.state = "over";
      game.statusMessage = "All players are out! Game over!";
    }

    // if any player has negative score, they lose
    game.players.forEach((p) => {
      const player = players.get(p);
      if (player.score >= 0 || player.playerState !== "playing") return;
      player.playerState = "lost";
      player.statusMessage = "You have a negative score! YOU LOSE!";
    });

    // if multiplayer, check if only one player left
    if (game.gameType === "multiplayer") {
      const playersStillIn = game.players.filter((p) => {
        const player = players.get(p);
        return player.playerState !== "lost";
      });
      if (playersStillIn.length === 1) {
        game.state = "over";
        const player = players.get(playersStillIn[0]);
        player.playerState = "won";
        game.statusMessage = `${player.name} is the last one standing!`;
      }
    }
  }
};

// handle socket connections + messages
io.on("connection", (socket) => {
  console.log("a user connected: ", socket.id);
  // add to our players list if not already there
  if (!players.has(socket.id)) {
    players.set(socket.id, {
      id: socket.id,
      name: "Anonymous",
      score: 0,
      statusMessage: null,
      totalWhacks: 0,
      playerState: "notReady",
    });
  }
  io.emit("count", players.size);
  console.log("players: ", players.size);

  // Joining a room:
  socket.on(
    "joinRoom",
    ({
      name,
      room,
      gameType,
    }: {
      name: string;
      room: string | null;
      gameType: "solo" | "multiplayer";
    }) => {
      if (!room) {
        room = socket.id;
      }
      socket.join(room);
      console.log("joinRoom", name, room, gameType);
      const player = players.get(socket.id);
      player.name = name;
      if (!games.has(room)) {
        games.set(room, newGame(gameType));
      }
      const game = games.get(room);
      if (player.id && game && !game.players.includes(player.id)) {
        game.players.push(player.id);
      }
      // send initial game state to client
      io.to(room).emit("gameState", game);
      // send initial player state to client
      io.to(socket.id).emit("playerState", player);
    }
  );

  // ready up for multiplayer
  socket.on("ready", () => {
    console.log("ready");
    const player = players.get(socket.id);
    if (player) {
      player.playerState = "ready";
    }
  });

  // need to remove player from game if they leave
  socket.on("disconnect", () => {
    console.log("user disconnected");
    // remove from our players list
    players.delete(socket.id);
    // remove from any games
    for (const [id, game] of games.entries()) {
      if (game.players.includes(socket.id)) {
        game.players = game.players.filter((p) => p !== socket.id);
      }
    }
    io.emit("count", players.size);
  });

  // handle incoming whacks from clients
  socket.on("whack", (data) => {
    // get room this socket is in
    const room = Array.from(socket.rooms).pop();
    const game = games.get(room);
    if (game && game.state === "playing") {
      handleWhack(room, socket.id, data);
      const player = players.get(socket.id);
      io.to(socket.id).emit("playerState", player);
    }
  });
});

// update game state for all games
setInterval(() => {
  for (const [id, game] of games.entries()) {
    // remove game if no players left
    if (game.players.length === 0) {
      games.delete(id);
      continue;
    }
    // checks for end game conditions, etc, start game if all players ready
    updateGameStatus(game);
    advanceGame(game);
    io.to(id).emit("gameState", game);
    io.to(id).emit("playerList", game.players.map((p) => players.get(p)));
    for (const p in game.players) {
      const player = players.get(p);
      io.to(p).emit("playerState", player);
    }
  }
  
}, 1000.0 / 10.0);
