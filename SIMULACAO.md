# Simulação do labirinto — PI Attobrain

## O que é medido

O participante clica no início e percorre um labirinto aleatório com o mouse. Busca em profundidade gera uma grade conectada, sem ciclos, com caminho entre início e fim. O nível inicial tem 7 × 7 células; o intermediário, 10 × 10.

O navegador captura nominalmente 20 amostras por segundo. Cada amostra guarda tempo em milissegundos, posição normalizada (0–1), presença no quadro, validade do percurso, contato com parede, intervalo real e velocidade em diagonais de coordenadas normalizadas por segundo. Temporizadores do navegador não garantem frequência exata. O mouse parado continua sendo amostrado; fora do quadro, a posição é nula. Uma tentativa de atravessar paredes bloqueia o marcador até o cursor retornar. Não há medição dos olhos, piscadas ou pupila. A coleta termina ao alcançar o fim ou por encerramento manual; limite de 12.000 amostras (aproximadamente 10 minutos em primeiro plano).

O relatório usa dados desta sessão: duração, presença no quadro, tempo com velocidade abaixo de 0,03 unidades/s e contatos com paredes. O limiar de imobilidade é escolha de interface, não um detector de fixações oculares. Presença no quadro não mede atenção. O traçado inclui as tentativas inválidas do mouse; não representa apenas o marcador aceito.

## Como o EEG sintético é gerado

Perfil didático genérico, sem correspondência com um equipamento ou eletrodo específico. Um canal virtual a 128 Hz. Para cada instante t, usa-se a última amostra do mouse disponível. Seja v = mínimo(1, velocidade do mouse):

- Amplitude theta: 8 + 4v; frequência 6 Hz.
- Amplitude alpha: 12 − 4v; frequência 10 Hz.
- Amplitude beta: 5 + 6v; frequência 20 Hz.
- Componente artificial lenta a 1,5 Hz: amplitude 20 fora do quadro, 12 em contato com parede, zero nos demais casos.

O sinal é a soma de A × sen(2πft) destas componentes, em microvolts sintéticos. Os coeficientes, as amplitudes e a associação com o movimento são arbitrários: não foram ajustados a dados humanos. Aumentar a taxa de 20 para 128 Hz não acrescenta informação biológica. As amplitudes não são potência de banda; não há FFT, classificação de atenção ou estimativa clínica. O gráfico mostra até os últimos quatro segundos; o JSON contém toda a série e os parâmetros.

## Fundamentação e limites

1. Kastrati et al. (2021), **EEGEyeNet**. A pesquisa usa registros simultâneos de EEG e eye tracking de 356 participantes para estudar predição do olhar. Demonstra por que validação com ambos os sistemas é necessária; não fornece uma regra para converter mouse em EEG. https://datasets-benchmarks-proceedings.neurips.cc/paper/2021/hash/a3c65c2974270fd093ee8a9bf8ae7d0b-Abstract-round1.html
2. **Quantifying gaze and mouse interactions on spatial visual interfaces with a new movement analytics methodology** (2017). Investiga relações entre olhar e mouse em tarefas de traçado. Relações dependem da tarefa; o cursor não deve ser tratado como olhar verdadeiro. https://pmc.ncbi.nlm.nih.gov/articles/PMC5544210/
3. **EmotivPRO — Frequency Bands**. Documenta theta 4–8 Hz, alpha 8–12 Hz, beta baixa 12–16 Hz, beta alta 16–25 Hz e gamma 25–45 Hz; distingue traçado, FFT e potência das bandas. Apenas as faixas informam nosso exemplo. https://emotiv.gitbook.io/emotivpro-v3/data-streams/frequency-bands
4. **Cortex API — Data Subscription**. Diferencia streams de EEG, movimento e dados calculados. Referência para uma futura integração, não dependência deste MVP. https://emotiv.gitbook.io/cortex-api/data-subscription

Consultas realizadas em 22/10/2026. O equipamento ainda não foi definido. Para a próxima etapa, escolher separadamente a necessidade de EEG e de posição ocular: um headset EEG não garante coordenadas do olhar. Avaliar acesso ao sinal bruto/SDK, canais, frequência, qualidade de contato, sincronização, custo e licenças; validar com gravações reais antes de interpretar sinais humanos.

## Apresentação e reprodução

Executar `npm start`. Selecionar aluno e nível, clicar no início verde, mover pelos corredores e alcançar o violeta. O botão de encerramento permite analisar sessões incompletas. Baixar JSON no resultado para preservar o labirinto, as amostras medidas e o EEG gerado. Sem backend, apenas a sessão atual fica salva neste navegador; exportar antes de iniciar outra.

Frase para a banca: “O mouse fornece uma entrada controlada que representa o olhar nesta demonstração. A partir dos eventos da tarefa geramos um sinal elétrico fictício para demonstrar o fluxo de um futuro BCI. Não reconstruímos EEG nem medimos atenção.”
