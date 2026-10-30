# noc-desvios

Plugin do Claude (Cowork) que automatiza a conferência dos gráficos do Grafana feita pelo NOC. A cada rodada, ele lê os painéis pela API, compara cada série com a curva histórica e manda os desvios por DM no Slack para quem executou.

> ⏱️ **Tempo de execução (174 gráficos)**
>
> | Rodada | Tempo estimado |
> |---|---|
> | **Primeira vez na máquina** (sem cache: baixa 7 dias por gráfico) | **~1h40** |
> | **Primeira do dia, em dia útil** (baixa só o dia de ontem; o resto vem do cache) | **~20–25 min** |
> | Primeira de sábado ou domingo (compara com D-7, D-14 e D-21) | ~45 min no primeiro fim de semana, depois ~20–25 min |
> | Seguintes (incremental, só o trecho novo do dia) | poucos minutos |
>
> A referência vira na virada do dia local de cada operadora: às 00h de Brasília, e às 03h de Brasília para a ClaroCA (GMT-6). Agende a primeira rodada para a madrugada. O cache fica no navegador do app de cada pessoa (~1,5 MB, 21 dias, limpeza automática), então cada colega tem a própria primeira vez lenta.

## Como funciona
1. O Claude abre o Grafana no navegador embutido do app desktop, usando a sua sessão SSO, e carrega o `scripts/noc-engine.js`.
2. **Referência:** o motor calcula uma referência por dia e guarda em cache. Em dia útil é a mediana por hora dos dias úteis da semana anterior. No fim de semana é o mesmo dia em D-7, D-14 e D-21.
3. **Alarme:** dispara quando o acumulado do dia sai de ±20%, ou quando há 2 horas seguidas fora. Horas com menos de 100 de volume são ignoradas. Também avisa quando a série fica mais de 40 min sem dados e quando aparece erro numa série que estava zerada.
4. **Envio:** cada série só gera aviso quando muda de status. Com 4 ou mais séries de uma operadora fora ao mesmo tempo, sai uma mensagem consolidada. Toda rodada termina com um resumo.

## Estrutura
```
.claude-plugin/plugin.json   manifesto
skills/noc-desvios/SKILL.md  passo a passo da rotina para o Claude
scripts/noc-engine.js        motor (somente leitura no Grafana)
config.json                  tolerância, piso, sem dados, fusos, destino do alerta
paineis/<Operadora>/         erro.txt (alarma se subir), sucesso.txt (se cair), outros.txt (nas duas direções)
COBERTURA.md                 gráficos cobertos, por operadora
```

## Requisitos
- App desktop do Claude, com o navegador embutido e o conector do Slack.
- VPN da Bemobi e login no Grafana.

## Uso
- **Rodar:** peça ao Claude "roda a rotina do NOC".
- **Incluir um gráfico:** cole o link do painel (com `panelId`) no arquivo da operadora e da direção certa. Linhas com `#` são comentários.
- **Mandar para um canal em vez da DM:** coloque o ID do canal em `alerta.destino` e, se quiser menção, `"mencao": "<!here>"`.

## Versões
- **0.1.1:** cache da referência por dia, guardando 21 dias com limpeza automática. A primeira rodada do dia em dia útil caiu de ~1h40 para ~20–25 min. A skill passou a acompanhar a rodada com menos consultas (a cada ~10 min quando monta a referência), o que corta o consumo de tokens em ~10 vezes. Nova opção `rebuscarDiaRecente` no `config.json`.
- **0.1.0:** primeira versão: 174 gráficos, alertas por DM.

Para atualizar o plugin instalado:
- **Claude Code:** `/plugin marketplace update noc-bemobi`, depois `/plugin update noc-desvios`.
- **App desktop:** Settings → Plugins → "…" no Noc desvios.
