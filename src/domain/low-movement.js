"use strict";
// Resample each uninterrupted segment at 50 ms, then use a 500 ms moving window.
function lowMovement(steps, config) {
  const episodes = [];
  let segment = -1,
    next = 0,
    previous = null,
    window = [],
    candidate = null;
  const close = () => {
    if (
      candidate &&
      candidate.end - candidate.start >= config.lowSeconds * 1000
    ) {
      const position = {
        x:
          candidate.points.reduce((v, p) => v + p.x, 0) /
          candidate.points.length,
        y:
          candidate.points.reduce((v, p) => v + p.y, 0) /
          candidate.points.length,
      };
      episodes.push({
        start: candidate.start,
        end: candidate.end,
        duration: candidate.end - candidate.start,
        sessionStart: candidate.sessionStart,
        sessionEnd: candidate.sessionEnd,
        position,
        dispersion: Math.max(
          ...candidate.points.map((p) =>
            Math.hypot(p.x - position.x, p.y - position.y),
          ),
        ),
      });
    }
    candidate = null;
  };
  for (const step of steps) {
    if (step.segment !== segment) {
      close();
      segment = step.segment;
      window = [];
      previous = step.from;
      next = step.t - step.dt + 50;
    }
    while (next <= step.t + 1e-6) {
      const fraction = Math.max(
        0,
        Math.min(1, (next - (step.t - step.dt)) / step.dt),
      );
      const point = {
        x: step.from.x + (step.x - step.from.x) * fraction,
        y: step.from.y + (step.y - step.from.y) * fraction,
      };
      window.push(Math.hypot(point.x - previous.x, point.y - previous.y));
      if (window.length > 10) window.shift();
      const sessionTime = step.sessionTime - (step.t - next);
      if (
        window.length === 10 &&
        window.reduce((v, d) => v + d, 0) / 0.5 < config.lowSpeed
      ) {
        candidate ??= {
          start: next - 500,
          end: next,
          sessionStart: sessionTime - 500,
          sessionEnd: sessionTime,
          points: [],
        };
        candidate.end = next;
        candidate.sessionEnd = sessionTime;
        candidate.points.push(point);
      } else close();
      previous = point;
      next += 50;
    }
  }
  close();
  return episodes;
}
module.exports = { lowMovement };
