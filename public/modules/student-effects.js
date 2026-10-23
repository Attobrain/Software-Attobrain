/** Select a cue only for a new, uninterrupted server transition. */
export function studentCue(current, previous) {
  if (!previous || current.disconnected || previous.disconnected || current.runId !== previous.runId) return null;
  if (current.state === previous.state) return null;
  if (current.state === "RUNNING") return "start";
  if (current.state === "PAUSED") return "pause";
  if (current.state === "COMPLETED") return "complete";
  if (["TIMED_OUT", "ABORTED"].includes(current.state)) return "finish";
  return null;
}

/** Audio is opt-in, gesture-unlocked and never sent to the server. */
export function createStudentEffects(button) {
  let context, enabled = false;
  const voices = new Set();
  const stop = () => { for (const voice of voices) { try { voice.stop(); } catch {} } voices.clear(); };
  const play = (cue) => {
    if (!enabled || document.hidden || context?.state !== "running") return;
    const notes = { start: [392, 523.25], pause: [349.23, 293.66], complete: [523.25, 659.25, 783.99], finish: [392, 329.63] }[cue];
    if (!notes) return;
    stop();
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator(), gain = context.createGain();
      const at = context.currentTime + index * 0.13;
      oscillator.type = "sine"; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.045, at + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.23);
      oscillator.connect(gain); gain.connect(context.destination);
      voices.add(oscillator);
      oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(at); oscillator.stop(at + 0.25);
    });
  };
  button.onclick = async () => {
    try {
      if (!enabled) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw Error("unsupported");
        context ??= new Audio();
        await context.resume();
      }
      enabled = !enabled;
      button.setAttribute("aria-pressed", String(enabled));
      button.querySelector("span").textContent = enabled ? "Sons ativados" : "Ativar sons";
      if (enabled) play("start"); else stop();
    } catch {
      enabled = false;
      button.setAttribute("aria-pressed", "false");
      button.querySelector("span").textContent = "Som indisponível";
    }
  };
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  window.addEventListener("pagehide", () => { stop(); void context?.close(); }, { once: true });
  return { update(current, previous) { if (current.disconnected) stop(); else play(studentCue(current, previous)); } };
}
