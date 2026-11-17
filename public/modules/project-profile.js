import { escape as esc } from "./format.js";

const references = [
  {
    title: "Clinical Practice Guideline for the Diagnosis, Evaluation, and Treatment of ADHD in Children and Adolescents",
    citation: "Wolraich et al. · Pediatrics · 2019",
    url: "https://pubmed.ncbi.nlm.nih.gov/31570648/",
  },
  {
    title: "Reaction time variability in ADHD: a meta-analytic review of 319 studies",
    citation: "Kofler et al. · Clinical Psychology Review · 2013",
    url: "https://pubmed.ncbi.nlm.nih.gov/23872284/",
  },
  {
    title: "Practice advisory: The utility of EEG theta/beta power ratio in ADHD diagnosis",
    citation: "Gloss et al. · Neurology · 2016",
    url: "https://pubmed.ncbi.nlm.nih.gov/27760867/",
  },
  {
    title: "Digital technologies for assessing ADHD (HTG729)",
    citation: "National Institute for Health and Care Excellence · 2024",
    url: "https://www.nice.org.uk/guidance/htg729",
  },
];

const concepts = [
  {
    title: "Percurso visual demonstrativo",
    text: "A pessoa percorre um labirinto enquanto a interface demonstra como uma trajetória visual poderia ser apresentada. A entrada atual é provisória e não corresponde a uma leitura ocular.",
  },
  {
    title: "Medidas com contexto",
    text: "Tempo ativo, trajetória, distância, conclusão e contatos com as paredes aparecem com critérios de qualidade e evidências. Nenhuma métrica isolada mede atenção ou desempenho fora da atividade.",
  },
  {
    title: "Comparação dentro do protocolo",
    text: "A experiência completa mantém Treino e atividades A, B e C. As três atividades usam a mesma interface; A é a tela representativa no Figma. Comparações só aparecem quando os percursos são concluídos e os parâmetros são compatíveis.",
  },
];

const futureLayers = [
  {
    image: "gaze-maze-vision.png",
    title: "Trajetória do olhar",
    status: "Interface conceitual",
    text: "Um sensor ocular futuro poderia associar pontos de fixação aos trechos do labirinto. Esta imagem não contém dados capturados.",
  },
  {
    image: "visual-focus-concept.png",
    title: "Foco visual",
    status: "Hipótese de visualização",
    text: "Uma forma didática de mostrar regiões observadas, sem transformar o mapa em diagnóstico ou medida clínica de atenção.",
  },
  {
    image: "neural-signal-concept.png",
    title: "Sinais neurofisiológicos",
    status: "Sinal sintético no MVP",
    text: "O painel atual gera uma onda por software. A ilustração representa uma possibilidade futura, sem sensor conectado.",
  },
];

const teamMembers = [
  "Victor Gabriel Ferreira Theodoro",
  "Laura Julia Mathias Amaral",
  "Santos, M.",
  "Dias, M.",
  "Cubas, L.",
];

export function projectProfileView() {
  return `<section class="page-heading">
    <div><span class="eyebrow">PROJETO INTEGRADOR I · FATEC REGISTRO</span><h1 tabindex="-1">Sobre o Attobrain</h1><p>Proposta, base conceitual, equipe e limites do MVP acadêmico.</p></div>
  </section>
  <div class="project-profile">
    <section class="platform-notice" aria-labelledby="project-purpose-title">
      <strong id="project-purpose-title">Um protótipo para futuras camadas de leitura</strong>
      <p>O MVP demonstra um percurso em labirinto e uma interface preparada para receber, no futuro, rastreamento ocular e sinais neurofisiológicos. Hoje, a trajetória usa uma entrada provisória e o sinal avançado é gerado por software; nenhum sensor ocular ou neural está conectado.</p>
    </section>

    <section class="card project-section" aria-labelledby="project-concepts-title">
      <div class="section-heading"><div><span class="eyebrow">BASE CONCEITUAL</span><h2 id="project-concepts-title">O que a atividade permite observar</h2></div></div>
      <div class="project-concepts">${concepts.map((item, index) => `<article class="project-concept"><span class="home-number">0${index + 1}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`).join("")}</div>
    </section>

    <section class="card project-section future-layers" aria-labelledby="future-layers-title">
      <div class="section-heading"><div><span class="eyebrow">VISÃO DE EVOLUÇÃO</span><h2 id="future-layers-title">Como essas camadas podem aparecer</h2></div><span class="concept-badge">Visualização conceitual</span></div>
      <p class="future-layers-intro">As artes ajudam a explicar o potencial da interface. Não representam sinais, áreas cerebrais ou trajetórias coletados nesta sessão.</p>
      <div class="future-layer-grid">${futureLayers.map((item, index) => `<article class="future-layer-card"><div class="future-layer-art art-float ${index === 1 ? "art-delay-1" : index === 2 ? "art-delay-2" : ""}"><img src="/assets/${item.image}" alt="" width="1000" height="667" loading="lazy"></div><span class="future-layer-status">${esc(item.status)}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`).join("")}</div>
    </section>

    <section class="card project-section" aria-labelledby="project-boundaries-title">
      <div class="section-heading"><div><span class="eyebrow">ESCOPO E LIMITES</span><h2 id="project-boundaries-title">Demonstração acadêmica, sem uso clínico</h2></div></div>
      <ul class="project-boundaries">
        <li>A trajetória usa uma entrada provisória para demonstrar o fluxo; não é rastreamento ocular.</li>
        <li>Foco visual e atividade cerebral aparecem apenas como conceitos visuais ou sinais sintéticos, não como medições do participante.</li>
        <li>Os resultados descrevem registros da atividade. Não diagnosticam TDAH, não atribuem atenção e não comparam participantes com uma população normativa.</li>
        <li>Os critérios do MVP são parâmetros de engenharia, sem validação clínica ou psicométrica.</li>
      </ul>
    </section>

    <section class="card project-section" aria-labelledby="project-team-title">
      <div class="section-heading"><div><span class="eyebrow">EQUIPE</span><h2 id="project-team-title">Autores da apresentação</h2></div></div>
      <ul class="project-team-list">${teamMembers.map(name => `<li>${esc(name)}</li>`).join("")}</ul>
      <p class="project-team-note">Projeto Integrador I · FATEC Registro. No PDF, Santos, Dias e Cubas aparecem somente com a inicial do prenome.</p>
    </section>

    <details class="card project-references">
      <summary>Referências usadas para delimitar a interpretação</summary>
      <p>Estas fontes contextualizam os limites científicos do MVP; não validam o Attobrain como instrumento de avaliação.</p>
      <ul>${references.map(reference => `<li><a href="${reference.url}" target="_blank" rel="noopener noreferrer">${esc(reference.title)}</a><span>${esc(reference.citation)}</span></li>`).join("")}</ul>
      <p class="project-team-note">Variabilidade do tempo de reação discutida na literatura não é a mesma variável que ritmo do percurso. O sinal EEG desta demonstração também não é uma medição fisiológica.</p>
    </details>
  </div>`;
}
