/* 돌봄도 통역 됩니다 — 1차 시제품 (v0.1, 시험용)
 * 원칙: 최대 두 번 터치 / 개인정보·로그 저장 없음 / 문장 데이터는 data/phrases.json 에서만 관리
 */
(() => {
  const $app = document.getElementById('app');
  const ROLE_KO = { patient: '환자', caregiver: '간병사', nurse: '간호사' };
  const DIR_KO = { caregiver: '간병사에게', patient: '환자에게', nurse: '간호사에게' };

  let DATA = null;
  const state = { lang: 'zh', role: null, screen: 'home', cat: null, phrase: null, history: [] };

  // ── 설정 저장 (기기 안에만, 실패해도 동작) ─────────────────────────
  const store = {
    get(k) { try { return localStorage.getItem('dolbom.' + k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem('dolbom.' + k, v); } catch { /* 무시 */ } }
  };

  // ── 음성: 사전 녹음 파일 우선 → 기기 TTS → 실패 시 글자만 ───────────
  let voices = [];
  const loadVoices = () => { try { voices = speechSynthesis.getVoices(); } catch { voices = []; } };
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  let currentAudio = null;

  function langTag(code) {
    if (code === 'ko') return 'ko-KR';
    const l = DATA.languages.find(x => x.code === code);
    return l ? l.tts : code;
  }
  function hasVoice(tag) {
    const base = tag.split('-')[0];
    return voices.some(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(base));
  }
  function speak(phrase, code, onStatus) {
    stopSpeaking();
    const text = code === 'ko' ? phrase.ko : phrase.tr[code];
    const file = phrase.audio && phrase.audio[code];
    if (file) {
      currentAudio = new Audio(file);
      currentAudio.play().then(() => onStatus('ok')).catch(() => ttsSpeak(text, code, onStatus));
      return;
    }
    ttsSpeak(text, code, onStatus);
  }
  // 안드로이드 Chrome 대응: cancel() 직후 바로 speak()하면 소리 없이 무시되는 문제가 있어
  // 말하는 중일 때만 cancel하고 잠깐 쉬었다가 말한다. 2.5초 안에 시작 안 하면 '음성 없음'으로 본다.
  let watchdog = null;
  function ttsSpeak(text, code, onStatus) {
    if (!('speechSynthesis' in window)) return onStatus('none', code);
    const synth = window.speechSynthesis;
    loadVoices();
    const tag = langTag(code);
    const base = tag.split('-')[0];
    const norm = s => (s || '').replace('_', '-').toLowerCase();
    const v = voices.find(x => norm(x.lang) === tag.toLowerCase()) || voices.find(x => norm(x.lang).startsWith(base));
    const u = new SpeechSynthesisUtterance(text);
    u.lang = v ? v.lang.replace('_', '-') : tag; u.rate = 0.85; u.volume = 1;
    if (v) u.voice = v;
    let started = false;
    u.onstart = () => { started = true; clearTimeout(watchdog); onStatus('ok', code); };
    u.onerror = e => { if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; clearTimeout(watchdog); onStatus('none', code); };
    const go = () => {
      try { synth.resume(); synth.speak(u); } catch { return onStatus('none', code); }
      clearTimeout(watchdog);
      watchdog = setTimeout(() => { if (!started) onStatus(voices.length && !hasVoice(tag) ? 'missing' : 'none', code); }, 2500);
    };
    if (synth.speaking || synth.pending) { synth.cancel(); setTimeout(go, 150); } else go();
  }
  function stopSpeaking() {
    clearTimeout(watchdog);
    try { if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); } catch {}
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  }

  // ── 도우미 ─────────────────────────────────────────────────────────
  const icon = name => `<span class="pic" aria-hidden="true">${(window.ICONS[name] || '')}</span>`;
  const ui = key => (DATA.ui[state.lang] || {})[key] || '';
  const langObj = () => DATA.languages.find(l => l.code === state.lang);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const phrasesOf = (role, cat) => DATA.phrases.filter(p => p.active && p.role === role && (!cat || p.category === cat));
  const catsOf = role => DATA.categories.filter(c => c.role === role && phrasesOf(role, c.id).length);

  function go(screen, extra = {}) {
    stopSpeaking();
    state.history.push({ screen: state.screen, cat: state.cat, phrase: state.phrase });
    Object.assign(state, { screen }, extra);
    render();
  }
  function back() {
    stopSpeaking();
    const prev = state.history.pop();
    if (!prev) return render();
    Object.assign(state, prev);
    render();
  }
  function goStart() {
    stopSpeaking();
    state.history = [];
    state.screen = state.role ? 'cats' : 'home';
    state.cat = null; state.phrase = null;
    render();
  }

  // ── 화면 ───────────────────────────────────────────────────────────
  function langPicker() {
    return `<div class="langs" role="radiogroup" aria-label="상대 언어">
      ${DATA.languages.map(l => `<button class="lang ${l.code === state.lang ? 'on' : ''}" data-lang="${l.code}" ${l.enabled ? '' : 'disabled'} role="radio" aria-checked="${l.code === state.lang}">
        <b>${esc(l.label)}</b><small>${l.enabled ? esc(l.ko) : '준비 중'}</small></button>`).join('')}
    </div>`;
  }

  function homeScreen() {
    return `<header class="brand">
        <h1>돌봄도 통역 됩니다</h1>
        <p class="slogan">두 번 누르면, 말이 통한다.</p>
      </header>
      <section>
        <h2 class="label">간병사 언어</h2>
        ${langPicker()}
      </section>
      <section class="roles">
        <h2 class="label">누가 쓰나요?</h2>
        ${['patient', 'caregiver', 'nurse'].map(r => `<button class="role" data-role="${r}">
          ${icon(r === 'nurse' ? 'nurse' : r)}<span>${ROLE_KO[r]}${r === 'caregiver' ? `<small>${esc(ui('caregiver'))}</small>` : ''}</span></button>`).join('')}
      </section>
      ${notice()}`;
  }

  function catsScreen() {
    const r = state.role;
    const cats = catsOf(r);
    const bi = r === 'caregiver';
    const head = r === 'patient' ? '무엇이 필요하세요?' : r === 'caregiver' ? '누구에게 말할까요?' : '간병사에게 전할 말';
    return `${topbar(false)}
      <h2 class="ask">${head}${bi ? `<small>${esc(ui('toPatient'))} · ${esc(ui('toNurse'))}</small>` : ''}</h2>
      <div class="grid ${r === 'caregiver' ? 'two' : ''}">
        ${cats.map(c => `<button class="tile ${c.safety === 'urgent' ? 'urgent' : ''}" data-cat="${c.id}">
          ${icon(c.icon)}<span class="t-ko">${esc(c.ko)}</span>
          ${bi ? `<span class="t-tr">${esc(c.id === 'reply' ? ui('toPatient') : ui('toNurse'))}</span>` : ''}
        </button>`).join('')}
      </div>
      ${r === 'patient' ? `<p class="hint">응급할 때는 호출벨을 누르세요</p>` : ''}`;
  }

  function listScreen() {
    const r = state.role;
    const cat = DATA.categories.find(c => c.id === state.cat);
    const items = phrasesOf(r, state.cat);
    const showTrFirst = r === 'caregiver';
    return `${topbar(true)}
      <h2 class="ask">${icon(cat.icon)}${esc(cat.ko)}</h2>
      <div class="list">
        ${items.map(p => `<button class="say ${p.safety === 'urgent' ? 'urgent' : ''}" data-phrase="${p.id}">
          ${icon(p.icon)}
          <span class="say-text">
            ${showTrFirst ? `<span class="s-main" lang="${langTag(state.lang)}">${esc(p.tr[state.lang] || '')}</span><span class="s-sub">${esc(p.ko)}</span>`
                          : `<span class="s-main">${esc(p.ko)}</span>`}
          </span>
        </button>`).join('')}
      </div>`;
  }

  function sayScreen() {
    const p = DATA.phrases.find(x => x.id === state.phrase);
    const toCode = p.to === 'caregiver' ? state.lang : 'ko';
    const big = toCode === 'ko' ? p.ko : p.tr[state.lang];
    const small = toCode === 'ko' ? p.tr[state.lang] : p.ko;
    const smallTag = toCode === 'ko' ? langTag(state.lang) : 'ko-KR';
    const replayLabel = p.to === 'caregiver' ? `${ui('replay')} · 다시 듣기` : `다시 듣기 · ${ui('replay')}`;
    return `${topbar(true)}
      <p class="dir">${ROLE_KO[p.role]} → ${DIR_KO[p.to]}</p>
      <div class="card ${p.safety}">
        ${icon(p.icon)}
        <p class="big" lang="${langTag(toCode)}">${esc(big)}</p>
        <p class="small" lang="${smallTag}">${esc(small)}</p>
      </div>
      <button class="play" data-play="${toCode}">${icon('speaker')}<span>${esc(replayLabel)}</span></button>
      <p class="voice-status" id="vs" role="status" aria-live="polite"></p>
      ${p.safety === 'urgent' || p.safety === 'caution' ? `<div class="warn">
        <b>응급하거나 상태가 나빠 보이면 호출벨을 누르거나 간호사를 직접 부르세요.</b>
        이 앱은 호출·보고 체계를 대신하지 않습니다.</div>` : ''}
      <p class="testonly">시험용 번역 · ${esc(ui('testOnly'))} · ${esc(p.id)}</p>`;
  }

  function topbar(showBack) {
    return `<nav class="top">
      ${showBack ? `<button class="nav" data-act="back">${icon('back')}<span>뒤로${state.role === 'caregiver' ? '<small>' + esc(ui('back')) + '</small>' : ''}</span></button>` : `<button class="nav ghost" data-act="roles">${icon('home')}<span>역할 바꾸기</span></button>`}
      <span class="who">${ROLE_KO[state.role]} · ${esc(langObj().label)}</span>
      ${showBack ? `<button class="nav" data-act="start">${icon('home')}<span>처음으로${state.role === 'caregiver' ? '<small>' + esc(ui('home')) + '</small>' : ''}</span></button>` : '<span></span>'}
    </nav>`;
  }

  function notice() {
    return `<p class="notice">${esc(DATA.notice)}<br>회원가입·개인정보·대화 기록을 저장하지 않습니다.</p>
      <p class="sign">${esc(DATA.copyright || '© 2026 SOCRA × TESS. All rights reserved.')}<br><span class="ver">v${esc(DATA.version)}</span></p>`;
  }

  function render() {
    const s = state.screen;
    $app.innerHTML = s === 'home' ? homeScreen() : s === 'cats' ? catsScreen() : s === 'list' ? listScreen() : sayScreen();
    $app.dataset.role = state.role || '';
    window.scrollTo(0, 0);
    if (s === 'say') {
      const p = DATA.phrases.find(x => x.id === state.phrase);
      const code = p.to === 'caregiver' ? state.lang : 'ko';
      speak(p, code, voiceStatus); // 터치 직후 바로 재생해야 휴대폰 브라우저가 막지 않음
    }
  }
  function voiceStatus(st, code) {
    const el = document.getElementById('vs');
    if (!el) return;
    const name = code === 'ko' ? '한국어' : (DATA.languages.find(l => l.code === code) || {}).ko || '';
    el.textContent = st === 'missing' ? `이 휴대폰에 ${name} 음성이 설치되어 있지 않아요. 화면 글자를 보여 주세요.`
                   : st === 'none' ? `${name} 음성이 나오지 않았어요. 화면 글자를 보여 주세요.` : '';
  }

  // ── 이벤트 ─────────────────────────────────────────────────────────
  $app.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.lang) { state.lang = d.lang; store.set('lang', d.lang); return render(); }
    if (d.role) { state.role = d.role; store.set('role', d.role); return go('cats'); }
    if (d.cat) return go('list', { cat: d.cat });
    if (d.phrase) return go('say', { phrase: d.phrase });
    if (d.play) { const p = DATA.phrases.find(x => x.id === state.phrase); return speak(p, d.play, voiceStatus); }
    if (d.act === 'back') return back();
    if (d.act === 'start') return goStart();
    if (d.act === 'roles') { state.role = null; store.set('role', ''); state.history = []; state.screen = 'home'; return render(); }
  });

  // ── 앱 속 브라우저(카카오톡·네이버·인스타 등)는 음성 읽기를 지원하지 않음 → 외부 브라우저로 ──
  const UA = navigator.userAgent || '';
  const IN_APP = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|; wv\)/i.test(UA);
  function openExternal() {
    const url = location.href;
    if (/KAKAOTALK/i.test(UA)) { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url); return; }
    if (/Android/i.test(UA)) { location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end'; return; }
  }
  function inAppBanner() {
    if (!IN_APP) return;
    const bar = document.createElement('div');
    bar.className = 'inapp';
    bar.innerHTML = `<b>이 화면에서는 음성이 나오지 않아요.</b><span>Chrome 등 인터넷 앱에서 열어야 소리가 납니다.</span>
      <button type="button" id="openExt">인터넷 앱으로 열기</button>
      <small>안 열리면 오른쪽 위 ⋮ 메뉴에서 '다른 브라우저로 열기'를 누르세요. 주소: <span class="u">${esc(location.origin + location.pathname)}</span></small>`;
    document.body.prepend(bar);
    document.getElementById('openExt').addEventListener('click', openExternal);
    if (/KAKAOTALK/i.test(UA)) { try { sessionStorage.getItem('dolbom.ext') || (sessionStorage.setItem('dolbom.ext', '1'), openExternal()); } catch { openExternal(); } }
  }

  // ── 시작: QR 주소로 역할·언어 바로 지정 가능 (?role=patient&lang=ru) ──
  async function boot() {
    inAppBanner();
    try {
      const res = await fetch('data/phrases.json', { cache: 'no-cache' });
      DATA = await res.json();
    } catch {
      $app.innerHTML = '<p class="notice">문장 데이터를 불러오지 못했어요. 인터넷 연결 후 다시 열어 주세요.</p>';
      return;
    }
    const q = new URLSearchParams(location.search);
    const okLang = c => DATA.languages.some(l => l.code === c && l.enabled);
    const lang = q.get('lang') || store.get('lang');
    if (lang && okLang(lang)) state.lang = lang;
    const role = q.get('role') || store.get('role');
    if (role && ROLE_KO[role]) { state.role = role; state.screen = 'cats'; }
    render();
  }
  boot();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
