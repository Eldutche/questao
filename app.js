/* ===== Questões de Concurso — PWA + Supabase ===== */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const LETRAS = ["A", "B", "C", "D", "E"];

let questions = [];      // todas as questões do usuário
let attempts = [];       // todas as tentativas
let editingId = null;    // id em edição (aba Adicionar)
let session = null;      // sessão do quiz
let current = null;      // questão atual
let chosen = null;       // alternativa marcada

/* ---------- utilidades ---------- */
function setMsg(el, text, kind = "") {
  el.textContent = text || "";
  el.className = "msg " + kind;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function show(id, on) { $(id).classList.toggle("hidden", !on); }

/* ---------- autenticação ---------- */
async function boot() {
  if (SUPABASE_URL.includes("SEU-PROJETO")) {
    show("view-auth", true);
    setMsg($("auth-msg"), "Configure o config.js com a URL e a chave do Supabase.", "err");
    return;
  }
  const { data } = await sb.auth.getSession();
  data.session ? enterApp() : showAuth();
  sb.auth.onAuthStateChange((_e, s) => (s ? enterApp() : showAuth()));
}
function showAuth() { show("view-app", false); show("view-auth", true); }
let entered = false;
async function enterApp() {
  if (entered) return;
  entered = true;
  show("view-auth", false); show("view-app", true);
  await loadData();
  renderAddAlts();
  renderAll();
}

$("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg($("auth-msg"), "Entrando…");
  const { error } = await sb.auth.signInWithPassword({ email: $("auth-email").value, password: $("auth-pass").value });
  if (error) setMsg($("auth-msg"), traduzErro(error.message), "err");
});
$("btn-signup").addEventListener("click", async () => {
  const email = $("auth-email").value, password = $("auth-pass").value;
  if (!email || password.length < 6) return setMsg($("auth-msg"), "Informe e-mail e senha (mín. 6 caracteres).", "err");
  setMsg($("auth-msg"), "Criando conta…");
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) return setMsg($("auth-msg"), traduzErro(error.message), "err");
  if (!data.session) setMsg($("auth-msg"), "Conta criada! Confirme o e-mail (se exigido) e entre.", "ok");
});
$("btn-logout").addEventListener("click", async () => {
  await sb.auth.signOut();
  entered = false; questions = []; attempts = [];
});
function traduzErro(m) {
  if (/Invalid login/i.test(m)) return "E-mail ou senha incorretos.";
  if (/already registered/i.test(m)) return "Este e-mail já tem conta. Use “Entrar”.";
  return m;
}

/* ---------- dados ---------- */
async function loadData() {
  const [q, a] = await Promise.all([
    sb.from("questions").select("*").order("created_at", { ascending: false }),
    sb.from("attempts").select("question_id, acertou, created_at").order("created_at", { ascending: false }),
  ]);
  if (q.error) console.error(q.error);
  if (a.error) console.error(a.error);
  questions = q.data || [];
  attempts = a.data || [];
}

function renderAll() {
  renderDisciplinas();
  renderLista();
  renderStats();
}
function disciplinas() {
  return [...new Set(questions.map((q) => (q.disciplina || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
function renderDisciplinas() {
  const ds = disciplinas();
  const sel = $("f-disciplina"), keep = sel.value;
  sel.innerHTML = '<option value="">Todas</option>' + ds.map((d) => `<option>${esc(d)}</option>`).join("");
  sel.value = ds.includes(keep) ? keep : "";
  $("dl-disciplinas").innerHTML = ds.map((d) => `<option value="${esc(d)}">`).join("");
}

/* ---------- abas ---------- */
document.querySelectorAll(".tabbar button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tabbar button").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll(".tab").forEach((t) => t.classList.add("hidden"));
    $("tab-" + b.dataset.tab).classList.remove("hidden");
    if (b.dataset.tab === "stats") renderStats();
    if (b.dataset.tab === "banco") renderLista();
  })
);
function goTab(name) { document.querySelector(`.tabbar button[data-tab="${name}"]`).click(); }

/* ---------- adicionar / editar ---------- */
function renderAddAlts(values = []) {
  $("n-alts").innerHTML = LETRAS.map((l, i) =>
    `<label>Alternativa ${l}<input id="n-alt-${i}" value="${esc(values[i] || "")}" ${i < 2 ? "required" : ""} /></label>`
  ).join("");
}
$("form-q").addEventListener("submit", async (e) => {
  e.preventDefault();
  const alts = LETRAS.map((_, i) => $("n-alt-" + i).value.trim());
  const correta = Number($("n-correta").value);
  const filled = alts.filter(Boolean);
  if (filled.length < 2) return setMsg($("form-msg"), "Preencha ao menos 2 alternativas.", "err");
  if (!alts[correta]) return setMsg($("form-msg"), "A alternativa correta está vazia.", "err");

  // mantém posições (vazias no fim são descartadas)
  let lastIdx = alts.length - 1;
  while (lastIdx >= 0 && !alts[lastIdx]) lastIdx--;
  const payload = {
    enunciado: $("n-enunciado").value.trim(),
    alternativas: alts.slice(0, lastIdx + 1),
    correta,
    disciplina: $("n-disciplina").value.trim() || null,
    banca: $("n-banca").value.trim() || null,
    ano: $("n-ano").value ? Number($("n-ano").value) : null,
    comentario: $("n-comentario").value.trim() || null,
  };

  $("btn-salvar").disabled = true;
  const res = editingId
    ? await sb.from("questions").update(payload).eq("id", editingId)
    : await sb.from("questions").insert(payload);
  $("btn-salvar").disabled = false;
  if (res.error) return setMsg($("form-msg"), "Erro ao salvar: " + res.error.message, "err");

  const wasEdit = !!editingId;
  resetForm();
  setMsg($("form-msg"), wasEdit ? "Questão atualizada ✔" : "Questão salva ✔", "ok");
  await loadData();
  renderAll();
});
function resetForm(keepDisc = true) {
  const disc = $("n-disciplina").value, banca = $("n-banca").value, ano = $("n-ano").value;
  $("form-q").reset();
  renderAddAlts();
  editingId = null;
  $("form-title").textContent = "Nova questão";
  $("btn-salvar").textContent = "Salvar questão";
  show("btn-cancelar-edicao", false);
  if (keepDisc) { $("n-disciplina").value = disc; $("n-banca").value = banca; $("n-ano").value = ano; }
}
$("btn-cancelar-edicao").addEventListener("click", () => { resetForm(false); setMsg($("form-msg"), ""); });

function editQuestion(id) {
  const q = questions.find((x) => x.id === id);
  if (!q) return;
  editingId = id;
  $("n-enunciado").value = q.enunciado;
  renderAddAlts(q.alternativas);
  $("n-correta").value = q.correta;
  $("n-disciplina").value = q.disciplina || "";
  $("n-banca").value = q.banca || "";
  $("n-ano").value = q.ano || "";
  $("n-comentario").value = q.comentario || "";
  $("form-title").textContent = "Editar questão";
  $("btn-salvar").textContent = "Salvar alterações";
  show("btn-cancelar-edicao", true);
  setMsg($("form-msg"), "");
  goTab("adicionar");
  window.scrollTo({ top: 0 });
}

/* ---------- banco ---------- */
function statsFor(qid) {
  const a = attempts.filter((x) => x.question_id === qid);
  return { total: a.length, ok: a.filter((x) => x.acertou).length };
}
function renderLista() {
  const termo = $("b-busca").value.trim().toLowerCase();
  const list = questions.filter((q) => !termo || q.enunciado.toLowerCase().includes(termo));
  if (!list.length) {
    $("lista").innerHTML = `<p class="muted" style="text-align:center">${questions.length ? "Nada encontrado." : "Nenhuma questão ainda. Use a aba Adicionar."}</p>`;
    return;
  }
  $("lista").innerHTML = list.map((q) => {
    const s = statsFor(q.id);
    const meta = [q.disciplina, q.banca, q.ano, s.total ? `${s.ok}/${s.total} acertos` : "não respondida"].filter(Boolean).join(" · ");
    return `<div class="card item">
      <div class="m">${esc(meta)}</div>
      <p class="t">${esc(q.enunciado)}</p>
      <div class="row">
        <button class="btn small" data-edit="${q.id}">Editar</button>
        <button class="btn small danger" data-del="${q.id}">Excluir</button>
      </div></div>`;
  }).join("");
}
$("b-busca").addEventListener("input", renderLista);
$("lista").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
  if (ed) return editQuestion(ed.dataset.edit);
  if (del && confirm("Excluir esta questão e o histórico dela?")) {
    const { error } = await sb.from("questions").delete().eq("id", del.dataset.del);
    if (error) return alert("Erro: " + error.message);
    await loadData(); renderAll();
  }
});

/* ---------- praticar ---------- */
$("btn-iniciar").addEventListener("click", () => {
  const disc = $("f-disciplina").value, modo = $("f-modo").value;
  let pool = questions.filter((q) => !disc || q.disciplina === disc);
  const lastResult = {};
  [...attempts].reverse().forEach((a) => (lastResult[a.question_id] = a.acertou)); // mais recente por último
  if (modo === "erradas") pool = pool.filter((q) => lastResult[q.id] === false);
  if (modo === "novas") pool = pool.filter((q) => !(q.id in lastResult));
  if (!pool.length) {
    show("quiz", false);
    return setMsg($("quiz-msg"), "Nenhuma questão para esse filtro.", "err");
  }
  setMsg($("quiz-msg"), "");
  session = { queue: shuffle(pool), i: 0, ok: 0, done: 0 };
  showQuestion();
});
function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function showQuestion() {
  if (session.i >= session.queue.length) {
    show("quiz", false);
    return setMsg($("quiz-msg"), `Fim! Você acertou ${session.ok} de ${session.done}.`, "ok");
  }
  current = session.queue[session.i];
  chosen = null;
  show("quiz", true);
  const meta = [current.disciplina, current.banca, current.ano].filter(Boolean).join(" · ");
  $("q-meta").textContent = `Questão ${session.i + 1} de ${session.queue.length}` + (meta ? " — " + meta : "");
  $("q-enunciado").textContent = current.enunciado;
  $("q-alts").innerHTML = current.alternativas.map((t, i) =>
    `<button class="alt" data-i="${i}"><b>${LETRAS[i]})</b><span>${esc(t)}</span></button>`).join("");
  $("btn-responder").disabled = true;
  show("q-actions", true); show("q-feedback", false); show("q-next", false);
}
$("q-alts").addEventListener("click", (e) => {
  const b = e.target.closest(".alt");
  if (!b || b.disabled) return;
  chosen = Number(b.dataset.i);
  document.querySelectorAll(".alt").forEach((x) => x.classList.toggle("sel", x === b));
  $("btn-responder").disabled = false;
});
$("btn-responder").addEventListener("click", async () => {
  if (chosen === null) return;
  const acertou = chosen === current.correta;
  document.querySelectorAll(".alt").forEach((x) => {
    x.disabled = true;
    const i = Number(x.dataset.i);
    x.classList.remove("sel");
    if (i === current.correta) x.classList.add("right");
    else if (i === chosen) x.classList.add("wrong");
  });
  session.done++; if (acertou) session.ok++;
  const fb = $("q-feedback");
  fb.innerHTML = `<div class="res ${acertou ? "ok" : "bad"}">${acertou ? "✔ Correto!" : "✘ Errado — resposta: " + LETRAS[current.correta]}</div>` +
    (current.comentario ? esc(current.comentario) : "");
  show("q-actions", false); show("q-feedback", true); show("q-next", true);

  const { error } = await sb.from("attempts").insert({ question_id: current.id, escolhida: chosen, acertou });
  if (!error) attempts.unshift({ question_id: current.id, acertou, created_at: new Date().toISOString() });
});
$("btn-proxima").addEventListener("click", () => { session.i++; showQuestion(); });

/* ---------- estatísticas ---------- */
function renderStats() {
  const total = attempts.length, ok = attempts.filter((a) => a.acertou).length;
  if (!total) { $("stats").innerHTML = '<p class="muted" style="text-align:center">Responda algumas questões para ver seu desempenho.</p>'; return; }
  const pct = Math.round((ok / total) * 100);
  const byDisc = {};
  attempts.forEach((a) => {
    const q = questions.find((x) => x.id === a.question_id);
    const d = (q && q.disciplina) || "Sem disciplina";
    byDisc[d] ??= { t: 0, o: 0 };
    byDisc[d].t++; if (a.acertou) byDisc[d].o++;
  });
  const rows = Object.entries(byDisc).sort((a, b) => b[1].t - a[1].t).map(([d, v]) => {
    const p = Math.round((v.o / v.t) * 100);
    return `<div class="disc-row"><div class="top"><span>${esc(d)}</span><span>${v.o}/${v.t} · ${p}%</span></div>
      <div class="bar"><i style="width:${p}%"></i></div></div>`;
  }).join("");
  $("stats").innerHTML = `<div class="card"><div class="muted">Aproveitamento geral</div>
    <div class="stat-big">${pct}%</div><div class="muted">${ok} acertos em ${total} respostas · ${questions.length} questões no banco</div>
    <div class="bar"><i style="width:${pct}%"></i></div></div>
    <div class="card"><strong>Por disciplina</strong>${rows}</div>`;
}

/* ---------- OCR: preencher questão a partir de um print ---------- */
const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
let ocrBusy = false;

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = TESSERACT_URL;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Não foi possível carregar o leitor de texto. Verifique a internet."));
    document.head.appendChild(s);
  });
}

// Melhora a imagem para o OCR: amplia prints pequenos, tons de cinza, contraste e inverte tema escuro.
async function prepImage(file) {
  const bmp = await createImageBitmap(file);
  let scale = bmp.width < 1400 ? 2 : 1;
  scale = Math.min(scale, 3000 / bmp.width);
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
    sum += g;
  }
  const invert = sum / (d.length / 4) < 110; // fundo escuro
  for (let i = 0; i < d.length; i += 4) {
    let g = d[i];
    if (invert) g = 255 - g;
    g = Math.max(0, Math.min(255, (g - 128) * 1.3 + 128));
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function joinParagraphs(lines) {
  const paras = [];
  let cur = [];
  for (const l of lines) {
    if (l === "") { if (cur.length) paras.push(cur.join(" ")); cur = []; }
    else cur.push(l);
  }
  if (cur.length) paras.push(cur.join(" "));
  return paras.join("\n\n").replace(/[ \t]+/g, " ").trim();
}

// Separa enunciado, alternativas A–E (em sequência) e "Gabarito: X" se existir.
function parseQuestion(raw) {
  let text = raw.replace(/\r/g, "").replace(/-\n(?=[a-zà-ú])/g, "");
  let correta = null;
  text = text.replace(/gabarito\s*[:\-–]?\s*\(?([A-Ea-e])\)?/i, (_m, l) => {
    correta = l.toUpperCase().charCodeAt(0) - 65;
    return "";
  });
  const re = /^\(?([A-Ea-e])\s*[\)\]\.\-–:]\s*(.*)$/;
  const enun = [], alts = [];
  for (const line of text.split("\n").map((l) => l.trim())) {
    const m = line.match(re);
    if (m && alts.length < 5 && m[1].toUpperCase().charCodeAt(0) - 65 === alts.length) {
      alts.push(m[2]);
    } else if (alts.length) {
      if (line) alts[alts.length - 1] += " " + line;
    } else {
      enun.push(line);
    }
  }
  return { enunciado: joinParagraphs(enun), alternativas: alts.map((a) => a.trim()), correta };
}

async function runOcr(file) {
  if (ocrBusy) return;
  const msg = $("ocr-msg");
  if (!file || !file.type.startsWith("image/")) return setMsg(msg, "Escolha um arquivo de imagem.", "err");
  ocrBusy = true;
  $("btn-ocr").disabled = true;
  try {
    const prev = $("ocr-preview");
    prev.src = URL.createObjectURL(file);
    show("ocr-preview", true);

    setMsg(msg, "Carregando leitor de texto… (na 1ª vez demora um pouco)");
    await loadTesseract();
    setMsg(msg, "Preparando imagem…");
    const canvas = await prepImage(file);

    const { data } = await window.Tesseract.recognize(canvas, "por", {
      logger: (m) => {
        if (m.status === "recognizing text") setMsg(msg, `Lendo o texto… ${Math.round(m.progress * 100)}%`);
        else if (m.status && m.status.includes("loading")) setMsg(msg, "Baixando idioma português… (só na 1ª vez)");
      },
    });

    const q = parseQuestion(data.text || "");
    if (!q.enunciado && !q.alternativas.length) return setMsg(msg, "Não consegui ler texto nessa imagem. Tente um print mais nítido e só com a questão.", "err");

    $("n-enunciado").value = q.enunciado;
    renderAddAlts(q.alternativas);
    if (q.correta !== null && q.correta < q.alternativas.length) $("n-correta").value = q.correta;

    const avisos = [];
    if (q.alternativas.length < 2) avisos.push("não identifiquei as alternativas (A, B, C…) — confira os campos");
    if (q.correta === null) avisos.push("marque a alternativa correta");
    setMsg(msg, "Leitura concluída ✔ Revise o texto antes de salvar" + (avisos.length ? " — " + avisos.join("; ") : "."), avisos.length ? "" : "ok");
  } catch (err) {
    console.error(err);
    setMsg(msg, "Erro na leitura: " + (err.message || err), "err");
  } finally {
    ocrBusy = false;
    $("btn-ocr").disabled = false;
    $("ocr-file").value = "";
  }
}

$("btn-ocr").addEventListener("click", () => $("ocr-file").click());
$("ocr-file").addEventListener("change", (e) => runOcr(e.target.files[0]));

// Colar print com Ctrl+V (apenas quando a aba Adicionar estiver aberta)
document.addEventListener("paste", (e) => {
  if ($("tab-adicionar").classList.contains("hidden")) return;
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
  if (!file) return;
  e.preventDefault();
  runOcr(file);
});

// Arrastar e soltar uma imagem sobre a caixa
const ocrBox = $("ocr-box");
["dragenter", "dragover"].forEach((ev) => ocrBox.addEventListener(ev, (e) => { e.preventDefault(); ocrBox.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) => ocrBox.addEventListener(ev, (e) => { e.preventDefault(); ocrBox.classList.remove("drag"); }));
ocrBox.addEventListener("drop", (e) => runOcr(e.dataTransfer.files[0]));

/* ---------- PWA ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.error));
}
boot();
