# Atualização de design — Attobrain

Aplicação da skill ui-ux-pro-max ao software existente, preservando a marca oficial, o protocolo, os cálculos e a comunicação das duas telas.

## Profissional

- Hierarquia orientada aos dados: etapa, seis indicadores e controles no topo.
- Evolução real da velocidade, com marcações de contatos e interrupção do traçado entre pausas.
- EEG sintético na coluna principal, seleção de canal e cinco cartões de bandas.
- Labirinto reduzido a prévia lateral, acompanhado de eventos recentes.
- Configuração recolhida após preparo; acesso à tela do aluno independente da configuração.
- Ações de encerramento separadas dos controles principais.
- Detalhes, relatórios e inspeção temporal preservados.

## Aluno

- Espera acolhedora com a logo oficial e instruções curtas.
- Percurso centralizado, pontos de início/chegada identificados por texto e cor.
- Mensagens próprias para preparação, atividade, pausa, intervalo e finalização.
- Sem indicadores, gráficos, observações ou resultados profissionais.

## Qualidade e validação

36 testes automatizados aprovados, incluindo testes novos para contratos de interface, estados do aluno, cronômetro no limite e gráfico com pausas/lacunas. Preparação, início, movimento do ponteiro e finalização também foram exercitados no navegador com duas telas conectadas. Não foram registrados erros de JavaScript nas duas interfaces durante a inspeção.

Larguras nominais verificadas no navegador: 375, 768, 1024 e 1440 px. Sem transbordamento horizontal da página em ambas as telas; tabelas largas usam rolagem interna. As grades passam de duas a seis colunas, e os gráficos se reorganizam em uma coluna no celular. O viewport temporário foi restaurado após os testes. Tema claro preservado; não foi introduzido modo escuro.

Contraste revisado, foco de teclado visível, movimentos reduzidos respeitados e números tabulares. Sem novas bibliotecas, fontes externas ou tráfego de terceiros. Os gráficos reutilizam os dados já recebidos; o traçado novo examina no máximo 1.300 pontos e é atualizado em até 10 Hz. Não foi executado um benchmark em hardware de baixo desempenho ou uma auditoria formal com leitor de tela.

CSS separado em base, sessão, análise, detalhes, aluno e responsividade. Templates, ícones, apresentação do monitoramento e estados do aluno foram modularizados. O sistema continua disponível em http://localhost:3000/profissional.
