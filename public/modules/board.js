export function drawBoard(
  canvas,
  state,
  { trail = [], metrics = null, marker = null, studentTheme = false } = {},
) {
  if (!canvas) return;
  const c = canvas.getContext("2d"),
    size = canvas.width;
  c.clearRect(0, 0, size, size);
  if (!state?.maze) return;
  c.fillStyle = "#fff";
  c.fillRect(0, 0, size, size);
  if (studentTheme) {
    // Fundo em xadrez suave nas células, para o aluno enxergar o "chão" do labirinto.
    const cw = size / state.maze.cols, ch = size / state.maze.rows;
    for (let r = 0; r < state.maze.rows; r++)
      for (let k = 0; k < state.maze.cols; k++) {
        c.fillStyle = (r + k) % 2 ? "#f6f1ff" : "#fbf9ff";
        c.fillRect(k * cw, r * ch, cw, ch);
      }
  }
  c.strokeStyle = studentTheme ? "#7a5fd0" : "#4b526d";
  c.lineWidth = studentTheme ? 6 : 4;
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
    c.strokeStyle = studentTheme ? "#3cc9a8" : "#b8a3ef";
    c.lineWidth = studentTheme ? 7 : 2;
    c.globalAlpha = studentTheme ? 0.45 : 1;
    c.stroke();
    c.globalAlpha = 1;
  }
  function dot(p, color, r) {
    if (!p) return;
    c.beginPath();
    c.arc(p.x * size, p.y * size, r, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
  }
  const spatial = metrics?.spatialEpisodes ?? metrics?.spatialContacts;
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
  const start = { x: 0.5 / state.maze.cols, y: 0.5 / state.maze.rows };
  const finish = { x: 1 - 0.5 / state.maze.cols, y: 1 - 0.5 / state.maze.rows };
  if (studentTheme) {
    // Brilhos que pulsam devagar: a chegada chama a atenção e o ponto fica fácil de achar.
    const pulso = 0.5 + 0.5 * Math.sin(performance.now() / 380);
    const halo = (p, cor, raio) => {
      c.beginPath();
      c.arc(p.x * size, p.y * size, raio, 0, Math.PI * 2);
      c.fillStyle = cor;
      c.fill();
    };
    halo(start, "rgba(0,186,168,.22)", 24);
    halo(finish, `rgba(115,70,218,${0.18 + 0.18 * pulso})`, 26 + 10 * pulso);
    dot(start, "#00baa8", 15);
    dot(finish, "#7346da", 18);
    c.fillStyle = "#fff";
    c.font = "bold 22px sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("★", finish.x * size, finish.y * size + 1);
    const jogador = marker ?? state.position;
    if (jogador) halo(jogador, "rgba(230,154,32,.28)", 20 + 4 * pulso);
    dot(jogador, "#e69a20", 10);
    dot({ x: (jogador?.x ?? 0) - 0.003, y: (jogador?.y ?? 0) - 0.003 }, "#ffd88a", 3.5);
    return;
  }
  dot(start, "#00baa8", 14);
  dot(finish, "#7346da", 16);
  dot(marker ?? state.position, "#e69a20", 8);
}
