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
