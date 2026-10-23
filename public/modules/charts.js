export function waveform(canvas, channels) {
  if (!canvas) return;
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  c.clearRect(0, 0, w, h);
  c.strokeStyle = "#7346da";
  c.lineWidth = 1;
  channels.forEach((samples, row) => {
    const height = h / channels.length,
      center = height * (row + 0.5);
    c.fillStyle = "#64748b";
    c.fillText(`V${row + 1} · µV sintéticos`, 8, row * height + 14);
    c.beginPath();
    for (let x = 0; x < w; x++) {
      const start = Math.floor((x * samples.length) / w),
        end = Math.max(start + 1, Math.floor(((x + 1) * samples.length) / w));
      let min = Infinity,
        max = -Infinity;
      for (let i = start; i < end && i < samples.length; i++) {
        min = Math.min(min, samples[i]);
        max = Math.max(max, samples[i]);
      }
      if (Number.isFinite(min)) {
        c.moveTo(x, center - (min * height) / 160);
        c.lineTo(x, center - (max * height) / 160);
      }
    }
    c.stroke();
  });
}
export function spectrum(canvas, data) {
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  c.clearRect(0, 0, w, h);
  if (!data?.valid) return;
  const values = data.psd.filter((_, i) => data.frequencies[i] <= 45),
    max = Math.max(...values, 1e-9);
  c.beginPath();
  c.strokeStyle = "#00a99a";
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * (w - 60) + 40,
      y = h - 25 - (v / max) * (h - 50);
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  });
  c.stroke();
  c.fillStyle = "#64748b";
  c.fillText("0 Hz", 35, h - 5);
  c.fillText("45 Hz", w - 45, h - 5);
}
export function comparison(canvas, evaluations) {
  const c = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  c.clearRect(0, 0, w, h);
  const metrics = [
    ["efficiency", "Eficiência (%)"],
    ["contactsPerMinute", "Contatos/min"],
    ["cv", "CV da velocidade"],
  ];
  metrics.forEach(([key, label], group) => {
    const values = evaluations.map((r) =>
        key === "cv"
          ? (r.result?.velocity.cv ?? null)
          : (r.result?.[key] ?? null),
      ),
      max = Math.max(...values.filter(Number.isFinite), 1e-9),
      width = w / 3;
    c.fillStyle = "#475569";
    c.fillText(label, group * width + 20, 20);
    values.forEach((v, i) => {
      const x = group * width + 35 + (i * width) / 4,
        bar = Number.isFinite(v) ? (v / max) * (h - 75) : 0;
      c.fillStyle = ["#7346da", "#00baa8", "#e69a20"][i];
      c.fillRect(x, h - 35 - bar, width / 6, bar);
      c.fillStyle = "#475569";
      c.fillText(
        `${["A", "B", "C"][i]}: ${Number.isFinite(v) ? v.toFixed(2) : "—"}`,
        x,
        h - 15,
      );
    });
  });
}
export function trendPoints(trajectory) {
  const end = trajectory.at(-1)?.t ?? 0,
    points = [];
  for (
    let i = Math.max(1, trajectory.length - 1300);
    i < trajectory.length;
    i++
  ) {
    const a = trajectory[i - 1],
      b = trajectory[i],
      dt = (b.t - a.t) / 1000;
    if (b.t < end - 60000 || dt <= 0 || dt > 0.2 || a.segment !== b.segment)
      continue;
    points.push({
      t: b.t,
      speed: Math.hypot(b.x - a.x, b.y - a.y) / dt,
      segment: b.segment,
    });
  }
  return points;
}
export function activityTrend(canvas, trajectory, metrics, maxSpeed = 0.25) {
  if (!canvas) return;
  const context = canvas.getContext("2d"),
    width = canvas.width,
    height = canvas.height;
  context.clearRect(0, 0, width, height);
  const left = 55,
    right = width - 22,
    top = 22,
    bottom = height - 36,
    max = Math.max(0.1, maxSpeed * 1.15);
  context.font = "12px Segoe UI";
  context.lineWidth = 1;
  context.textAlign = "right";
  for (let i = 0; i <= 3; i++) {
    const y = bottom - ((bottom - top) * i) / 3;
    context.strokeStyle = "#e9edf3";
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
    context.fillStyle = "#526078";
    context.fillText(((max * i) / 3).toFixed(2), left - 10, y + 4);
  }
  const points = trendPoints(trajectory),
    end = Math.max(60000, trajectory.at(-1)?.t ?? 0),
    start = end - 60000;
  const x = (t) => left + ((t - start) / 60000) * (right - left),
    y = (speed) => bottom - (Math.min(max, speed) / max) * (bottom - top);
  context.textAlign = "center";
  for (let i = 0; i <= 4; i++) {
    const t = start + 15000 * i;
    context.fillStyle = "#526078";
    context.fillText(
      `${Math.round(t / 1000)} s`,
      left + ((right - left) * i) / 4,
      height - 10,
    );
  }
  if (points.length < 2) {
    context.fillStyle = "#68748a";
    context.fillText("Aguardando dados de movimento", width / 2, height / 2);
    return;
  }
  context.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i && p.segment === points[i - 1].segment)
      context.lineTo(x(p.t), y(p.speed));
    else context.moveTo(x(p.t), y(p.speed));
  }
  context.strokeStyle = "#7045c9";
  context.lineWidth = 2;
  context.lineJoin = "round";
  context.stroke();
  for (const contact of metrics?.contacts ?? []) {
    if (contact.t < start || contact.t > end) continue;
    context.beginPath();
    context.arc(x(contact.t), bottom - 5, 3.5, 0, Math.PI * 2);
    context.fillStyle = "#b45309";
    context.fill();
  }
}
