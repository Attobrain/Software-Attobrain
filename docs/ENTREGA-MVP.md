# Entrega do MVP Attobrain

Data: 22/10/2026. Base: commit 74a7c9d, branch main. Escopo: módulo do labirinto; projeto existente preservado.

## Implementado

O plano original foi incorporado em docs/PLANO-MVP.md e atualizado pela seção 13, que prevalece sobre divergências anteriores. README e docs/PROTOCOLO.md descrevem a versão executável e os contratos.

P0: relógio monotônico com pausa técnica em atraso; protocolo treino/A/B/C; durações configuráveis; intervalos mínimos; repetição restrita ao treino; atividade única; encerramento parcial; conjuntos geométricos versionados; métricas observadas reproduzíveis; resultados congelados; EEG independente; telas separadas sincronizadas.

P1: oito canais sintéticos com 250/500 Hz; geração determinística em worker; ruídos e artefatos identificados; modo interativo associado a eventos; Welch/FFT, PSD e bandas absolutas/relativas; gráficos com envelopes; comparação A/B/C e CV; regras descritivas auditáveis; linha do tempo com marcador/EEG sincronizados; importação somente leitura; área técnica; observações privadas; exportação JSON autenticada e transmitida em partes; aviso de dados não exportados; impressão e refinamento visual.

Foram implementadas todas as famílias de métricas do plano: tempo ativo/pausado, progresso e conclusão, distância aceita e referência, distância/eficiência/excesso no grafo, velocidade/DP/CV, contatos e mapa espacial, frequência, recuperação com censura/mediana/quartis, baixa movimentação com reamostragem a 50 ms, retrocessos, mudanças de direção e evolução por terços. Parâmetros e versões acompanham a exportação. Treinos ficam fora dos agregados e não há preenchimento de resultados ausentes.

A arquitetura foi organizada em domínio, validação, repositório, serviços, contratos de tipos, adaptador Socket.IO e módulos de interface. Preservou-se JavaScript sem etapa de compilação para compatibilidade com o projeto; contratos TypeScript documentam os provedores. A biblioteca fft.js foi a única dependência de produção nova. O legado permanece isolado, sem CRUD novo.

## Validação executada

- npm test: **32 testes aprovados, zero falhas**, incluindo unitários e integração HTTP/Socket.IO.
- Protocolo completo por relógio controlado: treino + A/B/C concluídos, pausas mínimas, consolidação e reprodução exata dos resultados a partir de dados exportados.
- Protocolo parcial, repetição do treino, limite de atividade e sessão, dados antigos, entradas malformadas/excessivas, permissões e idempotência.
- Trajetórias conhecidas: percurso sem retorno com eficiência de 100%; retorno com excesso exato; velocidade constante com CV praticamente zero; contato contínuo e separado, recuperação válida/censurada e baixa movimentação interrompida por pausa.
- Sinal de 10 Hz: pico alpha, potência A²/2 com tolerância 0,05 µV² sintéticos; bandas relativas somam aproximadamente 100%; janela com lacuna é inválida.
- Worker real: sinal e espectro durante pausa, índices sem duplicação e exportação com as amostras finais após encerramento.
- Exportação/importação v2, rejeição de formatos inválidos, ausência de credenciais no arquivo, bloqueio de acesso pelo aluno e inspeção temporal autenticada.
- HTTP: rotas das duas telas e módulos; bloqueio de arquivo interno, travessia de diretório, método não permitido e origem diferente; limite e expiração de sessões.
- Navegador: duas abas independentes conectadas; preparação, início, movimento real do ponteiro (distância aceita observada de aproximadamente 0,37 largura), pausa sincronizada, logo oficial na espera e ausência de métricas/EEG na tela do aluno. Foram capturadas imagens das duas interfaces.
- npm audit --omit=dev: zero vulnerabilidades conhecidas reportadas.
- git diff --check: sem erro de whitespace; há apenas avisos da configuração local de conversão LF/CRLF.

## Teste de duração do EEG

npm run test:soak executou geração e processamento de todas as amostras/janelas correspondentes a 30 minutos em oito canais, em modo acelerado:

| Taxa | Amostras por canal | Bytes Float32 | Tempo de execução local | RSS observado no teste isolado | Lacunas de índice |
|---|---:|---:|---:|---:|---:|
| 250 Hz | 450.000 | 14.400.000 | ~7,0 s | ~100 MB | 0 |
| 500 Hz | 900.000 | 28.800.000 | ~14,2 s | ~130 MB | 0 |

Esse teste cobre geração, retenção Float32 e Welch de todas as janelas. Não equivale a 30 minutos de rede, navegador ou servidor com quatro sessões concorrentes. O RSS inclui runtime e DSP; não é uma medição de memória de toda a aplicação. A memória total do servidor será maior por incluir registros comportamentais, objetos espectrais e buffers de rede.

## Limites e verificações não executadas

Não houve teste físico com dois computadores/monitores: não há equipamentos e rede de teste disponíveis para essa verificação. A comunicação entre dois clientes foi validada automaticamente e em duas abas locais. Não houve ensaio integral de 30 minutos em tempo real no navegador, teste de carga com quatro sessões máximas, validação de impressão em impressora/PDF nem auditoria formal em dispositivo móvel/leitor de tela. Não se afirma aprovação dessas verificações.

Reprodução animada avançada 0,5×/1×/2× e integração de hardware permanecem P2. A seleção temporal e importação básica somente leitura estão implementadas. A entrada do labirinto continua por ponteiro; navegação de controles usa HTML acessível, mas isso não torna o jogo plenamente acessível por teclado.

A equivalência geométrica é automática e operacional; não demonstra dificuldade humana equivalente. A recuperação usa distância no grafo das células, com resolução de uma célula. Os testes não validam métricas clínicas nem realismo fisiológico. Credenciais temporárias não substituem autenticação institucional. Não há banco ou persistência central; reiniciar o servidor perde dados não exportados.

Quatro sessões e 30 minutos são limites explícitos do MVP. Não há alegação de escala para 100.000 usuários. Antes de produção, serão necessárias identidade institucional, persistência, capacidade medida, isolamento de sessões e arquitetura de distribuição. A inspeção ao vivo solicita somente quatro segundos de EEG; o download é feito em partes. Importar um JSON grande ainda depende da memória do navegador (limite de arquivo de 512 MiB).

## Como usar

1. npm ci e npm start; abrir http://localhost:3000/profissional.
2. Configurar protocolo e preparar. Abrir janela ou aba do aluno; em outro dispositivo, usar o IP do servidor no link.
3. Manter a tela do aluno visível e iniciar pelo profissional. Mover o mouse pelos corredores.
4. Consultar cada resultado; avançar explicitamente depois do treino e após os intervalos A/B e B/C.
5. Consultar comparativo, regras, trajetórias e linha do tempo. Adicionar observações separadas.
6. Exportar JSON antes de fechar/reiniciar. Para explorar livremente, criar sessão em modo de atividade única.

## Arquivos alterados ou adicionados
- docs/ENTREGA-MVP.md
- docs/PLANO-MVP.md
- docs/PROTOCOLO.md
- engine.js
- index.js
- live.css
- live.html
- live.js
- navigation.js
- package-lock.json
- package.json
- public/modules/board.js
- public/modules/charts.js
- public/modules/controls.js
- public/modules/format.js
- public/modules/input.js
- public/modules/layout.js
- public/modules/package.json
- public/modules/results.js
- public/modules/timeline.js
- README.md
- realtime.js
- realtime.test.js
- scripts/select-mazes.js
- scripts/soak.js
- src/controllers/realtime.js
- src/domain/low-movement.js
- src/domain/maze-sets.json
- src/domain/mazes.js
- src/domain/metrics.js
- src/domain/report.js
- src/domain/session-projection.js
- src/domain/session.js
- src/repositories/sessions.js
- src/services/eeg-worker.js
- src/services/eeg.js
- src/services/export.js
- src/services/inspection.js
- src/services/spectrum.js
- src/services/synthetic.js
- src/tests/domain.test.js
- src/tests/eeg.test.js
- src/tests/import.test.js
- src/types/providers.d.ts
- src/validators/config.js
