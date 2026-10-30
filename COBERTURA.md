# Gráficos cobertos

Lista de 30/10/2026: **174 gráficos**. Os links estão em `paineis/<Operadora>/`.

A direção define quando o gráfico alarma:

- **Erro:** alarma se subir.
- **Sucesso:** alarma se cair.
- **Outros:** alarma nas duas direções.

| Operadora | Erro | Sucesso | Outros | Total |
|---|---|---|---|---|
| Claro | 27 | 56 | 3 | 86 |
| ClaroCA | 1 | 4 | 0 | 5 |
| Tim | 6 | 30 | 4 | 40 |
| Vivo | 8 | 33 | 2 | 43 |
| **Total** | **42** | **123** | **9** | **174** |

As regiões da Claro são BASE, CO, MG, NE, NO, PRSC, RJ, RS, SP1 e SP2. Cada uma é um gráfico próprio, com referência própria.

## Claro (86)

**Erro (27)**

- VMS - Deposito e Resgate › Erro Gravação Recado: total e as 10 regiões
- VMS - Deposito e Resgate › Erro Fala Recado: total e as 10 regiões
- Top Up - SMS › Recarga SMS Sem Sucesso
- Services Overview 2 › BemobiWebApi › Not Elegible
- Services Overview 2 › Enrollment USSD › Errors
- Services Overview 2 › Enrollment Web › Cadastros concluídos sem sucesso
- TopUp & VMS Overview › Top-Up SMS › Abandonos

**Sucesso (56)**

- VMS - Deposito e Resgate:
  - Deposito de Chamadas: total e as 10 regiões
  - Mensagens Gravadas: total e as 10 regiões
  - Resgate de Chamadas
  - Assinatura do Claro Alerta antes do Recado
- VMS - Billing › Subscription notifications
- Top Up - SMS: Todos os Acessos; Com Sucesso
- Services Overview 2:
  - Aprovisionamento › Integrações com Sucesso
  - BemobiWebApi › Elegible
  - Conecta Voz: Subscriptions; Charges Geral; Transactions
  - SOS: Charge Attempts; Finalization; Loan Subscription and Charges / Fee Charges
  - Enrollment USSD: Cadastramento concluído com sucesso; Total de Chamadas Atendidas
  - Enrollment Web › Cadastro concluído com sucesso
  - Zero Balance: Accesses (All Channels); Access - All products
- TopUp & VMS Overview:
  - Recarga › Sucessos (Todos os Canais)
  - Top-up USSD: Success - All Payment Methods; Successful Credit Card; Successful Pix; Access; Access (555 e 544); Access 1052; Access (WIB)
  - Top-up IVR: Success - All Payment Methods; Success - Pix; Accesses; Accesses por número
  - VMS: Retrieval Calls; Charges - All Products; Bundle Deposit Calls / Recorded Messages; Bundle Retrieval Calls / New Messages Heard

**Outros (3)**

- Services Overview 2 › SOS › Elegible and Inelegible
- Services Overview 2 › Zero Balance › Elegible - All products
- TopUp & VMS Overview › Top-up IVR › Success - Credit Card

## ClaroCA (5)

**Erro (1)**

- VMS - Charge Operations › Error Charges

**Sucesso (4)**

- Integrador de Ofertas › Acessos
- VMS - Charge Operations › Transactions
- VMS - Calls Handled and Retrieval › Recorded Messages (VMS)
- VMS - Calls Handled and Retrieval › Recorded Messages (VMSHandler)

## Tim (40)

**Erro (6)**

- VMS - Charge Operations › [ERRO] HubSubscribe (Second Step)
- VMS - Calls Handled and Retrieval › Deposit Calls Error
- Microloan Services › Crédito Especial - Adesões Sem Sucesso
- Services Overview › BemobiWebApi › Not Elegible
- Services Overview › Microloan › Inelegíveis
- Services Overview › VMS Billing › Unsubscriptions Notifications

**Sucesso (30)**

- VMS - Calls Handled and Retrieval: Deposit Calls Handled; Recorded Messages; Retrieval Calls w/ Heard Message
- VMS - Charge Operations › [SUCCESS] VerAss - Não Assinante
- Microloan Services › Crédito Especial - Adesões Com Sucesso
- SmartCampaign: Notificações por régua; Triggers aceitas por canal e tipo
- TopUp - All Channels: Accesses TopUp IVR; IVR (Zero Balance); IVR (VMS)
- Integrador de Ofertas: Acessos Totais; Acessos Portais
- Services Overview:
  - Aprovisionamento › Overview
  - BemobiWebApi: Total Request; Elegible; VAS Offer Purchase OK
  - Microloan › Elegíveis
  - VMS Calls: Retrieval Calls; Dial In/Out Retrieval Calls; Dial In/Out New Messages Heard
  - VMS Billing: Charges; Charges by Product; Subscriptions Notifications; Subscriptions by Product
  - VMS Charge Operations: [SUCCESS] InsAss (First step); [SUCCESS] HubSubscribe (Second Step)
  - Zero Balance: Access (All Channels); Access by Product; Eligibilities; Not Eligibilities

**Outros (4)**

- Integrador de Ofertas › Transbordo Recarga - Portal Sem Saldo
- Services Overview › Aprovisionamento › "Panel Title" (OK e ERRO juntos)
- Services Overview › Vasconn: Adesões Geral; Adesões Hub

## Vivo (43)

**Erro (8)**

- Aprovisionamento › VMS - ERRO
- Aprovisionamento › MCA - ERRO
- EdgeSMS (Todos SMS) › Erros de Envio
- Microloan Services › Não Elegíveis
- Recarga - Todos os Canais: Falhas Técnicas M4U; Negadas pela M4U; Encerradas por Falha Técnica
- Recarga - Plataforma wsRecarga › Detalhamento de Erros nas Notificações

**Sucesso (33)**

- Microloan Services: Requisições; Elegíveis; Adesões
- Aprovisionamento › MCA - OK
- BemobiWebApi › Telemetry Events Recorded
- EdgeSMS (Todos SMS): Pedidos; Tratados; Envios
- Recarga - Canal URA: Successful Credit Card IVR; *7000; *8000; Access IVR; Direct Access *7000; Access *8000
- Recarga - Todos os Canais:
  - Sucessos
  - Solicitadas × Callbacks M4U
  - Acessos URA
- Recarga - Plataforma wsRecarga:
  - Solicitadas × Callbacks M4U
  - Tratamento de Notificações (Callback)
- VMS - Calls Handled and Retrieval: Deposit Calls Handled; Deposit Rate
- VMS: Vivo Avisa › Missed Call SMS Sent OK
- Zero Balance - Accesses: Accesses; Microloan; TopUp
- Services Overview:
  - Aprovisionamento: Overview; VMS
  - Check Balance › Total Request
  - VMS: Recorded Message; Retrieval Calls
  - Vivo Avisa › Missed Call SMS
  - Microloan › Elegíveis
  - Recarga › Cliques no link Pix

**Outros (2)**

- Services Overview › Check Balance › Tempo de Resposta Médio
- Services Overview › Microloan › Adesões / Acessos / Não elegíveis

