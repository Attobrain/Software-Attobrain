export function setupLayout() {
  return ` <details class="card setup-panel" id="activity-setup" open><summary><span><span class="eyebrow">ANTES DE COMEÇAR</span><strong>Configuração da sessão</strong></span><span class="summary-hint">Tipo de sessão, nível e tempos</span></summary><div class="setup-content"><form id="configuration" class="setup">
 <label>Tipo de sessão<select name="mode"><option value="protocol">Treino + atividades A, B e C</option><option value="single">Uma atividade livre (exploração)</option></select></label>
 <label>Nível<select name="level"><option value="7">Inicial · 7 × 7</option><option value="10">Intermediário · 10 × 10</option></select></label>
 <label>Código do labirinto (exploração)<input name="seed" type="number" min="0" max="4294967295" value="42" required></label>
 <label>Duração do treino (60–90 s)<input name="trainingSeconds" type="number" min="60" max="90" value="75" required></label>
 <label>Duração de cada atividade (180–240 s)<input name="activitySeconds" type="number" min="180" max="240" value="210" required></label>
 <label>Descanso entre atividades (30–45 s)<input name="intervalSeconds" type="number" min="30" max="45" value="35" required></label>
 <details class="parameters"><summary>Sinais neurofisiológicos sintéticos (avançado)</summary><p class="panel-caption">O gerador demonstra o formato da visualização; não recebe dados de sensores.</p><div class="setup"><label>Tipo de simulação<select name="eegMode"><option value="independent">Independente da atividade (padrão)</option><option value="interactive">Reage à interação (didático)</option></select></label>
 <label>Canais simulados<select name="channels"><option value="8">8 canais</option><option value="4">4 canais</option><option value="1">1 canal</option></select></label>
 <label>Frequência do sinal<select name="sampleRate"><option value="250">250 Hz</option><option value="500">500 Hz</option></select></label>
 <label>Código da simulação<input name="eegSeed" type="number" min="0" max="4294967295" value="90210" required></label>
 </div></details><details class="parameters"><summary>Ajustes finos da interação (avançado)</summary><div class="setup">
 <label>Velocidade do ponto de interação (largura/s)<input name="speed" type="number" min="0.1" max="0.4" step="0.01" value="0.25" required></label>
 <label>Raio do ponto de interação (largura)<input name="radius" type="number" min="0.005" max="0.015" step="0.001" value="0.01" required></label>
 <label>Espessura da parede (largura)<input name="wallWidth" type="number" min="0.002" max="0.008" step="0.001" value="0.005" required></label>
 <label>Velocidade de "quase parado" (largura/s)<input name="lowSpeed" type="number" min="0.001" max="0.02" step="0.001" value="0.005" required></label>
 <label>Tempo mínimo de "quase parado" (s)<input name="lowSeconds" type="number" min="1" max="5" step="0.5" value="2" required></label>
 <label>Falhas de sinal simuladas<select name="artifacts"><option value="true">Ativadas</option><option value="false">Desativadas</option></select></label></div></details>
 <button id="prepare" type="submit">Revisar sessão →</button></form>
 <p id="set-info" class="panel-caption"></p></div></details>
`;
}
