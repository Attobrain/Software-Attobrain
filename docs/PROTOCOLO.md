# Protocolo e fórmulas — versão 2

## Estados e relógios

Sessão: PREPARATION, TRAINING, EVALUATION, INTERVAL, FINISHED. Execução: READY, RUNNING, PAUSED, COMPLETED, TIMED_OUT, ABORTED. O protocolo exige treino antes de A/B/C; apenas treino pode repetir. Exploração usa uma execução independente.

Tempo da sessão usa performance.now e avança nas pausas. Tempo ativo soma passos fixos de 1/60 s apenas com entrada tecnicamente disponível. Uma lacuna de agendamento acima de 250 ms pausa e gera engine-gap; não descarta tempo silenciosamente. Entrada mais antiga que 500 ms pausa antes de novos movimentos. Desconexão ou ocultação também pausa. Nunca retoma automaticamente. Finalização fecha pausas abertas. UTC é metadado, não relógio de duração.

## Métricas reproduzíveis

Cada passo exporta posição inicial/final, dt, tempos ativo/sessão, segmento sem lacuna, paredes bloqueadas e transições entre células capturadas nos subpassos. Inputs preservam seq, runId, instante do cliente e recepção pelo servidor. Sequências pertencem à conexão e à execução; reconexão reinicia o controle da sequência.

- Distância: soma euclidiana de deslocamentos aceitos; segmentos não são ligados através de pausas.
- Referência: comprimento do caminho entre centros no grafo. Grafo real: soma dos comprimentos de cada transição aceita. Eficiência = 100 × referência/grafo real, somente após conclusão. Excesso = grafo real − referência. Não há clamp artificial a 100%.
- Velocidade média = distância/tempo ativo; DP populacional e CV das velocidades dos passos válidos, incluindo zeros. CV é null com média ≤1e−9.
- Contato: primeiro bloqueio por parede, novo episódio somente depois de ≥200 ms ativos sem aquela parede. Localização agrupa célula e parede. Cores e rótulos do mapa indicam frequência.
- Recuperação: contatos simultâneos ou recorrentes mantêm uma observação aberta. Exige 500 ms sem bloqueio e redução ≥0,01 largura na distância à saída no grafo das células. A resolução dessa distância é a célula. Pausa interrompe a observação; final sem recuperação é censurado, com duração null. Mediana e quartis usam interpolação linear.
- Baixa movimentação: reamostragem por segmento a 50 ms, janela móvel de 500 ms, limiar padrão <0,005 largura/s por pelo menos 2 s. Registra posição média, maior dispersão e dois relógios. Parâmetros configuráveis. A primeira janela elegível ancora o início no começo de sua janela de 500 ms.
- Retrocesso: transição que aumenta a distância em células até a saída; transições consecutivas formam episódio.
- Direção: ângulo ≥60° entre segmentos de deslocamento ≥0,01 largura. Não recebe rótulo de erro.
- Terços: divididos por tempo ativo; contatos/min, velocidade, CV, baixa movimentação e checkpoints. Menos de 5 s válidos impede descrição automática daquele terço.

Fórmulas v2 em funções puras, recalculáveis com maze, distâncias derivadas do grafo e steps exportados. Não há dados de olhar, EEG humano ou atenção. Ausências e denominadores inválidos usam null; contagens de registros podem ser zero.

## Comparação e descrição automática

Conjuntos operational-7-v1 e operational-10-v1 são pré-computados e versionados. Todos os pares são verificados: comprimento e curvas dentro de 10%, becos dentro de 15%, usando o menor valor como denominador. Cada percurso usa cinco checkpoints intermediários e a chegada; velocidade, raio e espessura são os mesmos dentro da sessão. Revisão é geométrica automática; não há equivalência humana validada.

Regras guardam ruleId, versão, métricas, valores e runIds. Redução de contatos: A>B>C e pelo menos 10% A→C; eficiência crescente: A<B<C e pelo menos 5 pontos percentuais. Semelhança: amplitude ≤5 pontos de eficiência ou ≤10% da mediana da taxa. Oscilação: inversão de direção com ambas as diferenças acima da tolerância. CV final exige terços elegíveis e CV final ≥1,2 × inicial positivo. Baixa movimentação na metade final exige ≥2 s e ≥60% de sua duração nessa metade. Treino é excluído. Três conclusões comparáveis são necessárias para tendências globais; duas geram somente pares. Nunca sintetizar melhora clínica.

## EEG e DSP

Gerador v1: componentes de 2, 6, 10, 20 e 38 Hz, fases por canal, modulação lenta de amplitude, ruído branco por hash determinístico e ruído colorido como soma de seis escalas interpoladas. Cada bloco usa índice inicial absoluto, taxa e Float32Array por canal. O tempo de amostra = índice/taxa no relógio da sessão; isso não representa sincronização de hardware.

Artefatos programados a cada ciclo de 20 s: pulso de 25 µV sintéticos entre 10–11 s, rajada de ruído de amplitude 15 entre 14–15 s, interferência de 50 Hz/amplitude 5 entre 17–19 s. Configuração permite desativá-los. Modo interativo: contato gera rajada de amplitude 20 durante 1 s, com eventSeq e início efetivo registrados. O índice efetivo nunca retroage para amostras já produzidas.

Welch v1: últimos 8 s, segmentos 512/1024 para 250/500 Hz, Hann periódica, 50% de sobreposição, remoção da média. PSD unilateral = |FFT|²/(Fs × soma janela²), dobrando bins internos. Bandas sem sobreposição: [1,4), [4,8), [8,13), [13,30), [30,45]. Potência absoluta soma PSD × df; relativa divide pelo total 1–45 Hz. Sinal zero produz potência relativa null. Lacunas invalidam a janela; amostras não são substituídas por zeros.

FFT é fornecida pela biblioteca [fft.js](https://github.com/indutny/fft.js). A normalização e a estratégia de segmentação foram conferidas com a [documentação oficial de Welch/SciPy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.welch.html). Os testes verificam potência A²/2 de senoide de 10 Hz com tolerância absoluta de 0,05 µV² sintéticos e relativa somando 100% com tolerância 1e−8.

Qualidade significa integridade de índice/buffer e presença de artefatos artificiais conhecidos. O EEG continua nas pausas/intervalos e encerra na finalização global ou no limite de sessão. A exportação final aguarda os blocos finais. O painel desenha envelopes e mostra bandas, área técnica permite inspeção detalhada. Nenhuma característica é interpretada fisiologicamente.

## Contratos Socket.IO

Cliente e servidor compartilham a mesma origem. O servidor valida papel, sessão, execução, sequência, tipos e limites. Limites: 16 KiB por payload; até 20 entradas/s, com espaçamento mínimo de 45 ms; até 15 comandos/s; quatro sessões; oito criações/min por endereço. Cache dos últimos 256 IDs de comando retorna o mesmo resultado em reenvio.

```json
{"event":"join","payload":{"create":true}}
{"event":"join","payload":{"id":"session-id","key":"student-key"}}
{"event":"command","payload":{"id":"session-id","commandId":"uuid","type":"prepare","config":{"mode":"protocol","level":7,"sampleRate":250,"channels":8,"eegMode":"independent"}}}
{"event":"input","payload":{"runId":"run-id","seq":1,"inside":true,"hidden":false,"x":0.1,"y":0.2,"clientTime":1234}}
```

Resposta de comando: `{"ok":true}` ou `{"error":"mensagem"}`. Join do profissional entrega chave de controle e link de aluno; join do aluno não entrega chave profissional. Callbacks ausentes ou malformados não derrubam o processo. Snapshot completo apenas em associação, transição e reconexão; deltas de trajetória/eventos até 20 Hz; métricas até 4 Hz. Somente profissional recebe notas, métricas, eventos detalhados, resultados e EEG. Há heartbeat técnico para RTT, sem alegação de sincronização de hardware.

## HTTP

GET /api/sessions/:id/export exige `Authorization: Bearer <professional-key>`; a chave não vai na URL. `X-Attobrain-Export: true` marca a revisão capturada como exportada; inspeção não marca. Resposta 200 application/json com attachment, 403 sem acesso, 429 se exportação concorrente. O download é transmitido em partes e cancelamento libera o bloqueio.

GET /api/sessions/:id/inspect?time=1234 usa a mesma autorização e retorna geometria/traços/eventos e somente quatro segundos de EEG até o instante solicitado. Não retorna inputs/steps completos e nunca alimenta o motor. Instante inválido retorna 400.

```sh
curl -H "Authorization: Bearer CHAVE_TEMPORARIA" -H "X-Attobrain-Export: true" http://localhost:3000/api/sessions/ID/export -o resultado.json
```

Campos principais da resposta: schemaVersion, manifest, report, notes, events, runs, eeg. Arquivos antigos não ganham métricas retroativas. O módulo importado é validado e somente leitura. O legado permanece em /legado, sem CRUD novo.
