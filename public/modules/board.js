export function drawBoard(
  canvas,
  state,
  { trail = [], metrics = null, marker = null } = {},
) {
  if (!canvas) return;
  const c = canvas.getContext("2d"),
    size = canvas.width;
  c.clearRect(0, 0, size, size);
  if (!state?.maze) return;
  c.fillStyle = "#fff";
  c.fillRect(0, 0, size, size);
  c.strokeStyle = "#4b526d";
  c.lineWidth = 4;
  c.lineCap = "round";
  for (const [x, y, a, b] of state.walls) {
    c.beginPath();
    c.moveTo(x * size, y * size);
    c.lineTo(a * size, b * size);
    c.stroke();
  }
  if (trail.length) {
    c.beginPath();
    trail.forEach((p, i) => {
      if (i && p.segment === trail[i - 1].segment)
        c.lineTo(p.x * size, p.y * size);
      else c.moveTo(p.x * size, p.y * size);
    });
    c.strokeStyle = "#b8a3ef";
    c.lineWidth = 2;
    c.stroke();
  }
  function dot(p, color, r) {
    if (!p) return;
    c.beginPath();
    c.arc(p.x * size, p.y * size, r, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
  }
  const spatial = metrics?.spatialContacts;
  if (spatial?.length) {
    const max = Math.max(...spatial.map((p) => p.count));
    for (const p of spatial) {
      dot(
        p.position,
        `rgba(220,50,65,${0.35 + (0.65 * p.count) / max})`,
        5 + Math.min(8, Math.log2(p.count + 1) * 2),
      );
      c.fillStyle = "#9f1239";
      c.font = "12px sans-serif";
      c.fillText(
        String(p.count),
        p.position.x * size + 8,
        p.position.y * size - 8,
      );
    }
  } else for (const p of metrics?.contacts ?? []) dot(p.position, "#ef6464", 5);
  for (const p of metrics?.low ?? []) dot(p.position, "#69bbec", 7);
  dot({ x: 0.5 / state.maze.cols, y: 0.5 / state.maze.rows }, "#00baa8", 14);
  dot(
    { x: 1 - 0.5 / state.maze.cols, y: 1 - 0.5 / state.maze.rows },
    "#7346da",
    16,
  );
  dot(marker ?? state.position, "#e69a20", 8);
}
