/* Демо-курс: офлайн, без сервера. Данные — window.COURSE из data.js (собирает g2c course).
   Прогресс, ответы и карточки — в localStorage браузера. */
(function () {
  "use strict";
  const C = window.COURSE;
  const $ = (s, el = document) => el.querySelector(s);
  const KEY = "g2c:" + C.chapter.id;
  const st = Object.assign({ visited: {}, last: null, tasks: {}, cards: {}, theme: null }, JSON.parse(localStorage.getItem(KEY) || "{}"));
  const save = () => localStorage.setItem(KEY, JSON.stringify(st));
  const stepById = Object.fromEntries(C.steps.map(s => [s.id, s]));
  const taskById = Object.fromEntries(C.tasks.map(t => [t.id, t]));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TYPE_RU = { single: "один ответ", multiple: "несколько ответов", order: "порядок", gap: "пропуск в тексте", calc: "расчёт" };

  // --- тема -----------------------------------------------------------------------
  if (st.theme) document.documentElement.dataset.theme = st.theme;
  $("#themeBtn").onclick = () => {
    const dark = getComputedStyle(document.documentElement).colorScheme.includes("dark");
    st.theme = dark ? "light" : "dark"; document.documentElement.dataset.theme = st.theme; save();
  };
  $("#menuBtn").onclick = () => { const t = $("#toc"); t.classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", t.classList.contains("open")); };
  document.title = C.chapter.title;

  // --- прогресс и оглавление ----------------------------------------------------------
  function progress() {
    const done = C.steps.filter(s => st.visited[s.id]).length;
    const pct = Math.round(100 * done / Math.max(1, C.steps.length));
    $("#progBar").style.width = pct + "%";
    $("#progText").textContent = `${done}/${C.steps.length}`;
  }
  function toc(current) {
    let h = "";
    for (const p of C.parts) {
      h += `<h2>${esc(p.title)}</h2><ol>`;
      for (const id of p.steps) {
        const s = stepById[id];
        h += `<li><a href="#/step/${encodeURIComponent(id)}" class="${st.visited[id] ? "done" : "todo"}${id === current ? " current" : ""}"${id === current ? ' aria-current="page"' : ""}>${s.order}. ${esc(s.title)}</a></li>`;
      }
      h += "</ol>";
    }
    $("#toc").innerHTML = h;
  }
  function tabs(name) {
    document.querySelectorAll(".tabs a").forEach(a => a.classList.toggle("active", a.dataset.tab === name));
  }

  // --- страницы ---------------------------------------------------------------------------
  function pagePath() {
    const total = C.steps.reduce((a, s) => a + s.minutes, 0);
    let h = `<h1>${esc(C.chapter.title)}</h1>
      <div class="meta"><span class="chip">${C.steps.length} шагов</span><span class="chip">≈ ${total < 60 ? total + " мин" : (Math.round(total / 6) / 10).toString().replace(".", ",") + " ч"}</span>
      <span class="chip">${C.tasks.length} заданий</span><span class="chip">стр. ${esc(C.chapter.pages)}</span></div>`;
    if (st.last && stepById[st.last]) {
      const s = stepById[st.last];
      h += `<div class="resume">Вы остановились на шаге ${s.order}: <b>${esc(s.title)}</b><br><a class="btn primary" href="#/step/${encodeURIComponent(s.id)}">Продолжить</a></div>`;
    }
    for (const p of C.parts) {
      h += `<div class="part"><h2>${esc(p.title)}</h2><ol class="steplist">`;
      for (const id of p.steps) {
        const s = stepById[id];
        h += `<li><a href="#/step/${encodeURIComponent(id)}" class="${st.visited[id] ? "done" : ""}"><span class="n">${st.visited[id] ? "✓" : s.order}</span><span>${esc(s.title)}${s.threshold ? ' <span class="chip thr">пороговая идея</span>' : ""}</span><span class="t">${s.minutes} мин</span></a></li>`;
      }
      h += "</ol></div>";
    }
    h += `<p class="muted">Собрано конвейером из учебного слоя ${esc(C.generated)}. ${esc(C.generated_by)}</p>`;
    return h;
  }

  function pageStep(id) {
    const s = stepById[id];
    if (!s) return `<p>Шаг не найден.</p>`;
    st.visited[id] = true; st.last = id; save();
    const i = C.steps.indexOf(s), prev = C.steps[i - 1], next = C.steps[i + 1];
    const diff = s.difficulty || {};
    let h = `<h1>${esc(s.title)}</h1>`;
    if (s.book_title) h += `<p class="book-title">В книге: ${esc(s.book_title)}</p>`;
    h += `<div class="meta"><span class="chip">шаг ${s.order} из ${C.steps.length}</span><span class="chip">${s.minutes} мин</span>
          <span class="chip">${esc(s.pages)}</span>${diff.primary ? `<span class="chip">тип ${esc(diff.primary)}${diff.secondary ? " / " + esc(diff.secondary) : ""}</span>` : ""}
          ${s.threshold ? '<span class="chip thr">пороговая идея</span>' : ""}${s.is_prereq ? '<span class="chip">предпосылка</span>' : ""}</div>`;
    if (s.prereqs.length) h += `<p class="muted">Опирается на: ${s.prereqs.map(p => `<a href="#/step/${encodeURIComponent(p)}">${esc(stepById[p].title)}</a>`).join(", ")}</p>`;
    if (s.blocks.length > 3) h += `<nav class="stepnav noprint" aria-label="На этой странице">${s.blocks.map(b => `<a href="#/step/${encodeURIComponent(id)}/${b.key}">${esc(b.title)}</a>`).join("")}</nav>`;
    for (const b of s.blocks) {
      const model = /модел/.test(b.note);
      h += `<section class="blk" id="b-${b.key}"><h2>${esc(b.title)}</h2>${b.note ? `<div class="note${model ? " model" : ""}">${esc(b.note)}</div>` : ""}${b.html}</section>`;
    }
    if (s.tasks.length) {
      h += `<section class="blk" id="b-tasks"><h2>Проверьте себя</h2>${s.tasks.map(t => taskHTML(taskById[t])).join("")}</section>`;
    }
    h += `<div class="navbtns">${prev ? `<a class="btn" href="#/step/${encodeURIComponent(prev.id)}">← ${esc(prev.title)}</a>` : "<span></span>"}
          ${next ? `<a class="btn primary" href="#/step/${encodeURIComponent(next.id)}">${esc(next.title)} →</a>` : `<a class="btn primary" href="#/tasks">К заданиям →</a>`}</div>`;
    return h;
  }

  // --- задания --------------------------------------------------------------------------------
  function taskHTML(t) {
    if (!t) return "";
    const saved = st.tasks[t.id];
    let body = "";
    if (t.type === "single" || t.type === "multiple") {
      const kind = t.type === "single" ? "radio" : "checkbox";
      body = t.options.map(o => `<label class="opt"><input type="${kind}" name="t-${esc(t.id)}" value="${esc(o.id)}"><span>${o.html}</span></label>`).join("");
    } else if (t.type === "order") {
      const opts = shuffle(t.options.slice(), t.id);
      body = `<p class="muted">Перетащите за ⠿ или переставьте кнопками.</p><ol class="order" data-task="${esc(t.id)}">` +
        opts.map(o => `<li data-id="${esc(o.id)}"><span class="handle" aria-hidden="true">⠿</span><span>${o.html}</span><span class="mv"><button class="btn" data-mv="-1" aria-label="Выше">↑</button><button class="btn" data-mv="1" aria-label="Ниже">↓</button></span></li>`).join("") + "</ol>";
    } else if (t.type === "gap") {
      let k = 0;
      body = `<p>${t.prompt_html.replace(/\{\{\d+\}\}/g, () => `<input class="gap" data-gap="${k++}" aria-label="пропуск ${k}" autocomplete="off">`)}</p>`;
    } else if (t.type === "calc") {
      body = `<p><input class="calc" type="text" inputmode="decimal" aria-label="ответ"> ${esc(t.unit || "")}</p>`;
    }
    const prompt = t.type === "gap" ? "" : `<p>${t.prompt_html}</p>`;
    return `<div class="task" id="task-${esc(t.id)}" data-task="${esc(t.id)}"><div class="ttype">${TYPE_RU[t.type] || t.type}</div>${prompt}${body}
      <button class="btn primary check">Проверить</button><div class="result" hidden></div>${saved ? `<div class="muted">Прошлая попытка: ${saved.ok ? "верно" : "неверно"}</div>` : ""}</div>`;
  }
  function seeded(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 0) / 4294967296; }
  function shuffle(a, seed) { const r = seeded(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const normTxt = s => String(s).toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  function check(el) {
    const t = taskById[el.dataset.task];
    let ok = false, right = "";
    if (t.type === "single") {
      const v = (el.querySelector("input:checked") || {}).value;
      ok = v === t.answer; right = optText(t, [t.answer]);
    } else if (t.type === "multiple") {
      const v = [...el.querySelectorAll("input:checked")].map(i => i.value).sort();
      ok = JSON.stringify(v) === JSON.stringify([...t.answer].sort()); right = optText(t, t.answer);
    } else if (t.type === "order") {
      const v = [...el.querySelectorAll(".order li")].map(li => li.dataset.id);
      ok = JSON.stringify(v) === JSON.stringify(t.answer); right = t.answer.map((id, i) => `${i + 1}) ${optText(t, [id])}`).join("<br>");
    } else if (t.type === "gap") {
      const v = [...el.querySelectorAll("input.gap")].map(i => normTxt(i.value));
      ok = v.length === t.answer.length && v.every((x, i) => x === normTxt(t.answer[i])); right = t.answer.map(esc).join(", ");
    } else if (t.type === "calc") {
      const raw = el.querySelector("input.calc").value.replace(",", ".").replace(/\s/g, "");
      const v = parseFloat(raw), tol = t.tolerance ?? Math.abs(t.answer) * 0.02;
      ok = !isNaN(v) && Math.abs(v - t.answer) <= tol; right = `${t.answer} ${esc(t.unit || "")}`;
    }
    st.tasks[t.id] = { ok, at: Date.now() }; save();
    const src = (t.claims || []).map(c => `<a href="#/step/${encodeURIComponent(t.step_id)}">стр. ${c.page}</a>`).join(", ");
    const r = el.querySelector(".result");
    r.hidden = false; r.className = "result " + (ok ? "ok" : "bad");
    r.innerHTML = `<b>${ok ? "Верно." : "Неверно."}</b> Правильный ответ: ${right}<br>${t.explanation_html}${src ? `<br><span class="muted">Ответ в тексте шага «${esc((stepById[t.step_id] || {}).title || "")}», ${src}</span>` : ""}`;
  }
  const optText = (t, ids) => ids.map(id => (t.options.find(o => o.id === id) || {}).html || esc(id)).join("; ");

  function pageTasks() {
    const done = C.tasks.filter(t => st.tasks[t.id]), ok = done.filter(t => st.tasks[t.id].ok);
    let h = `<h1>Задания</h1><div class="meta"><span class="chip">${C.tasks.length} заданий</span><span class="chip">решено ${done.length}</span><span class="chip">верно ${ok.length}</span></div>`;
    if (!C.tasks.length) h += `<p class="muted">Задания появятся после этапа «задания» конвейера (g2c tasks).</p>`;
    for (const s of C.steps) {
      const ts = s.tasks.map(id => taskById[id]).filter(Boolean);
      if (!ts.length) continue;
      h += `<h2>${s.order}. ${esc(s.title)}</h2>` + ts.map(taskHTML).join("");
    }
    return h;
  }

  // --- карточки, конспект, карта ----------------------------------------------------------------------
  function pageCards() {
    const counts = { known: 0, again: 0 };
    C.steps.forEach(s => { if (st.cards[s.id]) counts[st.cards[s.id]]++; });
    let h = `<h1>Карточки повторения</h1><div class="meta"><span class="chip">знаю: ${counts.known}</span><span class="chip">повторить: ${counts.again}</span>
      <button class="btn noprint" id="onlyAgain">Только «повторить»</button></div><div class="cards wide">`;
    for (const s of C.steps) {
      const state = st.cards[s.id] || "";
      h += `<div class="card ${state}" data-card="${esc(s.id)}"><b>${s.order}. ${esc(s.title)}</b><span class="muted">Вспомните суть шага, затем откройте ответ.</span>
        <div class="back">${s.card_back}<p><a href="#/step/${encodeURIComponent(s.id)}">к шагу →</a></p></div>
        <div class="acts"><button class="btn flip">Показать</button><button class="btn" data-mark="known">Знаю</button><button class="btn" data-mark="again">Повторить</button></div></div>`;
    }
    return h + "</div>";
  }
  function pageSummary() {
    let h = `<h1>Конспект: ${esc(C.chapter.title)}</h1><p class="noprint"><button class="btn primary" onclick="window.print()">Печать или сохранение в PDF</button></p>`;
    for (const p of C.parts) {
      h += `<h2>${esc(p.title)}</h2>`;
      for (const id of p.steps) {
        const s = stepById[id];
        h += `<div class="sum-step"><h3>${s.order}. ${esc(s.title)} <span class="page">${esc(s.pages)}</span></h3><p>${s.summary}</p>${s.data_summary ? `<p><b>Для данных:</b> ${s.data_summary}</p>` : ""}</div>`;
      }
    }
    return h;
  }
  function pageGlossary(focus) {
    const G = C.glossary || [];
    let h = `<h1>Глоссарий</h1><p class="muted">Термины главы: определение по книге со страницей, английский эквивалент и обозначение. Нажмите на шаг, чтобы вернуться к объяснению.</p>
      <p class="noprint"><input id="gsearch" class="gap" style="width:100%;max-width:420px" placeholder="Поиск термина" aria-label="Поиск термина" autocomplete="off"></p>`;
    if (!G.length) h += `<p class="muted">Глоссарий появится после сборки слоя.</p>`;
    const item = g => {
      const step = g.step_id && stepById[g.step_id];
      return `<div class="gterm${g.slug === focus ? " focus" : ""}${g.has_definition === false ? " nodef" : ""}" id="g-${esc(g.slug)}" data-q="${esc((g.term + " " + g.abbr + " " + g.en).toLowerCase())}">
        <dt><b>${g.term_html || esc(g.term)}</b>${g.abbr ? ` <span class="chip">${esc(g.abbr)}</span>` : ""}${g.en ? ` <span class="en">${esc(g.en)}</span>` : ""}${g.symbol ? ` <span class="muted">${esc(g.symbol)}</span>` : ""}</dt>
        <dd>${g.definition}<div class="note">${g.pages ? esc(g.pages) + " · " : ""}${esc(g.note)}${step ? ` · <a href="#/step/${encodeURIComponent(step.id)}">шаг ${step.order}: ${esc(step.title)}</a>` : ""}</div></dd></div>`;
    };
    const N = C.notation || [];
    if (N.length) {
      h += `<h2>Обозначения: русская школа ↔ западная ↔ данные (${N.length})</h2>
        <p class="muted">Как одно и то же называется в книге, в западной литературе и в файлах данных (LAS, Volve). Соответствия — стандартная нотация SPE/SPWLA; проверяются геологом.</p>
        <div class="table-wrap"><table class="notation"><thead><tr><th>В книге</th><th>Что это</th><th>Западное</th><th>Кривая в данных</th><th>Единицы</th></tr></thead><tbody>` +
        N.map(n => `<tr><td><b>${n.ru_html || esc(n.ru)}</b></td><td><a href="#/glossary/${esc(n.slug)}">${esc(n.name)}</a>${n.note ? `<div class="muted">${esc(n.note)}</div>` : ""}</td><td><b>${esc(n.west)}</b><div class="en">${esc(n.west_name)}</div></td><td><code>${esc(n.las || "—")}</code></td><td>${esc(n.unit)}</td></tr>`).join("") +
        `</tbody></table></div>`;
    }
    const words = G.filter(g => !g.is_symbol), syms = G.filter(g => g.is_symbol);
    if (words.length) h += `<h2>Термины (${words.length})</h2><dl class="glossary">${words.map(item).join("")}</dl>`;
    if (syms.length) h += `<h2>Обозначения (${syms.length})</h2><dl class="glossary">${syms.map(item).join("")}</dl>`;
    return h;
  }
  function pageMap() {
    return `<h1>Карта связей</h1><p class="muted">Стрелка ведёт от шага к шагу, который на него опирается. Пунктир — предпосылки, жёлтая рамка — пороговые идеи, зелёная — пройденные шаги.</p><div class="map wide">${C.map_svg}</div>`;
  }

  // --- перетаскивание (мышь и палец) -----------------------------------------------------------------
  function enableOrder(root) {
    root.querySelectorAll(".order").forEach(list => {
      list.addEventListener("click", e => {
        const b = e.target.closest("[data-mv]"); if (!b) return;
        const li = b.closest("li"), d = +b.dataset.mv;
        if (d < 0 && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
        if (d > 0 && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
        b.focus();
      });
      let drag = null;
      list.addEventListener("pointerdown", e => {
        const h = e.target.closest(".handle"); if (!h) return;
        drag = h.closest("li"); drag.classList.add("dragging"); list.setPointerCapture(e.pointerId); e.preventDefault();
      });
      list.addEventListener("pointermove", e => {
        if (!drag) return;
        const over = document.elementFromPoint(e.clientX, e.clientY);
        const li = over && over.closest(".order li");
        if (!li || li === drag || li.parentElement !== list) return;
        const r = li.getBoundingClientRect();
        list.insertBefore(drag, e.clientY < r.top + r.height / 2 ? li : li.nextElementSibling);
      });
      const end = () => { if (drag) drag.classList.remove("dragging"); drag = null; };
      list.addEventListener("pointerup", end); list.addEventListener("pointercancel", end);
    });
  }

  // --- маршрутизация ------------------------------------------------------------------------------------
  function route() {
    const [, page, id, anchor] = (location.hash || "#/").split("/").map(decodeURIComponent);
    const main = $("#main");
    let html, tab = "path", current = null;
    if (page === "step") { html = pageStep(id); current = id; }
    else if (page === "tasks") { html = pageTasks(); tab = "tasks"; }
    else if (page === "cards") { html = pageCards(); tab = "cards"; }
    else if (page === "summary") { html = pageSummary(); tab = "summary"; }
    else if (page === "map") { html = pageMap(); tab = "map"; }
    else if (page === "glossary") { html = pageGlossary(id); tab = "glossary"; }
    else html = pagePath();
    main.innerHTML = html;
    tabs(tab); toc(current); progress(); enableOrder(main);
    $("#toc").classList.remove("open");
    if (page === "map") main.querySelectorAll("[data-step]").forEach(g => { if (st.visited[g.dataset.step]) g.classList.add("done"); });
    if (page === "glossary") {
      const inp = document.getElementById("gsearch");
      if (inp) inp.addEventListener("input", () => {
        const q = inp.value.toLowerCase().trim();
        document.querySelectorAll(".gterm").forEach(d => { d.hidden = q && !d.dataset.q.includes(q); });
      });
      if (id) { const el = document.getElementById("g-" + id); if (el) { el.scrollIntoView({ block: "center" }); return; } }
    }
    if (anchor) { const el = document.getElementById("b-" + anchor); if (el) el.scrollIntoView(); }
    else { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  }
  document.addEventListener("click", e => {
    const chk = e.target.closest(".task .check"); if (chk) { check(chk.closest(".task")); return; }
    const flip = e.target.closest(".card .flip"); if (flip) { const c = flip.closest(".card"); c.classList.toggle("open"); flip.textContent = c.classList.contains("open") ? "Скрыть" : "Показать"; return; }
    const mark = e.target.closest(".card [data-mark]"); if (mark) { const c = mark.closest(".card"); st.cards[c.dataset.card] = mark.dataset.mark; save(); c.classList.remove("known", "again"); c.classList.add(mark.dataset.mark); return; }
    if (e.target.id === "onlyAgain") document.querySelectorAll(".card").forEach(c => { c.hidden = !c.classList.contains("again"); });
  });
  window.addEventListener("hashchange", route);
  route();
})();
