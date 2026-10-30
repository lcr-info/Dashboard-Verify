// noc-engine.js — versão 2026-10-30-fork (fork exportável do motor 2026-10-06f)
// Mudanças do fork: parâmetros vêm de config.json (NOC.start(PAINEIS, CONFIG)); origem do Grafana = página atual;
// fusos por operadora configuráveis; alertas sem canal fixo (padrão: DM para quem executa, sem @here); links em Markdown.
// Roda no navegador embutido, na origem do Grafana (sessão SSO do usuário). Somente leitura no Grafana.
// Uso: NOC.start(PAINEIS, CONFIG) → roda em segundo plano; NOC.status() para acompanhar; NOC.result ao final.
// Cache: noc:v1:<uid>:<panelId>. Ao final: NOC.msgs (alertas com deduplicação; NOC.commit() após enviar) e NOC.resumo (follow-up da rodada).
(() => {
  const OVERLAP = 45 * 60e3, STEP = 15 * 60e3, H = 3600e3;
  let TOL = 0.20, PISO = 100, SEM_DADOS_MIN = 40, MENCAO = '', OFFSET = {};
  // relógio da operadora = agora − OFFSET; OFFSET = (fuso do navegador − fuso da operadora) em horas
  function configure(cfg = {}) {
    TOL = cfg.tolerancia ?? 0.20; PISO = cfg.pisoVolume ?? 100; SEM_DADOS_MIN = cfg.semDadosMin ?? 40;
    MENCAO = cfg.alerta?.mencao ? cfg.alerta.mencao + ' ' : '';
    const tzNav = -new Date().getTimezoneOffset() / 60; OFFSET = {};
    for (const [op, o] of Object.entries(cfg.operadoras || {})) OFFSET[op] = (tzNav - (o.fuso ?? tzNav)) * H;
  }
  const lnk = (url, txt = 'link') => `[${txt}](${url})`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pad = n => String(n).padStart(2, '0');
  const dayStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const linkOf = (uid, pid) => `${location.origin}/d/${uid}?orgId=1&fullscreen&panelId=${pid}`;
  const parseData = d => { if (!d) return {}; if (typeof d === 'object') return { ...d }; const t = String(d).trim(); if (!t) return {}; try { return JSON.parse(t); } catch { return {}; } };

  let dsIds = null; const dashCache = {};
  async function getJSON(url, opt, tries = 3) {
    for (let i = 0; i < tries; i++) {
      try { const r = await fetch(url, opt); const txt = (await r.text()).trim(); if (r.ok && txt) return JSON.parse(txt); }
      catch (e) { if (i === tries - 1) throw e; }
      await sleep(1500 * (i + 1));
    }
    throw new Error('sem resposta: ' + url);
  }
  async function dsId(name) {
    if (!dsIds) { const fs = await getJSON('/api/frontend/settings'); dsIds = {}; for (const [n, v] of Object.entries(fs.datasources)) dsIds[n] = v.id; }
    return dsIds[name];
  }
  async function panelInfo(uid, pid) {
    if (!dashCache[uid]) dashCache[uid] = await getJSON('/api/dashboards/uid/' + uid);
    const d = dashCache[uid].dashboard, flat = [];
    (function walk(ps) { for (const p of ps || []) { flat.push(p); if (p.panels) walk(p.panels); } })(d.panels || (d.rows || []).flatMap(r => r.panels));
    const p = flat.find(x => x.id == pid);
    // séries ativas: sem hide, sem daysOffset (D-7). Nome duplicado ganha sufixo " (k)".
    const seen = {}, targets = [];
    for (const t of p.targets || []) {
      if (t.hide) continue;
      const data = parseData(t.data);
      if (data.daysOffset != null) continue;
      delete data.usingForecast;
      const base = data.name || t.target; seen[base] = (seen[base] || 0) + 1;
      const key = seen[base] > 1 ? `${base} (${seen[base]})` : base;
      targets.push({ key, base, refId: t.refId, target: t.target, data });
    }
    return { title: `${d.title} › ${p.title}`, ds: p.datasource || d.templating?.list?.find(x => x.type === 'datasource')?.current?.value, targets };
  }
  // consulta em grupos sem nome repetido, em sequência
  async function query(ds, targets, from, to, scoped) {
    const id = await dsId(ds), groups = [];
    for (const t of targets) { let g = groups.find(g => !g.some(x => x.base === t.base)); if (!g) groups.push(g = []); g.push(t); }
    const out = {};
    for (const g of groups) {
      const body = { range: { from: new Date(from).toISOString(), to: new Date(to).toISOString() }, intervalMs: STEP, maxDataPoints: 2000,
        targets: g.map(t => ({ refId: t.refId, target: t.target, type: 'timeseries', data: t.data })), ...(scoped ? { scopedVars: scoped } : {}) };
      const res = await getJSON(`/api/datasources/proxy/${id}/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      for (const s of res) { const t = g.find(x => x.base === s.target) || (g.length === 1 ? g[0] : null); if (!t) continue; out[t.key] = s.datapoints.filter(p => p[0] != null).map(([v, ts]) => [ts, v]); }
      for (const t of g) out[t.key] = out[t.key] || [];
    }
    return out;
  }

  // Referência do dia: mediana por hora. Dia útil × dias úteis dos 7 dias anteriores.
  // Fim de semana × o mesmo dia da semana (D-7, D-14, D-21): correção de 04/10, porque sábado tem volume de dia útil no VMS.
  const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
  async function buildRef(info, dayStart, log, scoped) {
    const wd = dayStart.getDay(), weekend = wd === 0 || wd === 6, back = [];
    if (weekend) back.push(7, 14, 21);
    else for (let b = 1; b <= 7; b++) { const d = new Date(dayStart); d.setDate(d.getDate() - b); if (d.getDay() % 6) back.push(b); }
    const perDay = {};
    for (const b of back) {
      const s = new Date(dayStart); s.setDate(s.getDate() - b); const e = new Date(s); e.setDate(e.getDate() + 1);
      const data = await query(info.ds, info.targets, s.getTime(), e.getTime() - 1, scoped);
      for (const t of info.targets) {
        const h = Array(24).fill(0);
        for (const [ts, v] of data[t.key]) if (ts >= s.getTime() && ts < e.getTime()) h[new Date(ts).getHours()] += v;
        (perDay[t.key] = perDay[t.key] || []).push(h);
      }
    }
    const med = {}, zeradas = [];
    for (const t of info.targets) {
      const days = perDay[t.key] || [];
      if (days.every(h => h.every(v => !v))) { zeradas.push(t.key); continue; }
      med[t.key] = Array.from({ length: 24 }, (_, h) => median(days.map(d => d[h])));
    }
    log(`  ref ${info.title}: dias ${back.join(',')}, ${Object.keys(med).length} ativas, ${zeradas.length} zeradas`);
    return { refDays: back, med, zeradas };
  }

  function evaluate(dir, med, pts, nowOp) {
    const tss = Object.keys(pts).map(Number).sort((a, b) => a - b);
    const last = tss.length ? tss[tss.length - 1] : null;
    const semDadosMin = last == null ? Infinity : Math.round((nowOp - (last + STEP)) / 60e3);
    if (semDadosMin > SEM_DADOS_MIN) return { st: 'SEM_DADOS', semDadosMin };
    const hours = {}; for (const ts of tss) { const h = new Date(ts).getHours(); hours[h] = (hours[h] || 0) + pts[ts]; }
    const lastH = new Date(last).getHours(); const complete = new Date(last).getMinutes() >= 45 ? lastH : lastH - 1;
    let T = 0, R = 0; const fora = []; let run = 0, persist = false, sgn = 0;
    for (let h = 0; h <= complete; h++) {
      const v = hours[h] || 0, r = med[h] || 0; T += v; R += r;
      const dev = r ? (v - r) / r : 0;
      const out = r >= PISO && ((dir !== 'sucesso' && dev > TOL) || (dir !== 'erro' && dev < -TOL));
      if (out) { fora.push(`${pad(h)}h ${dev > 0 ? '+' : ''}${(dev * 100).toFixed(0)}%`); run++; if (run >= 2) { persist = true; sgn = Math.sign(dev); } } else run = 0;
    }
    const dev = R ? (T - R) / R : 0;
    const accOut = R >= PISO && ((dir !== 'sucesso' && dev > TOL) || (dir !== 'erro' && dev < -TOL));
    // up = direção do alarme: a do acumulado, ou a das horas seguidas fora quando só a persistência disparou (correção de 06/10)
    return { st: (accOut || persist) ? 'ALARME' : 'OK', T, R, dev, fora, complete, acc: accOut, up: accOut ? dev > 0 : sgn > 0 };
  }

  async function runPanel(op, dir, url, nowReal, log) {
    const u = new URL(url), uid = u.pathname.split('/')[2], pid = u.searchParams.get('panelId');
    // Variáveis do dashboard (var-Region=RJ etc.) vão como scopedVars; o backend do EstatView filtra por elas (06/10). "All" é ignorado.
    const vars = [...u.searchParams].filter(([k, v]) => k.startsWith('var-') && k !== 'var-Granularity' && v !== 'All' && v !== '$__all').map(([k, v]) => [k.slice(4), v]);
    const scoped = vars.length ? Object.fromEntries(vars.map(([k, v]) => [k, { text: v, value: [v] }])) : null;
    const vsuf = vars.map(([k, v]) => `${k}=${v}`).join(',');
    const key = `noc:v1:${uid}:${pid}` + (vsuf ? ':' + vsuf : ''), link = linkOf(uid, pid) + vars.map(([k, v]) => `&var-${k}=${encodeURIComponent(v)}`).join('');
    const nowOp = nowReal - (OFFSET[op] || 0), today = dayStr(new Date(nowOp));
    const info0 = await panelInfo(uid, pid), info = vars.length ? { ...info0, title: `${info0.title} [${vars.map(x => x[1]).join(' ')}]` } : info0;
    let c = JSON.parse(localStorage[key] || 'null');
    const dayStart = new Date(nowOp); dayStart.setHours(0, 0, 0, 0);
    if (!c || c.ref?.dia !== today) { c = { ref: await buildRef(info, dayStart, log, scoped), hoje: null, zeroCheck: 0 }; c.ref.dia = today; localStorage[key] = JSON.stringify(c); }
    if (c.hoje?.dia !== today) c.hoje = { dia: today, pts: {}, confirmado: dayStart.getTime() };
    const ativos = info.targets.filter(t => c.ref.med[t.key]);
    const from = Math.max(dayStart.getTime(), (c.hoje.confirmado || dayStart.getTime()) - OVERLAP);
    const data = await query(info.ds, ativos, from, nowReal, scoped);
    let maxTs = c.hoje.confirmado || 0;
    for (const t of ativos) { const p = c.hoje.pts[t.key] = c.hoje.pts[t.key] || {}; for (const [ts, v] of data[t.key]) { if (ts >= dayStart.getTime()) { p[ts] = v; if (ts > maxTs) maxTs = ts; } } }
    c.hoje.confirmado = maxTs;
    const series = ativos.map(t => ({ serie: t.key, ...evaluate(dir, c.ref.med[t.key], c.hoje.pts[t.key], nowOp) }));
    // erro: séries zeradas checadas de hora em hora
    if (dir === 'erro' && c.ref.zeradas?.length && nowReal - (c.zeroCheck || 0) >= H - 5 * 60e3) {
      const zt = info.targets.filter(t => c.ref.zeradas.includes(t.key));
      const z = await query(info.ds, zt, dayStart.getTime(), nowReal, scoped);
      for (const t of zt) { const tot = z[t.key].filter(p => p[0] >= dayStart.getTime()).reduce((a, p) => a + p[1], 0); series.push({ serie: t.key, st: tot > 0 ? 'ERRO_NOVO' : 'OK', T: tot, zerada: true }); }
      c.zeroCheck = nowReal;
    }
    const naoCasadas = info.targets.filter(t => !c.ref.med[t.key] && !(c.ref.zeradas || []).includes(t.key)).map(t => t.key);
    localStorage[key] = JSON.stringify(c);
    log(`${op} ${info.title}: ${series.filter(s => s.st !== 'OK').length} fora`);
    return { op, dir, link, title: info.title, series, naoCasadas };
  }

  function fmtSerie(s) {
    const n = x => Math.round(x).toLocaleString('pt-BR');
    if (s.st === 'ALARME' && !s.acc) return `${s.serie}: horas ${s.fora.join(', ')} (acumulado do dia ${s.dev > 0 ? '+' : ''}${(s.dev * 100).toFixed(1).replace('.', ',')}%)`;
    if (s.st === 'ALARME') return `${s.serie} ${s.dev > 0 ? '+' : ''}${(s.dev * 100).toFixed(1).replace('.', ',')}% (${n(s.T)} × ${n(s.R)} esperados${s.fora.length ? '; horas ' + s.fora.join(', ') : ''})`;
    if (s.st === 'ERRO_NOVO') return `${s.serie}: ${n(s.T)} (série zerada nos últimos 7 dias)`;
    if (s.st === 'SEM_DADOS') return `sem dados há ${s.semDadosMin === Infinity ? '∞' : s.semDadosMin} min (série ${s.serie})`;
    return `${s.serie} ${s.dev > 0 ? '+' : ''}${((s.dev || 0) * 100).toFixed(1).replace('.', ',')}% (hoje × ref)`;
  }

  // Deduplicação (religada em 06/10, 15h40): avisa só quando o status da série muda no dia local da operadora.
  // OK→ALARME/SEM_DADOS/ERRO_NOVO gera alerta; volta para OK gera "voltou ao normal" (sem @here). O resumo sai sempre.
  // Estado: localStorage noc:v1:alertas:<Op>:<dia>. Só é gravado com NOC.commit() depois do envio ao Slack.
  function plan(results, nowReal) {
    const byOp = {};
    for (const r of results) {
      if (!r.series) continue;
      const skey = `noc:v1:alertas:${r.op}:${dayStr(new Date(nowReal - (OFFSET[r.op] || 0)))}`, st = JSON.parse(localStorage[skey] || '{}');
      for (const s of r.series) {
        const k = `serie|${r.link}|${s.serie}`, prev = st[k]?.st || 'OK';
        if (s.st === prev) continue;
        (byOp[r.op] = byOp[r.op] || []).push({ op: r.op, skey, k, st: s.st, prev, title: r.title, link: r.link, txt: fmtSerie(s), s });
      }
    }
    const msgs = [];
    for (const [op, items] of Object.entries(byOp)) {
      const bad = items.filter(i => i.st !== 'OK'), ok = items.filter(i => i.st === 'OK');
      if (bad.length >= 4) msgs.push({ op, items: bad, text: `${MENCAO}[${op}] ${bad.length} séries fora do normal nesta rodada (possível incidente sistêmico):\n` + bad.map(i => `• ${i.title} ${lnk(i.link)}: ${i.st === 'ALARME' ? (i.s.up ? 'acima' : 'abaixo') + ' — ' : i.st === 'ERRO_NOVO' ? 'erro novo — ' : ''}${i.txt}`).join('\n') });
      else for (const i of bad) msgs.push({ op, items: [i], text: i.st === 'ALARME' ? `${MENCAO}[${op}] o ${i.title} ${lnk(i.link)} está com números fora da curva histórica, ${i.s.up ? 'acima' : 'abaixo'} do esperado: ${i.txt} (limite ${Math.round(TOL * 100)}%)`
          : i.st === 'ERRO_NOVO' ? `${MENCAO}[${op}] o ${i.title} ${lnk(i.link)} está com erro novo: ${i.txt}`
          : `${MENCAO}[${op}] o ${i.title} ${lnk(i.link)} está ${i.txt}` });
      if (ok.length) msgs.push({ op, items: ok, text: `[${op}] voltaram ao normal:\n` + ok.map(i => `• ${i.title} ${lnk(i.link)}: ${i.txt}`).join('\n') });
    }
    return msgs;
  }
  // grava como avisado; sem argumento, marca todas as mensagens da rodada
  function commit(idx, nowReal = Date.now()) {
    const list = idx ? idx.map(i => NOC.msgs[i]) : NOC.msgs;
    for (const m of list) for (const it of m.items) { const st = JSON.parse(localStorage[it.skey] || '{}'); st[it.k] = { st: it.st, ts: nowReal }; localStorage[it.skey] = JSON.stringify(st); }
    return 'ok';
  }
  // grava o status atual de todas as séries sem enviar nada (usado quando os alertas já foram enviados por fora)
  function seed(results, nowReal = Date.now()) {
    for (const r of results) { if (!r.series) continue;
      const skey = `noc:v1:alertas:${r.op}:${dayStr(new Date(nowReal - (OFFSET[r.op] || 0)))}`, st = {};
      for (const s of r.series) st[`serie|${r.link}|${s.serie}`] = { st: s.st, ts: nowReal };
      localStorage[skey] = JSON.stringify({ ...JSON.parse(localStorage[skey] || '{}'), ...st }); }
    return 'ok';
  }
  // Follow-up de toda rodada: todos os gráficos verificados, OK e fora.
  function resumo(results, t0) {
    const hhmm = d => `${pad(d.getHours())}h${pad(d.getMinutes())}`;
    const ops = [...new Set(results.map(r => r.op))], linhas = [];
    let nOk = 0, nFora = 0, nErro = 0;
    for (const op of ops) {
      const rs = results.filter(r => r.op === op);
      const short = r => (r.title || r.link).split(' › ').pop();
      const ok = rs.filter(r => r.series && r.series.every(s => s.st === 'OK')), fora = rs.filter(r => r.series && r.series.some(s => s.st !== 'OK')), err = rs.filter(r => !r.series);
      nOk += ok.length; nFora += fora.length; nErro += err.length;
      // agrupa regionais: "Deposito de Chamadas (todas, RJ, SP1)"
      const grp = list => { const m = new Map(); for (const r of list) { const n = short(r), i = n.indexOf(' ['), base = i > 0 ? n.slice(0, i) : n, reg = i > 0 ? n.slice(i + 2, -1) : 'todas'; if (!m.has(base)) m.set(base, []); m.get(base).push(reg); }
        return [...m].map(([b, regs]) => regs.length === 1 && regs[0] === 'todas' ? b : `${b} (${regs.join(', ')})`).join('; '); };
      let l = `**[${op}]** ✅ ${grp(ok) || '—'}`;
      if (fora.length) l += ` | 🔴 ${grp(fora)}`;
      if (err.length) l += ` | ⚠️ não consultado: ${err.map(short).join(', ')}`;
      linhas.push(l);
    }
    return `Rodada NOC ${hhmm(new Date(t0))}: ${results.length} gráficos verificados, ${nOk} OK, ${nFora} fora da curva${nErro ? `, ${nErro} com erro de consulta` : ''}.\n` + linhas.join('\n');
  }

  window.NOC = {
    version: '2026-10-30-fork', state: 'idle', logs: [], result: null, msgs: null,
    status() { return { state: this.state, n: this.logs.length, last: this.logs.slice(-3) }; },
    start(PAINEIS, CONFIG) {
      configure(CONFIG); this.config = CONFIG || {};
      this.state = 'running'; this.logs = []; const t0 = Date.now();
      (async () => {
        const results = [];
        for (const [op, dir, url] of PAINEIS) {
          try { results.push(await runPanel(op, dir, url, Date.now(), m => this.logs.push(m))); }
          catch (e) { results.push({ op, dir, link: url, erro: String(e) }); this.logs.push('ERRO ' + url + ' ' + e); }
        }
        this.result = results; this.msgs = plan(results, Date.now()); this.resumo = resumo(results, t0);
        this.state = `done em ${Math.round((Date.now() - t0) / 1000)} s`;
      })();
      return 'iniciado';
    },
    evaluate, commit, seed,
  };
  return 'NOC ' + window.NOC.version + ' carregado';
})();
