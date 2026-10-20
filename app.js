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
  function ttsSpeak(text, code, onStatus) {
    if (!('speechSynthesis' in window)) return onStatus('none');
    const tag = langTag(code);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = tag; u.rate = 0.85; u.volume = 1;
    const base = tag.split('-')[0];
    const v = voices.find(x => x.lang && x.lang.replace('_', '-').toLowerCase() === tag.toLowerCase())
           || voices.find(x => x.lang && x.lang.toLowerCase().startsWith(base));
    if (v) u.voice = v;
    u.onerror = () => onStatus('none');
    u.onstart = () => onStatus('ok');
    try { speechSynthesis.speak(u); } catch { return onStatus('none'); }
    if (voices.length && !hasVoice(tag)) onStatus('none');
  }
  function stopSpeaking() {
    try { speechSynthesis.cancel(); } catch {}
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
      <p class="sign">© 2026 Socra × Tess · v${esc(DATA.version)}</p>`;
  }

  function render() {
    const s = state.screen;
    $app.innerHTML = s === 'home' ? homeScreen() : s === 'cats' ? catsScreen() : s === 'list' ? listScreen() : sayScreen();
    $app.dataset.role = state.role || '';
    window.scrollTo(0, 0);
    if (s === 'say') {
      const p = DATA.phrases.find(x => x.id === state.phrase);
      const code = p.to === 'caregiver' ? state.lang : 'ko';
      setTimeout(() => speak(p, code, voiceStatus), 150);
    }
  }
  function voiceStatus(st) {
    const el = document.getElementById('vs');
    if (!el) return;
    el.textContent = st === 'none' ? '이 기기에서 음성이 나오지 않아요. 화면 글자를 보여 주세요.' : '';
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

  // ── 시작: QR 주소로 역할·언어 바로 지정 가능 (?role=patient&lang=ru) ──
  async function boot() {
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
