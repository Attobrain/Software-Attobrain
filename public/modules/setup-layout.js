export function setupLayout() {
  return ` <details class="card setup-panel" id="activity-setup" open><summary><span><span class="eyebrow">ANTES DE COMEÇAR</span><strong>Configuração da sessão</strong></span><span class="summary-hint">Protocolo, duração e simulação</span></summary><div class="setup-content"><form id="configuration" class="setup">
 <label>Modo<select name="mode"><option value="protocol">Treinamento + A/B/C</option><option value="single">Atividade única · exploração</option></select></label>
 <label>Nível<select name="level"><option value="7">Inicial · 7 × 7</option><option value="10">Intermediário · 10 × 10</option></select></label>
 <label>Semente (exploração)<input name="seed" type="number" min="0" max="4294967295" value="42" required></label>
 <label>Treino (60–90 s)<input name="trainingSeconds" type="number" min="60" max="90" value="75" required></label>
 <label>Atividade (180–240 s)<input name="activitySeconds" type="number" min="180" max="240" value="210" required></label>
 <label>Intervalo (30–45 s)<input name="intervalSeconds" type="number" min="30" max="45" value="35" required></label>
 <label>EEG sintético<select name="eegMode"><option value="independent">Independente · padrão</option><option value="interactive">Interativo · didático</option></select></label>
 <label>Canais virtuais<select name="channels"><option value="8">8 canais</option><option value="4">4 canais</option><option value="1">1 canal</option></select></label>
 <label>Taxa EEG<select name="sampleRate"><option value="250">250 Hz</option><option value="500">500 Hz</option></select></label>
 <label>Semente EEG<input name="eegSeed" type="number" min="0" max="4294967295" value="90210" required></label>
 <details class="parameters"><summary>Parâmetros experimentais de engenharia</summary><div class="setup">
 <label>Velocidade (largura/s)<input name="speed" type="number" min="0.1" max="0.4" step="0.01" value="0.25" required></label>
 <label>Raio (largura)<input name="radius" type="number" min="0.005" max="0.015" step="0.001" value="0.01" required></label>
 <label>Parede (largura)<input name="wallWidth" type="number" min="0.002" max="0.008" step="0.001" value="0.005" required></label>
 <label>Baixa velocidade (largura/s)<input name="lowSpeed" type="number" min="0.001" max="0.02" step="0.001" value="0.005" required></label>
 <label>Duração mínima (s)<input name="lowSeconds" type="number" min="1" max="5" step="0.5" value="2" required></label>
 <label>Artefatos programados<select name="artifacts"><option value="true">Ativados</option><option value="false">Desativados</option></select></label></div></details>
 <button id="prepare" type="submit">Preparar sessão</button></form>
 <p id="set-info" class="panel-caption"></p></div></details>
`;
}
