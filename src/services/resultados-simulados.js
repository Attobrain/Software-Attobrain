"use strict";
// Gera as atividades A, B e C com dados teóricos aleatórios, só para demonstração.
// Cada atividade vira uma execução "concluída" com percurso, contatos e tempos,
// e passa pela mesma análise (finish) das execuções reais.
const PASSO_MS = 50;

const sorteio = (min, max) => min + Math.random() * (max - min);
const inteiro = (min, max) => Math.floor(sorteio(min, max + 1));

// Três tendências possíveis entre A, B e C: melhora, estável ou piora.
function colisoesPorFase() {
  const base = inteiro(2, 8);
  const tendencia = ["melhora", "estavel", "piora"][inteiro(0, 2)];
  const passo = tendencia === "melhora" ? -1 : tendencia === "piora" ? 1 : 0;
  return [0, 1, 2].map((i) => Math.max(0, base + passo * i * inteiro(1, 2) + inteiro(-1, 1)));
}

function centro(celula, maze) {
  return { x: ((celula % maze.cols) + 0.5) / maze.cols, y: (Math.floor(celula / maze.cols) + 0.5) / maze.rows };
}

// Posição ao longo do caminho correto, com `andamento` entre 0 e (cells - 1).
function posicaoNoCaminho(run, andamento) {
  const i = Math.min(run.path.length - 2, Math.floor(andamento));
  const a = centro(run.path[i], run.maze);
  const b = centro(run.path[i + 1], run.maze);
  const f = andamento - i;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

function preencherExecucao(session, run, segundos, colisoes) {
  const total = Math.round((segundos * 1000) / PASSO_MS);
  const ultimo = run.path.length - 1;
  // Ritmo irregular: alguns trechos mais rápidos, outros mais lentos.
  const pesos = Array.from({ length: total }, () => sorteio(0.4, 1.6));
  const soma = pesos.reduce((a, b) => a + b, 0);
  // Passos em que acontecem contatos com paredes, separados entre si.
  const contatos = new Map();
  for (let tentativa = 0; contatos.size < colisoes && tentativa < colisoes * 20; tentativa++) {
    const i = inteiro(20, total - 20);
    if ([...contatos.keys()].every((j) => Math.abs(i - j) > 40)) contatos.set(i, inteiro(1, 3));
  }
  // Desvios: o ponto volta alguns corredores e retoma, o que reduz o "caminho direto".
  const desvios = Array.from({ length: inteiro(0, 3) }, () => ({ centro: sorteio(0.15, 0.85), largura: sorteio(0.03, 0.07), fundo: inteiro(1, 3) }));
  const recuo = (fracao) => desvios.reduce((soma, d) => soma + d.fundo * Math.max(0, 1 - Math.abs(fracao - d.centro) / d.largura), 0);
  const inicio = session.time;
  let acumulado = 0;
  let anterior = centro(run.path[0], run.maze);
  let proximoPonto = 0;
  run.steps = [];
  run.trajectory = [];
  run.events = [];
  for (let i = 0; i < total; i++) {
    acumulado += pesos[i];
    const fracao = acumulado / soma;
    const andamento = i === total - 1 ? ultimo : Math.max(0, Math.min(ultimo, fracao * ultimo - recuo(fracao)));
    const posicao = i === total - 1 ? centro(run.path[ultimo], run.maze) : posicaoNoCaminho(run, andamento);
    const t = (i + 1) * PASSO_MS;
    const celulas = [];
    if (Math.floor(andamento) !== proximoPonto) {
      proximoPonto = Math.floor(andamento);
      celulas.push(run.path[proximoPonto]);
    }
    const duracaoContato = contatos.get(i);
    const hits = [];
    for (let k = 0; k < (duracaoContato ?? 0); k++) hits.push(inteiro(0, run.walls.length - 1));
    const passo = { ...posicao, from: anterior, dt: PASSO_MS, t, sessionTime: inicio + t, segment: 0, validInput: true, hits: [...new Set(hits)], cells: celulas };
    run.steps.push(passo);
    run.trajectory.push({ ...posicao, t, sessionTime: passo.sessionTime, segment: 0 });
    if (passo.hits.length)
      run.events.push({ schemaVersion: 2, sessionId: session.id, runId: run.id, seq: run.events.length + 1, source: "simulated", type: "contact", data: { walls: passo.hits, position: posicao }, sessionTime: passo.sessionTime, activeTime: t });
    anterior = posicao;
  }
  Object.assign(run, { active: total * PASSO_MS, progress: 100, checkpoint: run.checkpoints.length, startedAt: inicio, position: anterior, lastSeq: total });
  // O tempo da sessão avança o mesmo que a atividade simulada durou.
  session.origin -= total * PASSO_MS;
  session.time += total * PASSO_MS;
  run.sessionNow = session.time;
}

function simularResultados(session) {
  const colisoes = colisoesPorFase();
  session.event("results-simulated", { reason: "demonstration" });
  session.simulated = true;
  ["A", "B", "C"].forEach((rotulo, i) => {
    session.newRun(rotulo);
    session.current.state = "RUNNING";
    preencherExecucao(session, session.current, inteiro(45, 130), colisoes[i]);
    session.finish("COMPLETED");
    session.intervalUntil = session.time;
  });
}

module.exports = { simularResultados };
