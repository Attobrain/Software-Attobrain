"use strict";
const POLICY = Object.freeze({ version: "engineering-1.0", efficiencyPoints: 5, relative: .1, patternRelative: .2 });
const LIMIT = "Descrição desta sessão; não identifica causa, atenção ou condição clínica.";
function observations(features, runs, comparable) {
  const output = [];
  function emit(ruleId, title, statement, items, criteria) {
    output.push({ id: `${ruleId}:${items.map(v => v.runId).join(":")}`, ruleId, ruleVersion: "1.0", title, statement, support: "sufficient", criteria, evidence: items, limitations: [LIMIT] });
  }
  function evidence(f, key) {
    const run = runs.find(r => r.id === f.runId);
    const contacts = key === "contacts" ? run.events.filter(e => e.type === "contact") : [];
    return { runId: f.runId, label: f.label, metric: key, ...f.metrics[key], eventSeqs: contacts.map(e => e.seq), sessionTime: contacts[0]?.sessionTime ?? run.startedAt ?? run.endedAt ?? 0, interval: [run.startedAt, run.endedAt] };
  }
  for (const f of features) {
    emit("observed-contacts", "Controle do percurso", `${f.label}: ${f.metrics.contacts.value} episódio(s) de contato com paredes registrados.`, [evidence(f, "contacts")], "Contagem de episódios distintos; contato contínuo não é contado repetidamente.");
  }
  const eligible = features.filter(f => ["A", "B", "C"].includes(f.label) && f.state === "COMPLETED" && f.seconds >= 30 && f.quality.coverage !== null && f.quality.coverage >= .8 - 1e-8);
  if (comparable) for (const [key, name] of [["contacts", "Contatos"], ["efficiency", "Eficiência do percurso no grafo"], ["speed", "Velocidade média"], ["cv", "Variabilidade da execução"], ["recovery", "Recuperação após contatos"], ["low", "Baixa movimentação"]]) {
    const fs = eligible.filter(f => f.metrics[key].eligibility === "eligible");
    const tolerance = key === "efficiency" ? 5 : Math.max(0, ...fs.map(f => Math.abs(f.metrics[key].value))) * (["cv", "speed", "recovery", "low"].includes(key) ? .2 : .1);
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i], b = fs[j], av = a.metrics[key].value, bv = b.metrics[key].value;
      const precision = key === "speed" ? 4 : key === "contacts" ? 0 : 2;
      emit(`pair-${key}`, name, `${name}: ${av.toFixed(precision)} em ${a.label} e ${bv.toFixed(precision)} em ${b.label} (diferença ${Number((bv - av).toFixed(precision))} ${key === "efficiency" ? "pontos percentuais" : a.metrics[key].unit}).`, [evidence(a, key), evidence(b, key)], "Duas atividades concluídas e comparáveis; diferença absoluta descritiva.");
    }
    if (fs.length !== 3) continue;
    const values = fs.map(f => f.metrics[key].value), [a, b, c] = values;
    let direction = null;
    if (Math.max(...values) - Math.min(...values) <= tolerance) direction = "permaneceu semelhante";
    else if (a > b && b > c && a - c >= tolerance) direction = "diminuiu progressivamente";
    else if (a < b && b < c && c - a >= tolerance) direction = "aumentou progressivamente";
    else if ((b - a) * (c - b) < 0 && Math.min(Math.abs(b - a), Math.abs(c - b)) > tolerance) direction = "oscilou";
    if (direction) emit(`trend-${key}`, name, `${key === "contacts" ? "O número de contatos" : name} ${direction} entre A, B e C.`, fs.map(f => evidence(f, key)), `Três atividades elegíveis; tolerância operacional ${tolerance.toFixed(3)} ${fs[0].metrics[key].unit}; política ${POLICY.version}.`);
  }
  if (comparable && eligible.length === 3) {
    const [a, , c] = eligible;
    if (a.metrics.speed.eligibility === "eligible" && c.metrics.speed.eligibility === "eligible" && c.metrics.speed.value > a.metrics.speed.value * 1.2 && c.metrics.contacts.value > a.metrics.contacts.value * 1.2 && c.metrics.efficiency.value < a.metrics.efficiency.value - 5)
      emit("speed-control", "Ritmo e controle", "A velocidade aumentou de A para C, acompanhada de mais contatos e menor eficiência do percurso. Esses dados não definem uma melhora ou piora global.", [evidence(a, "speed"), evidence(c, "speed"), evidence(a, "contacts"), evidence(c, "contacts"), evidence(a, "efficiency"), evidence(c, "efficiency")], "Velocidade e contatos aumentam mais de 20%; eficiência diminui mais de 5 pontos percentuais.");
  }
  for (const f of features.filter(f => f.quality.temporalEligible)) {
    const run = runs.find(r => r.id === f.runId), m = run.result;
    const later = m.low.reduce((v, e) => v + Math.max(0, e.end - Math.max(e.start, run.active / 2)), 0);
    if (m.lowMs >= 2000 && later / m.lowMs >= .6)
      emit("low-second-half", "Continuidade da atividade", `${f.label}: os períodos de baixa movimentação ficaram concentrados na segunda metade.`, [{ ...evidence(f, "low"), secondHalfSeconds: later / 1000 }], "Pelo menos 45 s, 15 s válidos por terço, 2 s de baixa movimentação e 60% na segunda metade.");
    const [first, , last] = f.quality.thirdsCv;
    if (first > 0 && Number.isFinite(last) && last >= first * 1.2)
      emit("final-cv", "Regularidade da execução", `${f.label}: a velocidade do indicador apresentou maior variabilidade no terço final.`, [{ ...evidence(f, "cv"), firstThirdCv: first, lastThirdCv: last }], "Pelo menos 45 s e 15 s válidos por terço; CV suavizado final pelo menos 20% acima do inicial.");
  }
  return output;
}
module.exports = { observations, POLICY };
