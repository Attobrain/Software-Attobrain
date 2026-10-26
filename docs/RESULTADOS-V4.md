# Resultados explicáveis — versão 4

O perfil objetivo usa somente passos aceitos do indicador, entrada válida e eventos do jogo. Todas as regras são locais e determinísticas. Mouse é uma fonte de controle; EEG permanece sintético e excluído da análise comportamental.

## Contatos

- `wallContactCount`: registros por superfície; a mesma parede exige separação de pelo menos 200 ms ativos. Duas paredes simultâneas podem produzir dois registros.
- `collisionEventCount`: eventos `contact` distintos por execução e sequência, contendo uma ou mais paredes.
- `collisionEpisodeCount`: sequências de contato até recuperação ou censura. A recuperação exige 500 ms ativos sem contato e diminuição de pelo menos 0,01 largura do quadro na distância restante pelo grafo.
- Pausa, lacuna de entrada e término sem recuperação produzem episódios censurados, incluídos na contagem, excluídos da mediana.
- Cada episódio guarda identificação, posições, tempos ativo/de sessão, região inicial, paredes e referências aos eventos. Episódios nunca atravessam segmentos ou lacunas.

As definições são compartilhadas entre aquisição e cálculo em `src/domain/contacts.js`. A distância de recuperação usa células do grafo e, portanto, tem resolução espacial de célula.

## Métricas e qualidade

O contrato contém identificador, nome, valor calculado, unidade, definição/versão, origem, suporte, elegibilidade, motivo e limitações. `eligible` atende ao critério operacional; `limited` tem restrições de cobertura; `insufficient` fica abaixo do mínimo; `unavailable` não tem fonte ou cálculo definido. Nulo não é zero.

| Medida | Mínimo operacional |
| --- | --- |
| Velocidade válida e baixa movimentação | 30 s ativos e cobertura válida ≥80% |
| CV suavizado | anterior + 40 janelas válidas de 500 ms + média não nula |
| Taxa de episódios/min | 60 s ativos e cobertura ≥80% |
| Terços temporais | 45 s ativos, 15 s válidos em cada terço e cobertura ≥80% |
| Recuperação mediana | três episódios completos e cobertura ≥80% |
| Eficiência e excedente no grafo | conclusão e referência válida; elegibilidade exige cobertura ≥80% |

Contagens podem ser descritas em sessões curtas quando a cobertura é suficiente. O CV por passo do motor é técnico e diferente do CV suavizado. Valores calculados não elegíveis ficam identificados no catálogo técnico.

Eficiência da rota no grafo = `100 × referência / distância no grafo`. Excedente no grafo = `distância no grafo − referência`. Eficiência de 100% pode coexistir com contatos. Não há medida de precisão lateral.

Densidade = `10 × episódios / (referência em larguras do quadro × colunas)`: episódios por dez larguras de corredor de referência.

## Interpretação

Conjunto/versão, semente por atividade, geometria, metadados e parâmetros precisam conferir. O protocolo precisa de pelo menos dois percursos concluídos para comparação; tendências A/B/C exigem três. Treino fica separado. Não existe equivalência regional entre os conjuntos: recorrência espacial entre atividades está indisponível.

Uma única análise fornece observações, agregados elegíveis, comparações, relatório e projeções de compatibilidade. A tolerância é de 10% para densidade/excedente, 20% para medidas temporais e cinco pontos percentuais para eficiência. A referência percentual é a atividade anterior; zero usa somente diferença absoluta. Tolerâncias são critérios de engenharia, sem significância estatística ou validação clínica.

Regras incluem contagem observada, recuperação, concentração espacial, comparação entre pares, semelhança/direção/oscilação, contatos iniciais, ritmo/controle, tempo/controle, CV final e baixa movimentação na segunda metade. Cada saída traz regra/versão, critério, valores, suporte, registros de origem e limites.

Espacial: contar episódios pela célula inicial. Concentração exige três episódios ou mais e célula com pelo menos metade deles; empates são declarados. As células são numeradas de 1 a N, da esquerda para a direita, de cima para baixo.

O resumo seleciona até cinco observações, agrupadas por dimensão, com prioridade para padrões mistos e comparações. Não produz pontuação clínica, diagnóstico ou causa presumida. Questões de revisão vêm de templates ligados aos padrões.

## Interface, impressão e compatibilidade

Abas: Resumo, Comparação, Evidências e Dados técnicos. Setas esquerda/direita, Home e End navegam entre abas. A comparação mostra estados de elegibilidade; gráficos não desenham barras para valores rejeitados. Trajetórias têm tabela/lista de episódios e inspeção por instante. Notas manuais são independentes da análise e salvas antes do download.

Exportação v4 conserva dados brutos, notas, métricas v3, episódios `contacts-3.0`, interpretação v2 e política `engineering-2.0`. Campos legados `contacts`, `contactsPerMinute`, `contactsPerDistance` e `velocity` continuam técnicos, com seus significados antigos. Não devem ser usados como episódios.

Importação v2/v3 é histórica e somente leitura, sem recálculo. v2 sem relatório permite inspeção dos registros originais. v4 valida estrutura, métricas, execuções, episódios e referências de evidência. Dados temporários e autenticação do download foram preservados.

Impressão: resumo e comparação primeiro; evidências/dados técnicos somente mediante seleção. As notas são copiadas integralmente para texto de impressão. JSON bruto fica fora da impressão. No navegador incorporado o acionamento de `window.print()` pode não disponibilizar a janela nativa; a emissão física/PDF precisa de navegador com suporte à impressão.

## Verificação reproduzível

```sh
npm test
node scripts/verify-protocol.js caminho-do-arquivo.json
node scripts/verify-protocol.js caminho-curto.json --short --contacts
node scripts/verify-protocol.js caminho-parcial.json --short --contacts --partial
```

As fixtures usam relógio acelerado e entrada automatizada no motor, explicitamente sem participante real. `--contacts` leva o indicador contra paredes existentes, produzindo os eventos pela aquisição normal. Não são os números da pesquisa anexada, cujo JSON original não estava disponível.

Testes cobrem motor, comunicação, protocolo, métricas, episódios, elegibilidade, comparabilidade, conflitos, referências, exportação/importação, EEG e apresentação. A documentação de entrega registra o resultado final e os limites da inspeção visual. Não houve ensaio físico em dois dispositivos nem validação clínica.

Verificação desta entrega: suíte completa com 65 testes aprovados; após os últimos ajustes de validação/importação/impressão, os 16 testes pertinentes também passaram. Fluxos completos, curtos com contatos e parciais foram produzidos pelo motor em relógio acelerado. No navegador foram conferidos resumo, comparação, evidência ligada ao contato correto, histórico v2 sem relatório, estado vazio com ilustração, preservação de notas importadas, navegação por teclado e largura de 390 px sem transbordamento horizontal da página. O acionamento da impressão preparou as notas em texto; a janela nativa/PDF não pôde ser inspecionada no navegador incorporado.

Arquivos principais alterados: domínio de métricas/contatos e análise, consolidado e projeção da sessão; módulos de resultados, gráficos, interpretação, abas e importação; estilos do relatório e controles de impressão/exportação; contratos documentais, README, fixtures e testes. Novos módulos: `contacts.js`, `analysis/policy.js`, `analysis/comparability.js`, `report-tabs.js`, `styles/report.css`, `types/analysis.d.ts` e testes de interpretação.

## Ilustrações

Asset: `assets/evidence-guide.png`. Gerado pela ferramenta integrada de imagens, para o estado sem observações elegíveis. É decorativo, com texto explicativo independente e sem representar dados da sessão.

Prompt utilizado:

> Create a tasteful small editorial 3D clay illustration for Attobrain's scientific maze session dashboard empty/insufficient data state: a folded ivory paper maze, a magnifying glass with a purple handle, and three small turquoise stepping stones suggesting evidence being gathered. Muted violet #7346da, turquoise #00baa8, warm white. Soft studio lighting, calm professional educational mood, clean silhouette, centered compact composition, plenty of clear margins. No words, letters, numbers, logos, charts, medical symbols, brains, diagnoses or decorative background. Transparent background. This is an illustrative empty-state asset, not a data visualization.

Assets adicionais, gerados pela mesma ferramenta integrada: `assets/screens-guide.png`, para a conexão das telas, e `assets/report-guide.png`, para identificar o perfil de resultados. O primeiro possui flutuação suave em CSS, desativada por `prefers-reduced-motion`. Os indicadores de conexão e qualidade continuam usando estados reais. Ilustrações decorativas possuem alternativa vazia e ficam fora da impressão.

Prompt de `screens-guide.png`:

> Small professional editorial clay 3D illustration on transparent background for Attobrain, an educational maze research application. Two simple ivory desktop screens next to one another at a slight three-quarter perspective: left screen holds a purple abstract organized control panel with three turquoise dots, right screen holds a simple raised ivory maze with a turquoise start marker. A short soft turquoise connector links the two screens. Muted purple #7346da and turquoise #00baa8 accents, warm white materials, subtle soft shadow, clean compact centered composition with generous clear margins. No people, text, letters, numbers, logos, medical symbols, brains, charts, cables sprawling, or background scene. Decorative illustration to explain professional and student screens, not a screenshot.

Prompt de `report-guide.png`:

> Small professional editorial clay 3D illustration on transparent background for Attobrain educational maze research application. A neatly organized ivory document folder with three paper sheets, a small raised winding purple path with a turquoise endpoint on the foremost sheet, and a subtle turquoise magnifying glass beside it. Soft tactile materials, muted violet #7346da and turquoise #00baa8, warm white, calm studio lighting and subtle soft shadow. Compact centered composition, generous clear margins, tasteful polished educational software illustration. No people, text, letters, numbers, logos, brains, medical symbols, numerical charts, scores, awards or decorative background. Clearly an illustration of reviewing recorded evidence, not actual session data.

## Pesquisa futura

Medir distribuição de duração, cobertura e elegibilidade em sessões piloto antes de alterar dificuldade. Confiabilidade, comparações longitudinais e integração com sensores reais exigem estudos próprios e proveniência de cada fonte. Esta versão não inclui esses estudos ou modelos clínicos.
