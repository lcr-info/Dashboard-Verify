# noc-desvios

Plugin do Claude (Cowork) que automatiza a conferência dos gráficos do Grafana feita pelo NOC. A cada rodada, ele lê os painéis pela API, compara cada série com a curva histórica e manda os desvios por DM no Slack para quem executou.

> ⏱️ **Tempo de execução (174 gráficos)**
>
> | Rodada | Tempo estimado |
> |---|---|
> | **Primeira do dia** (monta a referência dos 7 dias, ~35–40 s por gráfico) | **~1h40** |
> | Seguintes (incremental, só o trecho novo do dia) | poucos minutos (5–9 min com 104 gráficos) |
>
> A referência é refeita na virada do dia local de cada operadora: 00h de Brasília, e 03h de Brasília para a ClaroCA (GMT-6). Agende a primeira rodada para a madrugada, assim ela fica pronta antes do turno. Enquanto a referência está sendo montada, os alertas daquele dia só saem quando ela termina.

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
