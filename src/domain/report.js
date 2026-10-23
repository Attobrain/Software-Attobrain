"use strict";
const { statistics, quantile } = require("./metrics");
function consolidate(runs, config, setId) {
  const evaluations = ["A", "B", "C"].map((label) => {
    const r = runs.find((r) => r.label === label);
    return r
      ? { label, runId: r.id, state: r.state, result: r.result ?? null }
      : { label, state: "NOT_PERFORMED", result: null };
  });
  const eligible = evaluations.filter(
    (r) => r.state === "COMPLETED" && r.result,
  );
  const rules = [];
  const emit = (
    ruleId,
    text,
    metrics,
    values,
    runIds = eligible.map((r) => r.runId),
  ) => rules.push({ ruleId, version: 1, text, metrics, values, runIds });
  if (config.mode === "protocol" && setId && eligible.length === 3) {
    const contacts = eligible.map((r) => r.result.contactsPerMinute),
      efficiency = eligible.map((r) => r.result.efficiency);
    if (
      contacts.every(Number.isFinite) &&
      contacts[0] > contacts[1] &&
      contacts[1] > contacts[2] &&
      contacts[2] <= contacts[0] * 0.9
    )
      emit(
        "contacts-down",
        "Redução progressiva dos contatos por minuto",
        ["contactsPerMinute"],
        contacts,
      );
    if (
      efficiency.every(Number.isFinite) &&
      efficiency[0] < efficiency[1] &&
      efficiency[1] < efficiency[2] &&
      efficiency[2] - efficiency[0] >= 5
    )
      emit(
        "efficiency-up",
        "Aumento da eficiência entre as atividades",
        ["efficiency"],
        efficiency,
      );
    for (const [name, values, tolerance] of [
      ["efficiency", efficiency, 5],
      ["contactsPerMinute", contacts, 0.1 * (quantile(contacts, 0.5) ?? 0)],
    ]) {
      if (!values.every(Number.isFinite)) continue;
      if (Math.max(...values) - Math.min(...values) <= tolerance)
        emit(
          `${name}-similar`,
          "Valores semelhantes entre atividades",
          [name],
          values,
        );
      else if (
        (values[1] - values[0]) * (values[2] - values[1]) < 0 &&
        Math.min(
          Math.abs(values[1] - values[0]),
          Math.abs(values[2] - values[1]),
        ) > tolerance
      )
        emit(
          `${name}-oscillation`,
          "Oscilação entre atividades",
          [name],
          values,
        );
    }
  }
  for (const r of runs.filter((r) => r.label !== "Treinamento" && r.result)) {
    const m = r.result,
      a = m.thirds[0],
      c = m.thirds[2];
    if (a.eligible && c.eligible && a.cv > 0 && c.cv >= 1.2 * a.cv)
      emit(
        "final-cv",
        "Maior variabilidade no trecho final",
        ["thirds.cv"],
        [a.cv, c.cv],
        [r.id],
      );
    const later = m.low.reduce(
      (v, e) => v + Math.max(0, e.end - Math.max(e.start, m.activeMs / 2)),
      0,
    );
    if (m.lowMs >= 2000 && later / m.lowMs >= 0.6)
      emit(
        "low-second-half",
        "Baixa movimentação concentrada na segunda metade",
        ["lowMs", "secondHalfLowMs"],
        [m.lowMs, later],
        [r.id],
      );
  }
  const aggregates = {};
  for (const key of ["efficiency", "contactsPerMinute", "speed"]) {
    const values = eligible.map((r) => r.result[key]).filter(Number.isFinite);
    aggregates[key] = {
      count: values.length,
      median: quantile(values, 0.5),
      range: values.length ? Math.max(...values) - Math.min(...values) : null,
      ...statistics(values),
    };
  }
  const pairs = [];
  for (let i = 0; i < eligible.length; i++)
    for (let j = i + 1; j < eligible.length; j++)
      pairs.push({
        from: eligible[i].label,
        to: eligible[j].label,
        efficiencyDifference:
          eligible[j].result.efficiency - eligible[i].result.efficiency,
        contactsPerMinuteDifference:
          eligible[j].result.contactsPerMinute -
          eligible[i].result.contactsPerMinute,
      });
  return {
    version: 2,
    evaluations,
    rules,
    aggregates,
    pairs: config.mode === "protocol" ? pairs : [],
    comparable: config.mode === "protocol" && eligible.length === 3 && !!setId,
    description:
      eligible.length === 3
        ? "Comparação geométrica operacional; sem conclusão clínica."
        : "Dados insuficientes para tendência A/B/C. Atividades ausentes ou incompletas são identificadas.",
    training: runs
      .filter((r) => r.label === "Treinamento")
      .map((r) => ({ runId: r.id, state: r.state, result: r.result })),
    single: runs
      .filter((r) => r.label === "Exploração")
      .map((r) => ({ runId: r.id, state: r.state, result: r.result })),
  };
}
module.exports = { consolidate };
