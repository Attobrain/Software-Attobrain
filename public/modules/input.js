export function mouseInput(socket, state) {
  const presence = () => socket.emit("presence", { visible: !document.hidden });
  socket.on("connect", presence);
  setInterval(presence, 1000);
  let target = null,
    seq = 0,
    runId = null;
  document.addEventListener("pointermove", (event) => {
    if (event.target.id !== "board") return;
    const b = event.target.getBoundingClientRect();
    target = {
      x: Math.max(0, Math.min(1, (event.clientX - b.left) / b.width)),
      y: Math.max(0, Math.min(1, (event.clientY - b.top) / b.height)),
    };
  });
  document.addEventListener("pointerout", (event) => {
    if (event.target.id === "board") target = null;
  });
  document.addEventListener("visibilitychange", () => {
    presence();
    target = null;
    if (document.hidden) send();
  });
  function send() {
    const s = state();
    if (!s || s.state !== "RUNNING") return;
    if (runId !== s.runId) {
      runId = s.runId;
      seq = 0;
      target = null;
    }
    socket.volatile.emit("input", {
      runId,
      seq: ++seq,
      inside: !!target,
      x: target?.x,
      y: target?.y,
      hidden: document.hidden,
      clientTime: performance.now(),
    });
  }
  setInterval(send, 50);
}
