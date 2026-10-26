# Attobrain

MVP acadêmico da Attobrain para apresentar uma atividade de labirinto com acompanhamento em duas telas e um perfil explicável da sessão. O participante percorre um labirinto usando o mouse como controle de entrada; o profissional acompanha a atividade e consulta os registros gerados pelo software.

O sistema é uma demonstração de software. O mouse não rastreia os olhos, o EEG disponível é inteiramente sintético e as métricas não são medidas clínicas. Não há diagnóstico, avaliação de atenção, sensor conectado ou persistência em banco de dados.

## Índice

- [Início rápido](#início-rápido)
- [O que o sistema faz](#o-que-o-sistema-faz)
- [Fluxo da atividade](#fluxo-da-atividade)
- [Labirinto e controle](#labirinto-e-controle)
- [Resultados e interpretação](#resultados-e-interpretação)
- [EEG demonstrativo](#eeg-demonstrativo)
- [Exportação, importação e impressão](#exportação-importação-e-impressão)
- [Privacidade e limites operacionais](#privacidade-e-limites-operacionais)
- [Arquitetura do projeto](#arquitetura-do-projeto)
- [API e comunicação](#api-e-comunicação)
- [Testes e exemplos reproduzíveis](#testes-e-exemplos-reproduzíveis)
- [Documentação complementar](#documentação-complementar)

## Início rápido

**Hospedagem web:** o frontend pode ser publicado na Vercel com `npm run build:web`. O servidor Node/Socket.IO roda em uma instância contínua HTTPS; configure `ATTOBRAIN_SERVER_URL` na Vercel e `ALLOWED_ORIGINS` no servidor. Assim, o link do aluno funciona entre computadores em redes diferentes. Veja o [guia completo de hospedagem e compartilhamento](docs/HOSPEDAGEM-WEB.md).

### Requisitos

- Node.js 22 ou superior.
- npm.
- Navegador moderno com suporte a Canvas e Socket.IO.

### Instalação e execução

Na raiz do repositório:

```sh
npm ci
npm start
```

O servidor local inicia na porta `3000`. Acesse:

- `http://localhost:3000/` — painel inicial.
- `http://localhost:3000/profissional` — fluxo de preparação, controle e resultados.
- `http://localhost:3000/aluno` — tela do participante, aberta pelo link temporário da sessão.
- `http://localhost:3000/api/protocol` — catálogo JSON do protocolo e dos comandos disponíveis.

O painel inicial não cria uma sessão por conta própria. Entre em **Labirinto**, escolha um aluno demonstrativo e siga a preparação. Cadastros de demonstração ficam no `localStorage` do navegador e não são banco de dados.

### Apresentar com duas telas

Na etapa de revisão, selecione **Abrir tela do aluno** ou copie o link temporário e abra em outra janela. Mantenha as duas telas visíveis, lado a lado. A atividade só começa quando a tela do aluno estiver conectada e visível. Ocultar a janela, perder a conexão ou detectar uma interrupção técnica pausa a atividade. A retomada é autorizada pelo profissional.

Para dois dispositivos na mesma rede, abra `/profissional` no computador servidor e substitua `localhost` pelo IP local desse computador no navegador do outro dispositivo. Compartilhe o link do aluno gerado pelo sistema. Os dois dispositivos precisam alcançar a porta `3000`; o software não configura firewall. Para compartilhar pela internet, siga o guia de hospedagem com HTTPS e origens autorizadas. As credenciais temporárias não são autenticação institucional.

## O que o sistema faz

| Área | Funcionamento |
| --- | --- |
| Painel e navegação | Reúne Início, Alunos e Labirinto na identidade visual Attobrain. O menu lateral pode ser expandido ou recolhido. |
| Participante demonstrativo | Permite selecionar um cadastro local no navegador. O servidor congela somente o identificador, nome e indicação de demonstração usados na sessão. |
| Preparação | Valida participante e configuração, apresenta uma prévia dos labirintos e confirma parâmetros antes de abrir a atividade. |
| Tela do profissional | Controla conexão, preparação, iniciar, pausar, retomar, avançar, interromper e consultar o perfil da sessão. |
| Tela do aluno | Mostra espera, instruções, labirinto, marcador, pausa e conclusão. A entrada do mouse representa um alvo de controle, não o olhar. |
| Sessão ao vivo | Sincroniza estado, trajetória e eventos entre navegador do profissional, navegador do aluno e servidor com Socket.IO. |
| Perfil de resultados | Apresenta resumo, comparação, evidências e dados técnicos em abas navegáveis por teclado. |
| EEG sintético | Demonstra canais e processamento de sinais artificiais em área técnica recolhida. Não participa dos resultados comportamentais. |
| Arquivos | Exporta sessão JSON v4 autenticada, importa v2/v3 em modo histórico e v4 com validação, permite notas profissionais e prepara impressão. |

## Fluxo da atividade

### Protocolo guiado

O protocolo padrão percorre:

```text
Selecionar aluno → Configurar → Revisar → Treinamento → A → intervalo → B → intervalo → C → Resultados
```

Na revisão, o profissional confere a prévia e abre a tela do aluno. **Iniciar sessão** prepara o protocolo; **Iniciar atividade** começa cada percurso. O servidor controla as transições e exige a conexão recente e visível do aluno. Entre A/B e B/C há um intervalo de 30 a 45 segundos e o profissional confirma o avanço. O treinamento pode ser repetido até sete vezes e fica fora das comparações A/B/C.

Exploração é um fluxo separado de quatro etapas com semente livre e sem tendência A/B/C. Uma interrupção antecipada solicita confirmação e motivo; ela gera um resultado parcial quando há dados disponíveis. Conclusão, timeout e abandono são estados diferentes.

### Estados e sincronização

A sessão e cada execução têm estados explícitos, incluindo espera, preparação, execução, pausa e conclusão/interrupção. O relógio do servidor conta apenas tempo ativo. Pausas e seus motivos permanecem na linha do tempo. Comandos carregam identificador e revisão esperada para rejeitar repetições ou comandos baseados em uma tela desatualizada. Reconexões retomam a sessão existente quando sua credencial ainda está válida.

Cada sessão temporária tem credencial separada para profissional e aluno. Uma sessão aceita um participante conectado por papel; conexões extras não substituem o controlador silenciosamente. O aluno envia entrada e presença da tela. Ele não recebe participante, notas, interpretação, métricas profissionais ou o relatório.

### Navegação dos resultados

1. **Resumo:** perfil objetivo, qualidade dos dados, observações automáticas, dimensões, itens para revisão e notas do profissional.
2. **Comparação:** tabela e gráficos para atividades compatíveis e métricas elegíveis.
3. **Evidências:** trajetórias, episódios de contato, eventos, recuperações e inspeção temporal.
4. **Dados técnicos:** valores calculados, suporte, elegibilidade, proveniência, dados brutos e demonstração EEG.

As abas respondem a setas esquerda/direita, `Home` e `End`. Cada observação permite abrir a justificativa, os critérios, os valores e os registros que a sustentam. Um atalho de evidência leva à atividade e ao instante correspondente. Notas profissionais são separadas do texto automático e preservadas ao alternar abas e exportar.

## Labirinto e controle

O servidor gera e guarda a geometria e a semente de cada execução. Os níveis guiados disponíveis são 7×7 e 10×10, além da opção fixa padrão do protocolo. As atividades A/B/C usam um conjunto versionado; exploração permite semente livre. A prévia reutiliza o gerador da execução.

O navegador do aluno acompanha a posição do mouse dentro da área do labirinto e envia coordenadas normalizadas. O servidor trata essas coordenadas como alvo: move um marcador com velocidade limitada, aplica raio, paredes, subpassos e colisão por eixo, permitindo deslizar junto às paredes. Sair do quadro interrompe o movimento; voltar fornece outro alvo sem teletransporte. A chegada só é confirmada quando o marcador controlado pelo servidor alcança a saída.

Parâmetros atuais do motor: quadro lógico quadrado, velocidade de `0,25` largura do quadro por segundo, raio do marcador de `0,01`, parede de `0,005`, motor a 60 passos por segundo e envio de entrada/estado até 20 vezes por segundo. Entrada sem atualização por 500 ms interrompe o movimento; falha prolongada pausa a atividade. Esses números são parâmetros de engenharia do protótipo, não calibração humana.

O registro mantém separadamente entrada do mouse/alvo e trajetória aceita do marcador. Inclui checkpoints, distâncias, pausas, tempos, direção, colisões, eventos e horários ativos/de sessão. A geração e aquisição são determinísticas a partir da configuração e semente registradas.

## Resultados e interpretação

O perfil é calculado localmente a partir da execução do labirinto por regras determinísticas versionadas. Ele descreve os eventos observados e explica as evidências; não infere causas, diagnóstico ou capacidade cognitiva. Dados curtos, ausentes, incompletos ou incompatíveis exibem limitações em vez de serem apresentados como zero.

### Contatos e recuperação

O sistema mantém três contagens com significados diferentes:

- **Contatos por parede:** registros por superfície; a mesma parede precisa de separação mínima de 200 ms ativos para gerar novo registro.
- **Eventos de colisão:** eventos únicos do motor; um evento pode envolver mais de uma parede.
- **Episódios de colisão:** sequência de contato até uma recuperação observada ou até o acompanhamento ser censurado.

Um episódio é considerado recuperado após 500 ms ativos sem novo contato e redução mínima de `0,01` largura do quadro na distância restante pelo grafo. Pausa, lacuna de entrada ou término sem recuperação marca o episódio como censurado. Ele permanece na contagem observada, mas não entra na mediana de recuperação.

### Métricas e suficiência

Cada métrica tem valor, unidade, definição e versão, origem, suporte, elegibilidade, motivo e limitações. Os estados são `eligible`, `limited`, `insufficient` e `unavailable`. O valor técnico pode ser consultado mesmo quando não tem suporte para interpretação.

Critérios operacionais atuais incluem 30 segundos ativos e cobertura de 80% para velocidade/baixa movimentação; 40 janelas válidas de 500 ms para CV suavizado; 60 segundos para taxa de episódios por minuto; 45 segundos e 15 segundos válidos por terço para comparação temporal; três recuperações completas para mediana; e percurso concluído para eficiência no grafo. São parâmetros de engenharia sem validação clínica ou significância estatística.

Eficiência da rota no grafo e excedente no grafo usam distâncias entre células válidas. A eficiência não mede precisão lateral nem ausência de contato. A densidade usa episódios por dez larguras de corredor de referência. CV suavizado usado na interpretação é diferente do CV por passo disponível para inspeção técnica.

Comparações exigem conjunto, versão, semente, geometria e parâmetros compatíveis. Treinamento fica separado; comparações A/B/C usam percursos concluídos. Como ainda não há mapeamento de regiões equivalentes entre labirintos, recorrência espacial entre atividades aparece como indisponível. As regras agrupam observações equivalentes e selecionam no máximo cinco para o resumo. Todas incluem referências a execuções, episódios, eventos ou instantes quando aplicável.

Dimensões do perfil incluem controle, regularidade, recuperação, continuidade e consistência. Os estados disponível, parcial ou insuficiente mostram o suporte e a explicação. Questões para revisão são modelos vinculados aos padrões registrados; não atribuem causalidade.

## EEG demonstrativo

O módulo técnico gera um sinal de EEG totalmente sintético, reproduzível por semente. Configurações suportam 1, 4 ou 8 canais virtuais V1–V8 e taxas de 250 ou 500 Hz, com oscilações e ruído artificiais, artefatos programados e modo didático interativo. Um worker gera blocos sem bloquear a interface; processamento demonstra janela Hann, FFT, PSD unilateral e bandas delta, theta, alpha, beta e gamma baixa.

> **EEG SINTÉTICO — não representa a atividade cerebral do participante.**

O modo de modulação interativa é didático e não tem equivalência fisiológica. Contatos podem disparar uma rajada artificial associada ao evento. Canais, PSD, bandas, buffers e artefatos ficam nos Dados técnicos. Nenhum valor EEG sintético é usado para progresso, métricas ou interpretação comportamental.

## Exportação, importação e impressão

### JSON v4

A exportação inclui manifesto de versões, configurações, participante demonstrativo mínimo, motivo de encerramento, registros brutos, trajetória, métricas, qualidade, episódios, eventos, observações, evidências, notas e dados sintéticos disponíveis. Credenciais temporárias não são incluídas. O download é autenticado por credencial profissional no cabeçalho e transmitido em partes.

A importação v4 valida a estrutura, métricas, sessões, episódios, sequências de eventos e referências cruzadas antes de exibir os resultados. JSON v2/v3 é aceito em modo histórico e somente leitura; a análise original é preservada e não há recálculo silencioso. v2 sem relatório permite inspecionar os registros originais. Versões anteriores não suportadas são rejeitadas com uma mensagem.

Importar um relatório não altera a sessão conectada. Os arquivos de importação têm limite de 512 MiB e usam memória do navegador. Exporte resultados antes de encerrar ou reiniciar o servidor, pois os dados ativos não são persistentes.

### Impressão

A impressão prioriza resumo, observações, comparação elegível, limitações e notas. Detalhes técnicos podem ser incluídos por opção. O JSON bruto não é despejado na impressão. A janela de impressão do navegador pode variar conforme o navegador utilizado.

## Privacidade e limites operacionais

- Sessões e trajetórias são mantidas temporariamente na memória do servidor; não há banco de dados nem persistência após reinício.
- São aceitas até quatro sessões simultâneas e até 30 minutos de execução total por sessão. Sessões sem conexão são removidas após 30 minutos.
- A credencial profissional protege exportação e inspeção temporal. Credenciais não entram nos JSON exportados nem nos logs estruturados do servidor.
- O servidor recebe do aluno a entrada do mouse e presença/visibilidade da tela. Não há câmera, rastreador ocular, sensor EEG real ou integração de hardware.
- O aluno recebe somente a projeção destinada à sua tela; informações profissionais e resultados são isolados.
- O protótipo local não oferece login institucional, prontuário, armazenamento clínico, criptografia de banco, autorização organizacional, alta disponibilidade ou escala de produção.
- Não é um instrumento validado, não diagnostica TDAH ou desatenção e não compara o participante a normas clínicas.
- Equivalência de geometria do labirinto não garante equivalência de dificuldade humana.

## Arquitetura do projeto

Aplicação sem framework de frontend, em JavaScript, Node.js, HTML e CSS. Socket.IO é usado para comunicação em tempo real; `fft.js` fornece a FFT demonstrativa. Os contratos TypeScript são documentação e não requerem compilador.

| Caminho | Responsabilidade |
| --- | --- |
| `index.js` | Servidor HTTP, entrega das páginas/arquivos e rotas JSON. |
| `engine.js` | Geração de labirinto, grafo, solução, movimento e colisão. |
| `realtime.js` | Ponto de entrada de compatibilidade para comunicação em tempo real. |
| `src/domain/session.js` | Estado de sessão, execução, relógio, eventos, pausas e aquisição. |
| `src/domain/contacts.js` | Política compartilhada de paredes, eventos e episódios de contato. |
| `src/domain/metrics.js` | Cálculos puros das métricas observadas. |
| `src/domain/analysis/` | Política de suficiência, qualidade, comparabilidade, regras, evidências e relatório. |
| `src/domain/session-projection.js` | Projeções por papel e esquema da exportação v4. |
| `src/controllers/realtime.js` | Associação de papéis, permissões, presença, comandos e eventos Socket.IO. |
| `src/repositories/sessions.js` | Retenção limitada de sessões temporárias em memória. |
| `src/services/` | EEG sintético, worker, FFT/Welch, exportação e inspeção temporal. |
| `src/validators/` e `src/types/` | Validação de configurações e contratos para provedores futuros. |
| `public/modules/` | Interface, navegação, canvas do labirinto, abas, gráficos, resultados e importação. |
| `public/modules/styles/report.css` | Abas, cartões, evidências, responsividade e impressão. |
| `assets/` | Marca, ícones, sinais demonstrativos e ilustrações decorativas. |
| `scripts/verify-protocol.js` | Execução automatizada reproduzível do protocolo completo ou parcial. |
| `src/tests/` | Testes de domínio, interpretação, exportação, importação, interfaces e sinais. |

Dados de aluno demonstrativo são mantidos pelo navegador na chave `attobrain-students` do `localStorage`. O servidor não usa esse armazenamento como banco e guarda apenas o mínimo necessário para a sessão atual.

## API e comunicação

`GET /api/protocol` publica o catálogo real de transportes, eventos, comandos, defaults e formatos HTTP. O transporte em tempo real usa Socket.IO via WebSocket: mesma origem localmente ou servidor HTTPS configurado na publicação. O fluxo cria ou restaura uma sessão e associa uma credencial ao papel profissional ou aluno. Comandos profissionais incluem `commandId` e `expectedRevision`; entradas do aluno incluem `runId`, sequência, coordenadas normalizadas e estado dentro/fora do quadro. A presença periódica informa se a página do aluno está visível.

Rotas HTTP documentadas pelo catálogo:

- `GET /api/sessions/:id/export` — exportação v4 com `Bearer` profissional.
- `GET /api/sessions/:id/inspect?time=...` — inspeção somente leitura e janela EEG limitada, também com credencial profissional.

A lista de mensagens e o contrato detalhado devem ser consultados em `/api/protocol`, evitando depender de exemplos desatualizados neste README.

## Testes e exemplos reproduzíveis

Executar a suíte automatizada:

```sh
npm test
```

Gerar carga de amostras e janelas espectrais em tempo acelerado:

```sh
npm run test:soak
```

Gerar fixture JSON reproduzível usando o motor e relógio acelerado:

```sh
node scripts/verify-protocol.js caminho-completo.json
node scripts/verify-protocol.js caminho-curto.json --short --contacts
node scripts/verify-protocol.js caminho-parcial.json --short --contacts --partial
```

As fixtures são entradas automatizadas, não participantes reais. Os testes cobrem geometria e colisão, transições, pausa, sincronização, permissões, métricas, elegibilidade, episódios, comparabilidade, evidências, privacidade, exportação/importação, worker EEG e potência de sinais conhecidos. Eles não substituem ensaio com participantes, avaliação clínica ou validação de hardware.

## Documentação complementar

- [Resultados v4: fórmulas, limites, elegibilidade e compatibilidade](docs/RESULTADOS-V4.md)
- [Fluxo guiado, critérios e contratos](docs/FLUXO-GUIADO.md)
- [Protocolo e fórmulas](docs/PROTOCOLO.md)
- [Plano consolidado do MVP](docs/PLANO-MVP.md)
- [Relatório de entrega e limites da validação](docs/ENTREGA-MVP.md)
- [Descrição da simulação anterior](SIMULACAO.md) — documento histórico, não substitui as definições atuais de resultados v4.

O MVP serve à demonstração acadêmica da experiência do labirinto e do processamento de dados simulados. Persistência, autenticação institucional, integração com sensor real, validação científica e qualquer aplicação clínica exigem etapas de projeto e avaliação próprias.
