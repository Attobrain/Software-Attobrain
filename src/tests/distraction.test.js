"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict");

const episode = (n, start, duration, extra = {}) => ({
  id: `r:episode:${n}`, start, end: start + (duration ?? 3000), sessionTime: 1000 + start, sessionEnd: 1000 + start + (duration ?? 3000),
  duration, censored: duration == null, reason: duration == null ? "pending" : "recovered", ...extra,
});
const result = {
  activeMs: 60000,
  collisionEpisodeCount: 3,
  collisionEpisodes: [episode(1, 5000, 1500), episode(2, 20000, 4000), episode(3, 50000, null)],
  low: [{ start: 30000, end: 34000, duration: 4000, sessionStart: 31000, sessionEnd: 35000 }],
  lowMs: 4000,
  recovery: { median: 2750, valid: 2, censored: 1 },
  backtracks: [{ start: 1, end: 2, distance: 0.1 }],
};

test("resumo usa o vocabulário de distração a partir de medidas já existentes", async () => {
  const { summarize } = await import("../../public/modules/distraction.js");
  const s = summarize(result);
  assert.equal(s.distractions, 3);
  assert.equal(s.stops, 1);
  assert.equal(s.stopSeconds, 4);
  assert.equal(s.recovery, 2.75);
  assert.equal(s.returns, 1);
  assert.equal(s.perMinute, 3);
  assert.equal(s.rhythm, null);
  assert.equal(summarize(null), null);
  assert.equal(summarize({ activeMs: 0 }).distractions, null);
});

test("evolução de A para C: texto direto, sem julgar, e 10% conta como estável", async () => {
  const { trendOf, trendText, indicators } = await import("../../public/modules/distraction.js");
  const count = indicators.find((i) => i.key === "distractions");
  const down = trendOf([{ label: "A", value: 5 }, { label: "B", value: 4 }, { label: "C", value: 3 }]);
  assert.equal(down.sign, "down");
  assert.equal(trendText(down, count), "2 distrações a menos em C do que em A (de 5 para 3).");
  const up = trendOf([{ label: "A", value: 1 }, { label: "C", value: 2 }]);
  assert.equal(up.sign, "up");
  assert.equal(trendText(up, count), "1 distração a mais em C do que em A (de 1 para 2).");
  const same = trendOf([{ label: "A", value: 3 }, { label: "B", value: 9 }, { label: "C", value: 3 }]);
  assert.equal(same.sign, "same");
  assert.equal(trendText(same, count), "Igual em A e C (3).");
  assert.equal(trendOf([{ label: "A", value: 3 }, { label: "B", value: null }]), null);
  assert.equal(trendOf([{ label: "A", value: 0 }, { label: "C", value: 0 }]).sign, "same");
  for (const t of [down, up, same]) assert(!/melhor|pior|melhorou|piorou|TDAH|diagn/i.test(trendText(t, count)));
});

test("tempo para retomar só entra na evolução com três retomadas completas", async () => {
  const { indicators } = await import("../../public/modules/distraction.js");
  const recovery = indicators.find((i) => i.key === "recovery");
  assert.equal(recovery.value({ recovery: 1.5, recoveries: 2 }), null);
  assert.equal(recovery.value({ recovery: 1.5, recoveries: 3 }), 1.5);
});

test("momentos de maior distração vêm do mais longo para o mais curto", async () => {
  const { moments } = await import("../../public/modules/distraction.js");
  const list = moments(result, "B");
  assert.equal(list.length, 4);
  assert(list.every((m, i) => i === 0 || list[i - 1].length >= m.length));
  assert.equal(list[0].kind, "distraction");
  assert(list.some((m) => m.kind === "stop" && m.text === "Ficou parado por 4 s" && m.sessionTime === 31000));
  assert(list.some((m) => m.text === "Encostou na parede e não retomou o caminho"));
  assert(list.some((m) => m.text === "Encostou na parede e retomou em 1,5 s"));
  assert.deepEqual(moments(null), []);
});

test("linha do tempo posiciona distrações e paradas em porcentagem", async () => {
  const { timelineMarks, timelineHtml } = await import("../../public/modules/distraction.js");
  const marks = timelineMarks(result, 100000);
  assert.equal(marks.filter((m) => m.lane === 0).length, 3);
  assert.deepEqual(marks.find((m) => m.lane === 1), { lane: 1, from: 30, to: 34, at: 30000 });
  assert.deepEqual(timelineMarks(result, 0), []);
  assert(timelineMarks(result, 10000).every((m) => m.from <= 100 && m.to <= 100));
  const html = timelineHtml(result, 60000, 120000);
  assert.equal((html.match(/dt-hit/g) ?? []).length, 3);
  assert.equal((html.match(/dt-stop/g) ?? []).length, 1);
  assert(html.includes("Distrações") && html.includes("Parado") && html.includes("02:00"));
});

test("situação agora: concentrado, distraído (encostou sem retomar ou parado) e estados sem atividade", async () => {
  const { liveStatus } = await import("../../public/modules/distraction.js");
  const moving = Array.from({ length: 60 }, (_, i) => ({ x: 0.1 + i * 0.002, y: 0.1, t: i * 50, segment: 0 }));
  const still = Array.from({ length: 30 }, (_, i) => ({ x: 0.5, y: 0.5, t: i * 50, segment: 0 }));
  const running = { state: "RUNNING", config: { lowSeconds: 2, lowSpeed: 0.005 }, metrics: { collisionEpisodes: [] } };
  assert.equal(liveStatus(running, moving).title, "Concentrado");
  assert.equal(liveStatus(running, still).title, "Concentrado", "menos de 2 s de registro ainda não indica parada");
  const longStill = Array.from({ length: 100 }, (_, i) => ({ x: 0.5, y: 0.5, t: i * 50, segment: 0 }));
  const stopped = liveStatus(running, longStill);
  assert.equal(stopped.title, "Distraído agora");
  assert.equal(stopped.tone, "alert");
  const touching = { ...running, metrics: { collisionEpisodes: [episode(1, 1000, null)] } };
  assert.equal(liveStatus(touching, moving).title, "Distraído agora");
  const recovered = { ...running, metrics: { collisionEpisodes: [episode(1, 1000, 1200)] } };
  assert.equal(liveStatus(recovered, moving).title, "Concentrado");
  const split = longStill.map((p, i) => ({ ...p, segment: i < 75 ? 0 : 1 }));
  assert.equal(liveStatus(running, split).title, "Concentrado", "pausa entre trechos não conta como parada");
  assert.equal(liveStatus({ state: "PAUSED" }).title, "Pausado");
  assert.equal(liveStatus({ state: "READY" }).title, "Aguardando");
  assert.equal(liveStatus({ state: "COMPLETED" }).title, "Finalizada");
  assert.equal(liveStatus(null).tone, "idle");
});

test("eventos recentes falam de distração e ficam do mais novo para o mais antigo", async () => {
  const { recentItems } = await import("../../public/modules/distraction.js");
  const events = [
    { seq: 1, type: "started", runId: "r", sessionTime: 0 },
    { seq: 2, type: "contact", runId: "r", sessionTime: 6000 },
    { seq: 3, type: "pause", runId: "r", sessionTime: 40000, data: { reason: "manual" } },
    { seq: 4, type: "started", runId: "outra", sessionTime: 50000 },
  ];
  const list = recentItems(events, result, "r", 20);
  const titles = list.map((e) => e.title);
  assert(titles.includes("Encostou na parede"));
  assert(titles.includes("Retomou o caminho"));
  assert(titles.includes("Ficou parado 4 s"));
  assert(titles.includes("Atividade pausada"));
  assert.equal(list.filter((e) => e.title === "Atividade iniciada").length, 1, "só eventos da atividade atual");
  assert(!titles.includes("Ponto do caminho alcançado"));
  assert(list.every((e, i) => i === 0 || list[i - 1].time >= e.time));
  assert.equal(list.find((e) => e.title === "Atividade pausada").detail, "Pausa solicitada");
  assert.equal(recentItems([], null, "r").length, 0);
  assert.equal(recentItems(events, result, "r", 2).length, 2);
});

test("termos técnicos da análise passam para o vocabulário de distração", async () => {
  const { reword } = await import("../../public/modules/distraction.js");
  assert.equal(reword("A: 3 episódio(s) de contato, incluindo os encerrados sem recuperação observada."), "A: 3 distração(ões), incluindo as que não tiveram retomada observada.");
  assert.equal(reword("Densidade de episódios diminuiu progressivamente entre A, B e C."), "Distrações por trecho diminuiu progressivamente entre A, B e C.");
  assert.equal(reword("Tempo de baixa movimentação"), "Momentos parado");
  assert.equal(reword("Eficiência da rota no grafo"), "Caminho direto");
  assert.equal(reword("episódios"), "distrações");
  assert.equal(reword("60% do tempo de baixa movimentação"), "60% do tempo parado");
  assert.equal(reword("mediana de 3.80 s"), "mediana de 3.80 s");
  assert.equal(reword("mediana de 3.80 s", true), "mediana de 3,80 s");
  assert.equal(reword(null), "");
});

test("resultado: cartões por atividade, evolução, momentos e atalho para o percurso", async () => {
  const { interpretationView } = await import("../../public/modules/interpretation-view.js");
  const run = (label, count, state = "COMPLETED") => ({
    runId: label, label, state,
    result: { ...result, collisionEpisodeCount: count, collisionEpisodes: Array.from({ length: count }, (_, i) => episode(i + 1, 4000 + i * 7000, 1500)) },
  });
  const analysis = { schemaVersion: "attobrain-interpretation-2.0", quality: { status: "sufficient", comparable: true, completed: 3, performed: 3, expected: 3 }, features: [], dimensions: [], observations: [], summary: [], reviewPoints: [] };
  const html = interpretationView({ analysis, evaluations: [run("A", 5), run("B", 4), run("C", 3)], single: [] }, { name: "Aluno" }, "id");
  assert(html.includes("Atividade A") && html.includes("Atividade C"));
  assert(html.includes("2 distrações a menos em C do que em A (de 5 para 3)."));
  assert(html.includes("Diminuiu"));
  assert(html.includes('data-evidence="'), "atalho para o percurso");
  assert(html.includes("Momentos de maior distração"));
  assert(!/colis|encostes na parede/i.test(html.replace(/Encostou na parede/g, "")), "sem vocabulário antigo");
  const noTrend = interpretationView({ analysis, evaluations: [run("A", 5), run("B", 4, "TIMED_OUT"), run("C", 3, "ABORTED")], single: [] }, { name: "Aluno" }, "id");
  assert(noTrend.includes("A evolução aparece quando duas ou mais atividades forem concluídas."));
  const incomparable = interpretationView({ analysis: { ...analysis, quality: { ...analysis.quality, comparable: false }, comparability: { reasons: ["Labirintos diferentes."] } }, evaluations: [run("A", 5), run("C", 3)], single: [] }, { name: "Aluno" }, "id");
  assert(incomparable.includes("Labirintos diferentes."));
  assert(!incomparable.includes("a menos em C"));
});
