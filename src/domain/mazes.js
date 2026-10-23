"use strict";
const { generateMaze, geometry, solution } = require("../../engine");
function cellAt(p, maze) {
  return (
    Math.min(maze.rows - 1, Math.floor(p.y * maze.rows)) * maze.cols +
    Math.min(maze.cols - 1, Math.floor(p.x * maze.cols))
  );
}
function metadata(maze) {
  const path = solution(maze);
  let turns = 0;
  for (let i = 2; i < path.length; i++)
    if (path[i] - path[i - 1] !== path[i - 1] - path[i - 2]) turns++;
  const deadEnds = maze.cells.filter(
    (c) => c.walls.filter(Boolean).length === 3,
  ).length;
  return {
    length: (path.length - 1) / maze.cols,
    turns,
    deadEnds,
    cells: path.length,
  };
}
function distances(maze) {
  const values = Array(maze.cells.length).fill(Infinity),
    queue = [maze.cells.length - 1];
  values[queue[0]] = 0;
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    maze.cells[i].walls.forEach((wall, d) => {
      const next = i + [-maze.cols, 1, maze.cols, -1][d];
      if (!wall && values[next] === Infinity) {
        values[next] = values[i] + 1;
        queue.push(next);
      }
    });
  }
  return values;
}
function describe(level, seed) {
  const maze = generateMaze(level, level, seed),
    path = solution(maze);
  const checkpoints = Array.from(
    { length: 5 },
    (_, i) => path[Math.round(((i + 1) * (path.length - 1)) / 6)],
  );
  return {
    maze,
    walls: geometry(maze),
    path,
    checkpoints,
    metadata: metadata(maze),
    distances: distances(maze),
    seed,
  };
}
// Generated offline by scripts/select-mazes.js; runtime never searches candidates.
const SETS = require("./maze-sets.json");
function setFor(level) {
  return SETS[String(level)];
}
module.exports = { cellAt, metadata, distances, describe, setFor };
