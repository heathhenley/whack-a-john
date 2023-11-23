import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

/*type HoleState = "empty" | "john" | "nyx";

type GameState = {
  holes: HoleState[][];
  score: number;
  speedMs: number;
  statusMessage: string | null;
  totalWhacks: number;
  state: "paused" | "playing" | "lost";
};

type Games = Map<string, GameState>;
*/

const NUM_ROWS = 3;
const NUM_COLS = 3;
const START_SPEED_MS = 2000;
const MIN_SPEED_MS = 600;
const JOHN_CHANCE = 0.9; // chance of John appearing vs Nyx

const games = new Map();

app.get('/', (req, res) => {
  res.send('<h1>Hello world</h1>');
});

io.on('connection', (socket) => {
  console.log('a user connected');
  games.set(socket.id, {
    holes: Array(NUM_ROWS).fill(Array(NUM_COLS).fill("empty")),
    score: 0,
    speedMs: START_SPEED_MS,
    statusMessage: null,
    totalWhacks: 0,
    state: "paused",
    lastPopTime: null,
  });

  socket.on("startGame", ({reset}) => {
    const game = games.get(socket.id);
    if (game) {
      if (reset) {
        games.set(socket.id, {
          ...game,
          state: "playing",
          score: 0,
          speedMs: START_SPEED_MS,
          statusMessage: null,
          totalWhacks: 0,
          holes: Array(NUM_ROWS).fill(Array(NUM_COLS).fill("empty")),
        });
      } else {
        games.set(socket.id, {
          ...game,
          state: "playing",
          statusMessage: null,
        });
      }
      socket.emit("gameState", game);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('whack', (data) => {
    console.log(socket.id, data);
    const game = games.get(socket.id);
    if (game && game.state === "playing") {
      const { row, col } = data;
      if (game.holes[row][col] === "john") {
        game.score += 1;
        game.statusMessage = "Nice whack!";
        if (game.speedMs > MIN_SPEED_MS) {
          game.speedMs -= 50;
        }
      } else if (game.holes[row][col] === "nyx") {
        game.statusMessage = "You monster...you whacked Nyx! GAME OVER!";
        game.state = "lost";
      } else {
        game.statusMessage = "You missed!";
        game.score -= 1;
      }
      game.holes[row][col] = "empty";
      game.totalWhacks += 1;
      socket.emit("gameState", game);
    }
  });
});

server.listen(3001, () => {
  console.log('server running at http://localhost:3001');
});

// update game state for all games
setInterval(() => {
  for (const [id, game] of games.entries()) {
    if (game.state === "playing") {
      if (game.lastPopTime === null) {
        game.lastPopTime = Date.now();
      }
      if (Date.now() - game.lastPopTime > game.speedMs) {
        game.lastPopTime = Date.now();
        const randomRow = Math.floor(Math.random() * NUM_ROWS);
        const randomCol = Math.floor(Math.random() * NUM_COLS);
        // set new one and clear old ones
        game.holes = game.holes.map((row, i) => {
          return row.map((hole, j) => {
            if (i === randomRow && j === randomCol) {
              return Math.random() < JOHN_CHANCE ? "john" : "nyx";
            }
            return "empty";
          });
        })
        io.to(id).emit("gameState", game);
      }
    }
  }
}, 1000.0 / 30.0);