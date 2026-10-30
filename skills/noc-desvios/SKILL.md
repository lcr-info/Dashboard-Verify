---
name: noc-desvios
description: Roda a rotina do NOC que confere os painéis do Grafana contra a curva histórica e manda os alertas por DM no Slack para quem executou. Use quando pedirem "roda o NOC", "checa os gráficos", "rodada de desvios" ou para agendar a rotina.
---

# Rotina NOC: detecção de desvios nos painéis do Grafana

O cálculo é determinístico e fica no `scripts/noc-engine.js`. O Claude só carrega o motor, monta a lista de painéis, envia as mensagens e resume a rodada. O acesso ao Grafana é **somente leitura**: nunca salve nem altere dashboards.

## Pré-requisitos
- App desktop do Claude aberto, com o navegador embutido.
- VPN ligada e sessão válida no Grafana (Google SSO) no navegador embutido.
- Conector do Slack ativo, para enviar a DM.

Se `fetch('/api/user')` responder 401, peça à pessoa para fazer login no Grafana no painel do navegador e espere.

## Entrada
- `config.json`: endereço do Grafana, tolerância, piso de volume, minutos para "sem dados", fuso e pasta de cada operadora, e destino do alerta.
- `paineis/<Operadora>/` tem um link do Grafana por linha:
  - `erro.txt`: alarma só quando fica **acima** da referência.
  - `sucesso.txt`: alarma só quando fica **abaixo**.
  - `outros.txt`: alarma nas duas direções.
  - Linhas em branco, linhas com `#` e arquivos vazios são ignorados. Links repetidos entram uma vez só.
  - Os parâmetros `var-Region=...` do link são respeitados, e cada região tem cache e referência próprios.

## Passos de uma rodada
1. Abra a origem do Grafana (`config.grafana`) no navegador embutido e confirme a sessão.
2. Injete o conteúdo de `scripts/noc-engine.js` com o `javascript_tool`. A resposta esperada é `NOC <versão> carregado`.
3. Monte `PAINEIS` como uma lista de `[operadora, direção, url]`, com direção `erro`, `sucesso` ou `outros`, a partir das pastas do `config.json`.
4. Rode `NOC.start(PAINEIS, CONFIG)` e acompanhe com `NOC.status()` a cada 30–60 s. O `javascript_tool` tem limite de 45 s, então a rodada corre em segundo plano.
   - Primeira rodada do dia: ~35–40 s por gráfico, porque monta a referência.
   - Rodadas seguintes: alguns minutos para ~100 gráficos.
5. Quando `NOC.state` começar com `done`, leia `NOC.msgs` (os alertas) e `NOC.resumo`.
6. **Envio (destino `dm-proprio`):** descubra o usuário que está executando com `slack_read_user_profile` sem `user_id`. Envie cada `NOC.msgs[i].text` e depois o `NOC.resumo` com `slack_send_message`, usando o `user_id` dessa pessoa como `channel_id`.
   - Se `config.alerta.destino` for o ID de um canal, envie para esse canal.
7. Só depois que o envio der certo, rode `NOC.commit()` para gravar a deduplicação. Se algum envio falhar, rode `NOC.commit([índices enviados])`.
8. Responda no chat com um resumo curto: quantos gráficos, quantos fora, e os principais desvios.

## Regras do motor
- **Referência:** é calculada uma vez por dia local da operadora e guardada em cache no localStorage.
  - Dia útil: mediana por hora dos dias úteis entre os 7 dias anteriores.
  - Sábado e domingo: o mesmo dia da semana em D-7, D-14 e D-21.
- **Alarme:**
  - Dispara quando o acumulado do dia fica fora de ±`tolerancia`, ou quando há 2 horas seguidas fora, respeitando a direção.
  - Horas com referência abaixo de `pisoVolume` são ignoradas.
  - Só entram horas completas.
- **Sem dados:** mais de `semDadosMin` minutos sem ponto.
- **Erro novo:** nos painéis de erro, uma série zerada nos 7 dias que sai de zero gera alarme, sem depender da tolerância.
- **Deduplicação:**
  - Só avisa quando o status da série muda dentro do dia.
  - A volta ao normal gera "voltaram ao normal".
  - Com 4 ou mais séries fora na mesma operadora, sai uma mensagem consolidada.
- **Séries D-7** (com `daysOffset`) ficam fora da avaliação.

## Limitações conhecidas
- A mediana de 7 dias absorve uma queda longa depois de ~3 dias úteis.
- A regra de fim de semana (D-7/14/21) foi pouco testada.
- O motor depende da sessão SSO de quem executa, então não roda sem uma pessoa logada.
