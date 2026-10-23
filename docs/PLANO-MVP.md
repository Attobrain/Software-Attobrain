# Attobrain — evolução incremental para um MVP multimodal

## 1. Objetivo, limites e decisões principais

Evoluir o projeto atual para executar **treinamento + três atividades avaliativas**, registrar o comportamento durante cada percurso e apresentar resultados comparativos, acompanhados de EEG sintético sincronizado.

A implementação continuará em HTML, CSS, JavaScript, Node.js e Socket.IO. Será preservado o estilo do Figma: menu lateral deslizável, degradê da marca, fundo claro e cartões com hierarquia simples.

As quatro categorias de informação serão identificadas explicitamente:

| Categoria | Conteúdo |
|---|---|
| Medição | Posição do mouse, movimento do indicador, contatos, tempos e eventos |
| Descrição automática | Frases calculadas por regras documentadas |
| Simulação | EEG artificial, suas características espectrais e artefatos |
| Observação profissional | Texto escrito pelo profissional, separado das descrições automáticas |

Não haverá banco de dados, aquisição real de sensores, classificação clínica ou índice composto de atenção nesta evolução.

Os parâmetros de duração, dificuldade e detecção de comportamento serão **escolhas experimentais de engenharia**, registrados no relatório. As citações internas do texto anexado não serão tratadas como referências verificadas; a documentação deverá usar fontes identificáveis e acessíveis.

---

## 2. Diagnóstico do código atual

A inspeção confirmou os seguintes componentes.

| Componente atual | O que existe | Evolução necessária |
|---|---|---|
| `index.js` | Servidor HTTP, rotas profissional/aluno/legado e Socket.IO | Preservar; acrescentar entrega dos módulos e exportações necessárias |
| `engine.js` | Geração por semente, geometria, solução do labirinto, movimento limitado e colisões | Tornar parâmetros explícitos, produzir metadados e registrar transições entre células |
| `realtime.js` | Sessões em memória, credenciais por papel, estados, eventos, métricas e exportação | Separar responsabilidades e introduzir protocolo com múltiplas execuções |
| `live.js` | Duas interfaces, captura do mouse, desenho Canvas, controles e relatório simples | Separar entrada, renderização, gráficos e apresentação de resultados |
| `navigation.js` e estilos | Menu compartilhado e identidade visual atual | Reutilizar, acrescentando etapas do protocolo e acesso ao consolidado |
| `maze.js` e telas legadas | Primeira implementação e antigo gerador sintético | Preservar como legado; não usar suas fórmulas como base científica |
| Testes atuais | Quatro testes do motor e um teste integrado de sessão | Ampliar com relógio controlável, métricas, protocolo, EEG e reconexão |

### Correções identificadas

1. **EEG atual:** o painel desenha uma senoide fixa. Não existe aquisição sintética contínua, buffer, multicanal, PSD ou histórico espectral.
2. **Relógio:** o tempo ativo soma passos limitados a 50 ms. Uma demora do processo pode reduzir o tempo contabilizado silenciosamente.
3. **Pausas:** eventos usam tempo ativo, que não avança durante a pausa. Falta um segundo relógio para reconstruir sua duração e localização na sessão.
4. **Rede:** snapshots retransmitem a trajetória inteira aproximadamente 20 vezes por segundo. O custo cresce com a duração.
5. **Entrada:** faltam identificadores de execução nas amostras; mensagens atrasadas podem ser confundidas com a atividade seguinte.
6. **Contatos:** o código agrega contatos por parede, mas reinicializa seu controle ao retomar. É necessário formalizar episódios e sua interrupção por pausas.
7. **Baixa movimentação:** há contagem por janelas, mas não localização completa, encerramento explícito ou duração parcial ao terminar.
8. **Resultados:** não existem eficiência, recuperação, retrocessos, comparações entre tentativas ou resumo auditável.
9. **Sessões:** não há política de expiração ou limite de memória.
10. **Frontend:** métricas são reconstruídas frequentemente e parte da apresentação depende de conteúdo duplicado em grandes templates.

Esses itens serão tratados incrementalmente. O fluxo atual permanecerá utilizável ao final de cada etapa.

---

## 3. Novo protocolo de sessão

### Configuração padrão

| Etapa | Padrão | Faixa configurável |
|---|---:|---:|
| Treinamento | Até 75 segundos | 60–90 segundos |
| Atividade A | Até 210 segundos | 180–240 segundos |
| Pausa entre atividades | Mínimo de 35 segundos | 30–45 segundos |
| Atividade B | Até 210 segundos | 180–240 segundos |
| Pausa entre atividades | Mínimo de 35 segundos | 30–45 segundos |
| Atividade C | Até 210 segundos | 180–240 segundos |

Esses tempos são limites operacionais, não duração obrigatória nem protocolo validado. Uma conclusão antecipada encerra aquela execução; o software não prolongará artificialmente um labirinto concluído.

### Fluxo definido

1. Profissional configura protocolo, nível, conjunto de labirintos e modo EEG.
2. Aluno conecta-se e recebe instrução curta.
3. Profissional prepara e inicia o treinamento.
4. Treino termina por conclusão, limite ou comando do profissional.
5. Profissional confirma o avanço para A.
6. Cada atividade produz resultado individual congelado.
7. Entre A/B e B/C, o aluno vê uma espera neutra; o profissional consulta o resultado.
8. A próxima atividade exige término da pausa mínima e comando explícito.
9. Após C, ou após encerramento global, o profissional recebe o consolidado.

### Estados e interrupções

Manter os estados existentes por execução e adicionar `TIMED_OUT`, distinguindo limite de tempo de encerramento manual.

A sessão terá uma fase separada: preparação, treinamento, avaliação, intervalo e encerramento.

- Pausa manual ou técnica preserva a execução.
- Desconexão pausa imediatamente quando detectada.
- Retomar nunca inicia automaticamente.
- Encerrar uma execução permite continuar o protocolo, registrando-a como incompleta.
- Encerrar a sessão produz consolidado parcial e identifica atividades não realizadas.
- Repetir o treinamento será permitido, preservando suas tentativas e excluindo todas do consolidado.
- A/B/C não poderão ser substituídas silenciosamente. Repetir uma avaliação exigirá uma nova sessão.
- Reinício global exigirá confirmação e aviso para exportar.

### Comparabilidade dos labirintos

A escolha livre de sementes continuará disponível em **modo de exploração**, separado do protocolo comparativo.

Para o protocolo:

- Criar conjuntos versionados com três labirintos do mesmo tamanho.
- Manter corredor, raio, velocidade e regras iguais.
- Selecionar candidatos com comprimento de solução e quantidade de curvas dentro de ±10%; becos sem saída dentro de ±15%.
- Utilizar o mesmo número de checkpoints nos três percursos.
- Registrar os valores exatos, mesmo quando dentro das tolerâncias.
- Gerar e revisar os conjuntos antes da execução; não pesquisar indefinidamente candidatos durante uma sessão.
- Se não houver conjunto aprovado, impedir comparação automática e oferecer exploração.

A equivalência será denominada **equivalência geométrica operacional**. Ela não comprova igualdade de dificuldade para pessoas.

---

## 4. Arquitetura e contratos

### Separação de responsabilidades

Organizar pequenos módulos com funções explícitas:

| Módulo | Responsabilidade |
|---|---|
| Relógio da sessão | Tempo monotônico, pausas e conversão temporal |
| Gerenciador do protocolo | Treino, A/B/C, intervalos e encerramento |
| Motor do labirinto | Movimento, geometria, colisões e checkpoints |
| Provedor de entrada | Coordenadas, validade e sequência |
| Registro de eventos | Ordenação e associação à execução |
| Motor de métricas | Cálculos puros e reproduzíveis |
| Provedor EEG | Geração de blocos sintéticos |
| Processamento espectral | PSD, bandas e qualidade técnica |
| Relatório | Consolidação e frases auditáveis |
| Interface | Controles, gráficos e seleção temporal |

`realtime.js` passará a coordenar esses módulos, mantendo Socket.IO. O motor existente será reaproveitado.

### Fontes intercambiáveis

Definir interfaces pequenas para:

- `MouseInputProvider`: implementado agora.
- `GazeInputProvider`: contrato reservado, sem captura.
- `SyntheticEEGProvider`: implementado agora.
- `RealEEGProvider`: contrato reservado, sem conexão.

Entrada deverá fornecer posição, validade, origem e timestamps. EEG deverá fornecer blocos com canal, frequência, unidade, índice inicial e amostras.

Nenhum provedor poderá enviar diretamente um diagnóstico ou alterar métricas comportamentais.

### Identificadores e eventos

Cada registro terá:

- `schemaVersion`, `sessionId` e `runId`;
- sequência e origem;
- tipo e dados;
- tempo monotônico da sessão;
- tempo ativo da execução, quando aplicável.

Comandos administrativos terão identificador próprio e resposta confirmada. Reenvios do mesmo comando retornarão o resultado anterior, sem repetir efeitos.

Amostras de entrada terão sequência crescente por conexão e execução. Amostras antigas, inválidas ou de outra execução serão descartadas e contabilizadas.

### Dois relógios

- **Tempo da sessão:** avança durante atividade, pausa e intervalo; permite sincronização multimodal.
- **Tempo ativo:** avança somente durante a execução válida da tarefa.

Data/hora UTC será metadado de início, não base para cálculos de duração.

A chegada da mensagem será registrada separadamente do instante informado pelo cliente. Para o mouse, o motor continuará operando no tempo do servidor. O desvio estimado entre relógios será técnico, sem alegação de sincronização de hardware.

### Frequências e transporte

- Motor: passos fixos de 60 Hz.
- Entrada: até 20 Hz.
- Estado visual: até 20 Hz.
- Métricas visíveis: até 4 Hz.
- EEG: blocos a cada 100 ms.
- PSD e bandas: atualização a cada segundo.
- Canvas: `requestAnimationFrame`, sem reconstruir toda a interface.

Enviar somente novos trechos de trajetória e eventos. Snapshot completo será usado na associação e reconexão.

Atraso excessivo do motor produzirá evento técnico e pausa, em vez de descartar tempo silenciosamente ou executar uma recuperação longa em um único quadro.

---

## 5. Definições das métricas

### Convenções

- Posições normalizadas no quadro.
- Distância em larguras do quadro.
- Movimento refere-se ao **indicador aceito pelo motor**.
- Entrada do mouse será armazenada separadamente.
- Pausas e períodos tecnicamente inválidos serão excluídos das métricas de movimento.
- Zero será usado somente quando o valor foi observado; ausência será `null`, acompanhada de motivo.
- Cada resultado registrará a versão das fórmulas.

### Métricas por execução

| Indicador | Fórmula e dados | Unidade e apresentação | Regras e limites |
|---|---|---|---|
| Tempo ativo | Soma dos intervalos de execução válida | Segundos; cronômetro | Exclui pausas técnicas e manuais |
| Tempo pausado | Soma de `fim − início` das pausas | Segundos, quantidade e motivos | Pausa aberta fecha no encerramento |
| Conclusão | Indicador alcança a região final após checkpoints | Concluída, interrompida ou limite | Não inferir conclusão apenas por percentual |
| Progresso | Checkpoints válidos atingidos ÷ total | Percentual e contagem | Registrar 100% somente na chegada |
| Distância real | `Σ‖pᵢ − pᵢ₋₁‖` dos movimentos aceitos | Larguras do quadro | Não conectar pontos separados por pausa ou lacuna |
| Caminho de referência | Menor caminho entre início e fim no grafo das células | Larguras do quadro | Identificado como referência central dos corredores |
| Distância no grafo | Soma dos comprimentos das transições reais entre células | Larguras do quadro | Capturar transições dentro dos subpassos do motor |
| Eficiência | `100 × Lreferência / Lgrafo` | Percentual | Somente para execução concluída e denominador positivo |
| Distância excedente | `Lgrafo − Lreferência`; percentual relativo à referência | Distância e percentual | Somente em execuções concluídas |
| Velocidade média | Distância aceita ÷ tempo válido | Larguras/s | Incluir zeros válidos; excluir dados ausentes |
| Variabilidade | Desvio-padrão e `CV = DP / média` | Larguras/s e razão | Média próxima de zero: CV indisponível |
| Contatos | Episódios independentes de bloqueio do indicador | Contagem | Contato contínuo com a mesma parede conta uma vez |
| Frequência de contatos | Contatos ÷ minutos válidos; contatos ÷ distância | Contatos/min e contatos/largura | Denominador zero: indisponível |
| Distribuição espacial | Eventos agrupados por célula e parede | Mapa com contagens | Cores representam frequência, não gravidade |
| Recuperação | Tempo ativo entre início do contato e retomada definida | Mediana, quartis e quantidade válida | Episódios sem recuperação ficam censurados |
| Baixa movimentação | Velocidade abaixo de 0,005 largura/s por ≥2 s | Episódios, duração e localização | Limiar operacional configurável |
| Retrocessos | Transições que aumentam a distância no grafo até a saída | Quantidade e distância | Agrupar transições consecutivas em episódio |
| Mudanças de direção | Ângulo ≥60° entre segmentos com deslocamento ≥0,01 | Contagem | Comparar com curvas do percurso; não chamar de erro |

### Cuidados com eficiência

A solução atual segue centros de células, enquanto o indicador pode cortar curvas dentro do corredor. Comparar diretamente essa referência com a distância contínua pode produzir eficiência superior a 100%.

Por isso, a primeira versão usará **eficiência no grafo**, com numerador e denominador calculados na mesma geometria. A distância contínua permanecerá visível separadamente.

Um menor caminho contínuo considerando o raio do indicador será melhoria P2. Não será aplicada uma limitação artificial a 100% para esconder inconsistências.

### Contatos e recuperação

- O episódio começa no primeiro bloqueio.
- A mesma parede só inicia novo contato após 200 ms sem contato.
- Contatos simultâneos em um canto serão preservados por parede, mas formarão um único episódio para recuperação.
- Recuperação exige 500 ms sem contato e redução de pelo menos 0,01 largura na distância navegável até a saída.
- Novo contato antes da recuperação mantém o episódio aberto.
- Pausa técnica encerra a observação como interrompida; não será calculada recuperação atravessando a lacuna.
- Final sem recuperação será mostrado como “sem recuperação observada”, nunca como zero.

### Baixa movimentação

Reamostrar a trajetória válida em intervalos de 50 ms e usar velocidade suavizada em janela de 500 ms.

Guardar início, fim, duração, posição média e maior dispersão do episódio. Fechar episódios ao movimentar, pausar ou encerrar. Intervalos inferiores ao mínimo não serão contados.

### Evolução temporal e entre atividades

- Dividir cada execução em três terços de tempo ativo.
- Calcular por terço: contatos/min, velocidade média, CV, tempo em baixa movimentação e avanço de checkpoints.
- Terços com menos de cinco segundos válidos serão apresentados sem conclusão automática.
- Comparar A/B/C por métricas normalizadas e configurações compatíveis.
- Mostrar mediana, amplitude e CV entre tentativas quando matematicamente definido.
- Não apresentar três tentativas como estimativa de confiabilidade clínica.

---

## 6. Regras das descrições automáticas

Criar um mecanismo determinístico. Cada frase guardará `ruleId`, versão, métricas usadas, execuções elegíveis e valores comparados.

| Descrição | Critério |
|---|---|
| “Redução progressiva dos contatos por minuto” | A > B > C e redução A→C de pelo menos 10% |
| “Aumento da eficiência entre as atividades” | A < B < C e aumento total de pelo menos 5 pontos percentuais |
| “Valores semelhantes entre atividades” | Amplitude ≤5 pontos para eficiência ou ≤10% da mediana para taxas |
| “Oscilação entre atividades” | Mudanças de sentido acima das tolerâncias definidas |
| “Maior variabilidade no trecho final” | CV final ≥1,2 × CV inicial, com dados elegíveis |
| “Baixa movimentação concentrada na segunda metade” | Pelo menos 2 s de episódios e ≥60% de sua duração nessa metade |

Regras de tendência entre três execuções exigirão três atividades comparáveis e concluídas. Com duas, haverá apenas comparação entre pares. Com dados insuficientes, a interface informará essa condição.

Não gerar uma conclusão global de “melhora” quando métricas divergem. O resumo poderá registrar, por exemplo, redução de contatos acompanhada de aumento do tempo.

As tolerâncias serão documentadas como critérios de redação do software, não significância estatística ou limites clínicos.

---

## 7. EEG sintético multicanal

### Escolha técnica

Implementar um gerador próprio em JavaScript, executado em um `worker_thread` do Node.js. Isso evita bloquear o motor e mantém uma instalação simples.

BrainFlow oferece placa sintética e funções de processamento espectral, mas sua adoção agora acrescentaria outra camada de instalação e integração. Será uma alternativa P2, atrás do mesmo contrato de provedor. Referências: [placas suportadas](https://brainflow.readthedocs.io/en/stable/SupportedBoards.html) e [API de processamento](https://brainflow.readthedocs.io/en/stable/UserAPI.html).

### Configuração

- Padrão: oito canais `V1` a `V8`.
- Opções: 1, 4 ou 8 canais; 250 ou 500 Hz.
- Unidade: µV sintéticos.
- Semente própria, separada da semente do labirinto.
- Configuração congelada ao iniciar o protocolo.

A referência de oito canais a 250 Hz é compatível com a configuração padrão documentada do Cyton, sem representar integração realizada ou montagem de eletrodos. [Documentação OpenBCI](https://docs.openbci.com/FAQ/HowProductsGoTogether/).

### Modelo do sinal

Para cada canal:

`x(t) = soma de componentes oscilatórias + ruído colorido + ruído branco + artefatos programados`

Componentes centrais iniciais: 2, 6, 10, 20 e 38 Hz, com amplitudes, fases e pequenas variações lentas distintas por canal.

- Ruído colorido terá algoritmo e parâmetros versionados.
- Artefatos opcionais: pulso lento, rajada de ruído e interferência de 50/60 Hz.
- Cada artefato terá intervalo, canais e parâmetros registrados.
- Os canais virtuais não receberão nomes anatômicos.
- “Qualidade” significará integridade técnica e presença de artefatos sintéticos conhecidos.

### Modos

**Independente — padrão**

A geração depende somente da configuração, semente e tempo. Alterar movimentos do mouse não modifica o sinal.

**Interativo — didático**

Eventos selecionados alteram artificialmente amplitudes ou inserem artefatos. Exemplo: contato com parede produz uma rajada predefinida de um segundo.

Toda modulação terá evento próprio com referência ao evento do jogo. Tela e exportação mostrarão: **“Modulação didática — sem equivalência fisiológica”**.

O modo ficará fixo durante a sessão para evitar comparar trechos de origens diferentes.

### PSD e bandas

- Buffer de análise: últimos oito segundos por canal.
- Segmentos de Welch: potência de dois mais próxima de dois segundos de amostragem — 512 amostras a 250 Hz e 1.024 a 500 Hz.
- Janela Hann, sobreposição de 50%, remoção da média por segmento.
- PSD unilateral em µV²/Hz, normalizada pela frequência de amostragem e energia da janela.
- Atualização a cada segundo, quando houver buffer completo.
- Lacunas invalidam a janela; não preencher silêncio artificialmente.

Bandas: delta 1–4, theta 4–8, alpha 8–13, beta 13–30 e gamma baixa 30–45 Hz. Integrar sem duplicar bins de fronteira.

- Potência absoluta: integral da PSD na banda, em µV².
- Potência relativa: potência da banda ÷ potência total de 1–45 Hz.
- Denominador nulo: resultado indisponível.
- Guardar número de segmentos, janela temporal, parâmetros e qualidade.
- Não incluir TBR no painel principal; fica reservado como opção técnica P2.

A biblioteca FFT escolhida deverá ser pequena, isolada no módulo espectral e ter licença compatível; a implementação não reescreverá uma FFT do zero.

### Geração e desempenho

Gerar blocos a partir do índice de amostra, evitando depender da precisão de um temporizador a cada 4 ms.

EEG continuará durante pausas e intervalos, usando o tempo da sessão. Os trechos serão marcados para análise por fase.

O gráfico mostrará envelope mínimo/máximo por coluna de pixels; as amostras originais continuarão disponíveis para exportação.

---

## 8. Interface profissional, aluno e resultados

### Profissional

Preservar as duas colunas principais: percurso e acompanhamento.

Adicionar uma faixa compacta com:

- Treinamento / A / intervalo / B / intervalo / C.
- Estado, tempo ativo, limite e conexão.
- Acesso à configuração antes do início.

Manter quatro indicadores principais: tempo, progresso, contatos e recuperação. Eficiência final, baixa movimentação e variabilidade aparecerão em detalhes e resultados.

O EEG terá um cartão secundário com um canal selecionado e rótulo persistente de simulação. O painel técnico conterá oito canais, PSD, bandas, artefatos e parâmetros.

### Aluno

- Espera, instrução, percurso e estado.
- Identificação simples da etapa, sem métricas ou comparações.
- Pausas com mensagem neutra.
- Conclusão antecipada e limite de tempo com comunicação sem julgamento.
- Preservar menu recolhido, tela cheia e redução de movimento.

### Resultados individuais

- Situação e qualidade dos dados.
- Métricas com unidades e definições acessíveis.
- Trajetória com contatos e períodos de baixa movimentação.
- Eventos selecionáveis.
- Observações do profissional.
- Botão de avanço disponibilizado conforme o protocolo.

### Consolidado

- Conclusões A/B/C e atividades ausentes.
- Resumo automático com acesso aos critérios.
- Tabela comparativa e gráficos de eficiência, contatos/min e CV.
- Seleção de trajetória por atividade.
- Linha do tempo sincronizada.
- Treinamento em seção separada, excluído dos agregados.
- Exportação estruturada e visualização adequada para impressão.

### Seleção temporal e reprodução

Selecionar um evento deverá atualizar o marcador da trajetória, destacar o intervalo e carregar a janela EEG correspondente.

A reprodução será somente leitura, com velocidades 0,5×, 1× e 2×. Importar um arquivo não poderá iniciar comandos de sessão ou alimentar o motor ao vivo.

---

## 9. Armazenamento, exportação e recuperação

Manter os dados temporários em memória, com limites explícitos:

- Limite de sessão: 30 minutos de tempo total.
- Até oito canais a 500 Hz.
- Blocos EEG em arrays tipados, evitando objetos por amostra.
- Uma sessão nessa configuração ocupa aproximadamente 29 MB somente em amostras Float32; prever margem para eventos e trajetórias.
- No máximo quatro sessões em memória nesta versão.
- Sessões encerradas serão liberadas após 30 minutos sem conexão, com aviso prévio na interface.

Exportar um pacote versionado contendo:

- Manifesto e configurações.
- Resultados e regras descritivas.
- Eventos.
- Entrada e trajetória por execução.
- Blocos EEG e janelas espectrais.
- Observações profissionais.

A exportação deverá omitir credenciais de controle. Uma rota autenticada por credencial temporária do profissional entregará o arquivo sem colocar a chave na URL.

Arquivos legados poderão ser identificados como versão anterior, mas não receberão retroativamente métricas que dependem de dados inexistentes. Dados incompatíveis terão leitura limitada ou mensagem explícita.

---

## 10. Etapas e prioridades

| Etapa | Prioridade | Entrega utilizável |
|---|---|---|
| 1. Separar sessão, relógio e transporte | P0 | Uma atividade funcionando com relógio correto, eventos completos e snapshots incrementais |
| 2. Introduzir protocolo | P0 | Treinamento, A/B/C, pausas e consolidado básico |
| 3. Definir conjuntos comparáveis | P0 | Percursos versionados e comparação geométrica documentada |
| 4. Implementar métricas centrais | P0 | Distância, eficiência no grafo, contatos, recuperação e baixa movimentação |
| 5. Criar EEG independente | P0 | Multicanal contínuo, sincronizado e identificado como sintético |
| 6. Processamento espectral | P1 | PSD, potência absoluta/relativa e artefatos técnicos |
| 7. Comparação e resumos | P1 | Evolução temporal, A/B/C e frases auditáveis |
| 8. Linha do tempo e reprodução | P1 | Seleção sincronizada e inspeção de sessões exportadas |
| 9. Modo EEG interativo | P1 | Modulação didática rastreável e separada |
| 10. Refinamento e apresentação | P1 | Impressão, acessibilidade, revisão visual e roteiro da banca |
| Integrações de hardware e algoritmos avançados | P2 | BrainFlow, provedores reais, caminho contínuo ótimo e análises experimentais adicionais |

As etapas serão entregues com testes antes de avançar. Durante a transição, o modo de atividade única permanecerá disponível para depuração.

---

## 11. Critérios de aceite e testes

### Motor, relógio e protocolo

- Mesmo conjunto e semente geram a mesma geometria.
- Indicador respeita raio e paredes em movimentos rápidos e curvas.
- Treino nunca entra nos agregados.
- Limite de tempo encerra a execução uma única vez.
- Pausas não alteram tempo ativo.
- Relógio do sistema pode mudar sem alterar durações.
- Eventos preservam ordem durante desconexão e retomada.
- Amostra da execução anterior não movimenta a seguinte.

### Métricas

Usar trajetórias artificiais com resultados conhecidos:

- Percurso sem retorno: eficiência no grafo de 100%.
- Retorno conhecido: distância excedente e eficiência exatas.
- Contato contínuo: um episódio.
- Separação suficiente: novo episódio.
- Recuperação incompleta: valor censurado.
- Imobilidade curta: nenhum episódio.
- Pausa durante imobilidade: intervalo corretamente fechado.
- Velocidade constante: CV próximo de zero.
- Distância ou tempo zero: nenhum `NaN` ou infinito.
- Resultado final reproduzido a partir dos registros brutos.

### EEG

- Mesma semente e configuração reproduzem as amostras.
- Modo independente permanece igual para diferentes trajetórias.
- Modo interativo altera somente os intervalos previstos.
- Senoide de 10 Hz produz pico na faixa alpha.
- Para senoide de amplitude A, potência integrada próxima de `A²/2`, com tolerância definida no teste.
- Potências relativas somam aproximadamente 100% sobre o intervalo adotado.
- Lacunas invalidam janelas.
- Índices não duplicam durante atraso do worker.
- Amostragem e sincronização continuam durante pausas.

### Comunicação e apresentação

- Aluno não recebe observações profissionais nem comandos administrativos.
- Reconexão recupera fase, execução e estado sem duplicar eventos.
- Exportação/importação conserva amostras, unidades e resultados.
- Reprodução não altera a sessão ao vivo.
- Navegação por teclado, redução de movimento e telas menores funcionam.
- Treino, pausa, limite, abandono e sessão parcial têm apresentação própria.
- Testar duas janelas e, quando disponível, dois dispositivos físicos na rede local.

### Desempenho

Executar uma sessão completa com oito canais a 250 Hz e outra a 500 Hz:

- Sem perda silenciosa de amostras.
- Sem crescimento ilimitado dos buffers.
- Sem retransmissão integral da trajetória a cada quadro.
- Registrar frequência efetiva, atraso do motor e volume de memória.
- Falhas técnicas devem ser visíveis e reproduzíveis, nunca convertidas em indicadores de desempenho do participante.

---

## 12. Riscos e limites assumidos

- **Comparabilidade:** sem estudo com participantes, igualdade geométrica não garante igualdade de dificuldade.
- **Aprendizagem:** diferenças entre A/B/C serão descritas, sem atribuir causa.
- **Controle motor:** métricas dependem do mouse, da velocidade limitada e das colisões; parâmetros devem acompanhar cada resultado.
- **Duração curta:** concluir rapidamente continua sendo válido para o software, mas limita descrições temporais.
- **Simulação:** aparência convincente do EEG não constitui realismo fisiológico validado.
- **Hardware futuro:** 250 Hz e oito canais são referência técnica; ganho, montagem, sincronização e qualidade dependerão do equipamento escolhido.
- **Validade:** nenhuma regra proposta sustenta diagnóstico, classificação de TDAH ou mensuração clínica de atenção.
- **Persistência:** sem banco, a exportação é necessária para conservar resultados após reinício do servidor.

O resultado desta evolução será um MVP capaz de demonstrar **protocolo repetido, observação comportamental detalhada, EEG sintético processado e inspeção temporal integrada**, mantendo explícita a origem de cada informação.

## 13. Decisões finais da atualização aprovada

Esta seção prevalece sobre divergências nas anteriores. Implementar P0 e P1 no módulo atual, sem recriar o projeto. Não implementar banco, CRUD de alunos/pacientes, prontuários, calibração ou sensores. O legado permanece isolado, sem novas funcionalidades. Provedores reais são apenas contratos.

Preservar duas telas Socket.IO e logo oficial animada na espera. Aluno recebe apenas geometria, posição e instruções neutras; notas, métricas, EEG e resultados são exclusivos do profissional. EEG independente é padrão; modo interativo é artificial, rastreável e fixo por sessão. Avisos de simulação são permanentes. Sem classificação clínica.

P0: relógio monotônico, protocolo treino/A/B/C, intervalos, conjuntos geométricos versionados, métricas, resultados, EEG independente e duas telas. P1: Welch/FFT, regras auditáveis, gráficos comparativos, inspeção temporal sincronizada, EEG interativo, diagnóstico técnico, exportação JSON autenticada e refinamento visual. Reprodução avançada e integrações reais são P2, adiadas.

Implementação: src/domain (relógio, sessão, protocolo e métricas), src/services (EEG e espectro), src/repositories (retenção), src/controllers (Socket.IO), src/validators (configuração e protocolo), src/types (contratos), public/modules (renderização, comunicação, gráficos e resultados), src/tests. JavaScript CommonJS no servidor e ES modules no navegador preservam o ambiente sem compilação; contratos TypeScript documentam fronteiras. FFT usa biblioteca pequena com licença MIT. Nenhuma migration.

Arquivos de entrada modificados: index.js, realtime.js, engine.js, live.js, live.html, live.css, navigation.js, package.json/lock e documentação/testes. app.js, maze.js e cadastros legados não serão evoluídos.

Riscos: armazenamento temporário e exportações volumosas; precisão depende do agendamento do processo, portanto atraso excessivo pausa e registra lacuna; equivalência geométrica não é equivalência humana. Estratégia de teste: relógio injetável, trajetórias/sinais conhecidos, integração Socket.IO e HTTP, exportação sem credenciais, reconexão, sessões parciais, teste de duração virtual de 30 minutos em ambas as taxas e revisão das duas interfaces. Equipamentos físicos não disponíveis serão relatados como não testados.
