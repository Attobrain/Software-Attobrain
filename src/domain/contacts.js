"use strict";
const { cellAt } = require("./mazes");
const CONTACT_POLICY = Object.freeze({ version: "contacts-3.0", separationMs: 200, recoveryMs: 500, advance: .01 });
// A wall is recorded again only after a full interval without touching it.
function freshWalls(hits, last, time) {
  const unique = [...new Set(hits)];
  const fresh = unique.filter(wall => !last.has(wall) || time - last.get(wall) >= CONTACT_POLICY.separationMs - 1e-6);
  for (const wall of unique) last.set(wall, time);
  return fresh;
}
function contactAnalysis(run) {
  const contacts = [], episodes = [], collisions = [], seen = new Set();
  const byTime = new Map();
  const recorded = (run.events ?? []).filter(e => e.type === "contact");
  for (const event of recorded) {
    const key = `${run.id}:${event.seq}`;
    if (seen.has(key)) continue;
    seen.add(key); collisions.push(event);
    const timeKey = Number(event.activeTime).toFixed(5);
    byTime.set(timeKey, [...(byTime.get(timeKey) ?? []), event]);
  }
  let last = new Map(), segment = null, episode = null, previous = null;
  const close = (reason, step, recovered = false) => {
    if (!episode) return;
    episode.end = step?.t ?? run.active;
    episode.sessionEnd = step?.sessionTime ?? run.endedAt ?? run.sessionNow ?? null;
    episode.endPosition = step ? { x: step.x, y: step.y } : episode.position;
    episode.duration = recovered ? episode.end - episode.start : null;
    episode.censored = !recovered; episode.reason = reason;
    episodes.push(episode); episode = null;
  };
  for (const step of run.steps ?? []) {
    if (step.segment !== segment || step.validInput === false) {
      close(step.validInput === false ? "input-gap" : "interruption", previous);
      last = new Map(); segment = step.segment;
    }
    if (step.validInput === false) { previous=step; continue; }
    const hits = step.hits ?? [], cell = cellAt(step, run.maze);
    const fresh = freshWalls(hits, last, step.t);
    for (const wall of fresh) contacts.push({ wall, t: step.t, sessionTime: step.sessionTime, position: { x: step.x, y: step.y }, cell });
    if (hits.length) {
      if (!episode) episode = {
        id: `${run.id}:episode:${episodes.length + 1}`, start: step.t, sessionTime: step.sessionTime,
        position: { x: step.x, y: step.y }, cell, remaining: run.distances[cell] / run.maze.cols,
        walls: [], eventSeqs: [], segment: step.segment,
      };
      episode.lastContact = step.t;
      episode.walls = [...new Set([...episode.walls, ...hits])];
      for (const e of byTime.get(step.t.toFixed(5)) ?? []) if (!episode.eventSeqs.includes(e.seq)) episode.eventSeqs.push(e.seq);
    }
    if (episode && !hits.length && step.t - episode.lastContact >= CONTACT_POLICY.recoveryMs - 1e-6 && episode.remaining - run.distances[cell] / run.maze.cols >= CONTACT_POLICY.advance - 1e-8) close("recovered", step, true);
    previous=step;
  }
  close(run.endedAt != null ? "end" : "pending", (run.steps ?? []).at(-1));
  const regions = new Map();
  for(const e of episodes){const r=regions.get(e.cell)??{cell:e.cell,count:0,position:e.position};r.count++;regions.set(e.cell,r);}
  return { contacts, spatialEpisodes:[...regions.values()], collisionEpisodes: episodes, recoveries: episodes, wallContactCount: contacts.length, collisionEventCount: collisions.length, collisionEpisodeCount: episodes.length, collisionEvents: collisions, contactDefinitionVersion: CONTACT_POLICY.version };
}
module.exports = { freshWalls, contactAnalysis, CONTACT_POLICY };
