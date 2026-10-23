# Attobrain — MVP do labirinto

Projeto Integrador da Fatec. Duas interfaces em HTML, CSS e JavaScript puro, servidor Node.js e Socket.IO. O mouse representa um alvo de direcionamento; o servidor move o indicador com velocidade limitada e colisões. Sem banco de dados ou aquisição de sensores.

## Executar

Instale Node.js, execute `npm install` e depois `npm start`. Abra http://localhost:3000/profissional. Testes: `npm test`.

1. Abra a tela do aluno pelo painel; mantenha as duas janelas visíveis.
2. Escolha nível e semente (42 é o percurso fixo padrão), prepare e inicie.
3. Na janela do aluno, mova o mouse pelos corredores. O profissional acompanha e pode pausar, retomar ou encerrar.
4. O objetivo violeta conclui a atividade automaticamente. Exporte JSON antes de criar outra atividade.

Em dois monitores, mova manualmente a janela do aluno para o segundo monitor e clique em Tela cheia. Em um monitor, use janelas lado a lado: ocultar a tela do aluno pausa a atividade. Um computador tem apenas um ponteiro compartilhado; dois dispositivos permitem mouses independentes.

Em rede local, abra `http://IP-DO-SERVIDOR:3000/profissional` no computador do profissional. Copie o link do aluno para o outro dispositivo. Se o link contiver localhost, substitua por esse IP. Os dispositivos precisam alcançar a porta 3000; configurações de firewall dependem do computador. Não exponha o servidor à internet. As credenciais temporárias distinguem os papéis, sem equivaler a autenticação clínica. Apenas um cliente de cada papel pode controlar a sessão.

## Organização

`index.js` serve as páginas e conecta Socket.IO; `realtime.js` gerencia sessões, estados, eventos e métricas; `engine.js` contém geração reproduzível, geometria e colisões; `live.js` contém as duas interfaces e captura do mouse. O fluxo antigo fica em `/legado#students`, fora do fluxo principal.

Estados: IDLE, READY, RUNNING, PAUSED, COMPLETED e ABORTED. Desconexão, tela do aluno oculta ou ausência de entrada por dois segundos pausam. Retomada exige comando do profissional. Entrada antiga por mais de 500 ms não movimenta o indicador. O relógio monotônico do servidor conta somente execução. Um limite operacional de dez minutos provoca pausa.

## Métricas

- Tempo ativo: soma dos passos do motor enquanto RUNNING; pausas ficam separadas.
- Progresso: marcos das células da solução única atingidos em ordem. A chegada exige o indicador próximo ao centro do destino.
- Contatos: parede bloqueia o círculo; novo contato com a mesma parede somente após intervalo de 200 ms sem bloqueio.
- Pouca movimentação: distância menor que 0,01 largura em janela de dois segundos ativos; janelas consecutivas são unidas. Não representa desatenção.
- Distância: soma dos movimentos aceitos, em larguras do quadro.

Coordenadas normalizadas de 0 a 1. Velocidade máxima 0,25 largura/s, raio 0,01, espessura de parede 0,005. Motor nominal 60 passos/s, transmissão nominal 20 estados/s, desenho com requestAnimationFrame. Valores são escolhas de engenharia. Interrupções longas do processo não são contadas como execução: o passo é limitado a 50 ms.

JSON inclui eventos completos ordenados, entrada do mouse separada da trajetória, configurações, semente, geometria, observações e resultados. Os eventos visíveis no painel são limitados aos recentes. Todos os dados da nova sessão são temporários, mantidos em memória; reinício da atividade ou do servidor os descarta. Cadastros antigos continuam no armazenamento local do navegador.

## Limitações e validação

Os testes automatizados cobrem geração reproduzível, caminho completo, velocidade, colisão considerando raio, permissões, associação, estados, exclusão das pausas, reconexão, exportação e reinício. Testar fisicamente dois dispositivos depende de equipamentos e rede disponíveis.

A área técnica tem uma onda ilustrativa sintética, sem relação com a interação, EEG humano ou métricas do jogo. Não há medição de olhos, atenção ou diagnóstico. A integração futura deve substituir o provedor de entrada e validar dados reais. A discussão científica anterior está em SIMULACAO.md; suas fórmulas pertencem à versão anterior e não são utilizadas no relatório atual.
