const networkSummaries = {
  dorsal:
    "A rede dorsal ajuda a orientar voluntariamente a atenção para uma meta e a manter essa orientação. No labirinto, é uma analogia para escolher por onde seguir; não é uma conclusão sobre o participante.",
  ventral:
    "A rede ventral participa da reorientação quando algo relevante e inesperado aparece. No labirinto, pense em notar uma mudança no caminho; o sistema não mede esse processo cerebral."
};

export function attentionExplainerMarkup() {
  return `
  <section class="card attention-guide" id="attention-guide" aria-labelledby="attention-guide-title">
    <header class="attention-guide-header">
      <div class="attention-guide-copy">
        <span class="eyebrow">NEUROCIÊNCIA EM LINGUAGEM SIMPLES</span>
        <h2 id="attention-guide-title">Como o cérebro organiza a atenção?</h2>
        <p>A atenção visual depende de redes que cooperam. Não existe um único “ponto da atenção”.</p>
        <span class="attention-concept-tag">MAPA EDUCATIVO · SEM LEITURA AO VIVO</span>
      </div>
      <figure class="attention-art">
        <img src="/assets/attention-network-art.png" alt="" width="768" height="512" loading="lazy">
        <figcaption>Ilustração conceitual. Não representa atividade medida.</figcaption>
      </figure>
    </header>

    <p class="attention-honesty-note"><strong>O que este MVP mede:</strong> percurso e contatos com o labirinto. <strong>O que ainda não mede:</strong> atividade cerebral ou atenção. O EEG exibido em outra seção é sintético.</p>

    <div class="attention-guide-grid">
      <article class="attention-map-panel" aria-labelledby="attention-map-heading">
        <div class="attention-panel-heading">
          <div><span class="eyebrow">DUAS REDES, FUNÇÕES DIFERENTES</span><h3 id="attention-map-heading">Onde elas se organizam</h3></div>
          <span class="attention-map-label">Esquema lateral</span>
        </div>
        <div class="attention-map" id="attention-map" data-network="dorsal">
          <svg viewBox="0 0 620 300" role="img" aria-labelledby="attention-brain-title attention-brain-description">
            <title id="attention-brain-title">Mapa educativo das redes de atenção</title>
            <desc id="attention-brain-description">Esquema lateral simplificado do cérebro. A rede dorsal liga áreas frontais e parietais; a rede ventral liga áreas frontal ventral e temporoparietal. As posições são aproximadas e não são leituras do aluno.</desc>
            <path class="brain-outline" d="M74 176c-11-23-7-52 7-73 17-25 44-38 74-36 18-27 54-39 86-27 24-21 61-25 89-9 30-16 69-9 91 14 29-2 55 18 60 45 27 8 43 34 36 60 11 24-1 54-28 65-12 28-44 42-73 32-27 18-64 16-88-3-29 13-64 6-82-16-31 10-65-4-76-31-29 4-57-6-73-21-13-12-20-27-23-42-8-2-15-9-20-18Z"/>
            <path class="brain-lobe lobe-frontal" d="M87 175c-7-20-5-47 8-66 16-23 41-34 69-32 19-25 51-35 80-25l13 61-27 62-39 42c-27 8-58-2-69-28-16 2-27-4-35-14Z"/>
            <path class="brain-lobe lobe-parietal" d="m257 52 23-19c28-15 61-10 82 11l18 69-34 50-61 8-28-61Z"/>
            <path class="brain-lobe lobe-temporal" d="m225 165 43-18 58 10 39 39-18 45c-27 12-58 7-77-11-28 9-59-2-70-27Z"/>
            <path class="brain-lobe lobe-occipital" d="m380 58 27-13c28-2 53 17 58 43 26 8 41 31 36 55 10 22-1 50-25 60l-34-5-31-38 3-50Z"/>
            <g class="brain-grooves" aria-hidden="true">
              <path d="M156 78c-11 23-10 47 7 62m42-98c-8 21-5 44 9 59m42-57c-11 22-8 42 7 58m41-71c-10 23-7 43 8 60m38-50c-8 20-3 41 12 56m31-45c-5 20 2 39 17 53M128 151c19-11 38-11 57 1m35 12c22-12 44-11 66 3m27 8c18-10 36-9 53 1m31-6c16-7 31-4 45 7M173 207c16-13 34-15 52-7m48 8c13 14 29 20 47 18"/>
            </g>
            <g class="attention-network-lines network-dorsal" aria-label="Rede dorsal">
              <path d="M261 94 Q335 40 423 79"/>
              <circle cx="261" cy="94" r="9"/><circle cx="423" cy="79" r="9"/>
              <text x="225" y="78">FEF</text><text x="435" y="72">IPS/SPL</text>
            </g>
            <g class="attention-network-lines network-ventral" aria-label="Rede ventral">
              <path d="M263 178 Q353 215 453 160"/>
              <circle cx="263" cy="178" r="9"/><circle cx="453" cy="160" r="9"/>
              <text x="218" y="198">VFC</text><text x="464" y="155">TPJ</text>
            </g>
            <text class="brain-orientation" x="78" y="278">FRENTE</text><text class="brain-orientation" x="510" y="278">TRÁS</text>
          </svg>
        </div>
        <div class="attention-network-switch" role="group" aria-label="Escolha uma rede para destacar no esquema">
          <button type="button" data-attention-network="dorsal" aria-pressed="true" aria-controls="attention-map attention-network-explanation">Dorsal · orientar e manter</button>
          <button type="button" data-attention-network="ventral" aria-pressed="false" aria-controls="attention-map attention-network-explanation">Ventral · redirecionar</button>
        </div>
        <p class="attention-network-explanation" id="attention-network-explanation" aria-live="polite">${networkSummaries.dorsal}</p>
        <p class="attention-map-footnote">FEF = campos oculares frontais · IPS/SPL = sulco intraparietal / lóbulo parietal superior · TPJ = junção temporoparietal · VFC = córtex frontal ventral.</p>
      </article>

      <article class="attention-electrode-panel" aria-labelledby="attention-electrode-heading">
        <div class="attention-panel-heading">
          <div><span class="eyebrow">SENSORES EEG · EXEMPLO</span><h3 id="attention-electrode-heading">Onde ficam os eletrodos?</h3></div>
          <span class="attention-map-label">Couro cabeludo</span>
        </div>
        <figure class="scalp-map-figure">
          <svg class="scalp-map" viewBox="0 0 300 280" role="img" aria-labelledby="scalp-map-title scalp-map-description">
            <title id="scalp-map-title">Exemplo de posições EEG do sistema 10–20</title>
            <desc id="scalp-map-description">Vista superior esquemática da cabeça. Os pontos F3, Fz e F4 ficam na parte frontal; P3, Pz e P4 ficam na parte parietal. O arranjo real depende do equipamento.</desc>
            <path class="scalp-head" d="M150 20c-55 0-99 47-99 113 0 66 44 118 99 118s99-52 99-118C249 67 205 20 150 20Z"/>
            <path class="scalp-nose" d="m138 21 12-13 12 13"/>
            <path class="scalp-ear" d="M52 119c-15-3-19 9-15 24 3 11 9 18 18 17m193-41c15-3 19 9 15 24-3 11-9 18-18 17"/>
            <path class="scalp-midline" d="M150 31v210"/>
            <g class="electrode-group electrode-front"><circle cx="114" cy="72" r="7"/><circle cx="150" cy="65" r="7"/><circle cx="186" cy="72" r="7"/><text x="94" y="63">F3</text><text x="150" y="49">Fz</text><text x="206" y="63">F4</text></g>
            <g class="electrode-group electrode-central"><circle cx="91" cy="133" r="6"/><circle cx="150" cy="132" r="6"/><circle cx="209" cy="133" r="6"/><text x="67" y="137">C3</text><text x="150" y="119">Cz</text><text x="232" y="137">C4</text></g>
            <g class="electrode-group electrode-parietal"><circle cx="114" cy="194" r="7"/><circle cx="150" cy="201" r="7"/><circle cx="186" cy="194" r="7"/><text x="88" y="212">P3</text><text x="150" y="224">Pz</text><text x="210" y="212">P4</text></g>
            <text class="scalp-orientation" x="150" y="267">VISTA DE CIMA · FRENTE ↑</text>
          </svg>
          <figcaption>Posições aproximadas do sistema internacional 10–20. O desenho é educativo; não representa um equipamento conectado.</figcaption>
        </figure>
        <div class="attention-electrode-copy">
          <p><strong>Em um BCI que usa EEG</strong>, os eletrodos registram diferenças elétricas na superfície da cabeça. Pense em microfones captando uma mistura: o eletrodo não aponta sozinho para uma área interna específica.</p>
          <p><strong>F3, Fz e F4</strong> são posições frontais; <strong>P3, Pz e P4</strong>, parietais. Esses nomes indicam lugares no couro cabeludo. Localizar fontes cerebrais exige modelos e análise próprios.</p>
        </div>
      </article>
    </div>

    <details class="attention-references">
      <summary>Ver de onde vem esta explicação</summary>
      <ul>
        <li><a href="https://doi.org/10.1038/NRN755" target="_blank" rel="noopener">Corbetta &amp; Shulman (2002) · redes de atenção dorsal e ventral</a></li>
        <li><a href="https://doi.org/10.1097/WNP.0000000000000316" target="_blank" rel="noopener">American Clinical Neurophysiology Society (2016) · nomenclatura de posições de eletrodos</a></li>
        <li><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10167408/" target="_blank" rel="noopener">Electroencephalography source localization (2023) · limites e modelos para localizar fontes</a></li>
      </ul>
    </details>
  </section>`;
}

export function bindAttentionExplorer(root) {
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-attention-network]");
    if (!button) return;

    const network = button.dataset.attentionNetwork;
    const section = button.closest(".attention-guide");
    if (!section || !networkSummaries[network]) return;

    section.querySelector("#attention-map").dataset.network = network;
    section.querySelector("#attention-network-explanation").textContent = networkSummaries[network];
    section.querySelectorAll("[data-attention-network]").forEach((option) => {
      option.setAttribute("aria-pressed", String(option === button));
    });
  });
}
