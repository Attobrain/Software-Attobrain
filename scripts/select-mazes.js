"use strict";
const fs = require("node:fs");
const { generateMaze, solution } = require("../engine");
function meta(n, seed) {
  const m = generateMaze(n, n, seed),
    p = solution(m);
  let turns = 0;
  for (let i = 2; i < p.length; i++)
    if (p[i] - p[i - 1] !== p[i - 1] - p[i - 2]) turns++;
  return {
    seed,
    length: (p.length - 1) / n,
    turns,
    deadEnds: m.cells.filter((c) => c.walls.filter(Boolean).length === 3)
      .length,
  };
}
const sets = {};
for (const n of [7, 10]) {
  const base = meta(n, 42),
    selected = [base];
  for (let seed = 43; seed < 10000 && selected.length < 3; seed++) {
    const m = meta(n, seed);
    if (
      selected.every((other) =>
        ["length", "turns", "deadEnds"].every(
          (k) =>
            Math.abs(m[k] - other[k]) / Math.min(m[k], other[k]) <=
            (k === "deadEnds" ? 0.15 : 0.1),
        ),
      )
    )
      selected.push(m);
  }
  if (selected.length !== 3) throw Error("Nenhum conjunto encontrado");
  sets[n] = {
    id: `operational-${n}-v1`,
    version: 1,
    criteria: { length: 0.1, turns: 0.1, deadEnds: 0.15 },
    review:
      "Revisão geométrica automática; sem validação humana de dificuldade",
    candidates: selected,
  };
}
fs.writeFileSync(
  "src/domain/maze-sets.json",
  JSON.stringify(sets, null, 2) + "\n",
);
