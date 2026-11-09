/* Progressive enhancement. Without JavaScript the page shows a static transcript and every section stays readable.
   The walkthrough is simulated entirely in the browser: it makes no network requests. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ---------- copy buttons ---------- */
  const copyStatus = $('copy-status');
  const selectNode = (node) => {
    const sel = window.getSelection(); if (!sel) return;
    const range = document.createRange(); range.selectNodeContents(node);
    sel.removeAllRanges(); sel.addRange(range);
  };
  document.querySelectorAll('pre[data-copy]').forEach((pre, i) => {
    const code = pre.querySelector('code'); if (!code) return;
    const label = pre.previousElementSibling ? pre.previousElementSibling.textContent.trim() : `step ${i + 1}`;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'copy-button'; btn.textContent = 'Copy';
    btn.setAttribute('aria-label', `Copy commands: ${label}`);
    pre.classList.add('has-copy'); pre.append(btn);
    let t;
    btn.addEventListener('click', async () => {
      clearTimeout(t); if (copyStatus) copyStatus.textContent = '';
      try {
        if (!navigator.clipboard || !window.isSecureContext) throw new Error('no clipboard');
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = 'Copied';
        if (copyStatus) copyStatus.textContent = `Copied: ${label}.`;
      } catch {
        selectNode(code);
        btn.textContent = 'Selected';
        if (copyStatus) copyStatus.textContent = 'Commands selected. Press Control+C or Command+C to copy.';
      }
      t = setTimeout(() => { btn.textContent = 'Copy'; }, 2200);
    });
  });

  /* ---------- walkthrough ---------- */
  // The first proposal (its ID, justification, edits and report) is real output from Current for
  // examples/nextjs-auth. The reads, timings, the revision and the commit hashes are simulated here.
  const term = $('term'); if (!term) return;
  const chain = $('chain'), headEl = $('headhash'), stateEl = $('state'), hint = $('hint');
  const pidEl = $('pid'), revnote = $('revnote'), intentsEl = $('intents');
  const filesEl = $('files'), projnote = $('projnote');
  const review = $('review'), reviewCount = $('review-count');
  const rev1Changes = document.querySelectorAll('#changes .rev1');
  const btn = { approve: $('approve'), revise: $('revise'), reject: $('reject'), apply: $('apply'), replay: $('replay') };
  $('actions').hidden = false;

  const EDITS = [
    ['edit_file', 'app/api/login/route.ts'],
    ['edit_file', 'app/api/login/route.ts'],
    ['edit_file', 'tests/rate-limit.test.ts'],
    ['edit_file', 'tests/rate-limit.test.ts'],
  ];
  const PROPOSALS = [
    {
      id: 'sha256:884ec559ec2e',
      note: 'First proposal for this workflow.',
      count: [['4 edits'], ['2 files'], ['no commands']],
      summary: 'Apply the existing login-specific fixed-window limiter to CSRF-valid login requests before parsing credentials or performing authentication, and verify that the endpoint rejects requests beyond the configured per-IP limit.',
      intents: [...EDITS, ['report', 'Summary for the reviewer']],
    },
    {
      id: 'sha256:3b7f0e91d2a6',
      note: 'Revision 1. Replaces sha256:884ec559ec2e, which is now stale.',
      count: [['4 edits'], ['2 files'], ['1 command', 'risk'], ['1 claim', 'claim']],
      summary: 'Same edits. Now also runs the test suite and claims it passes, so Current checks the result when applying.',
      intents: [...EDITS, ['run_command', 'npm test', true], ['claim', 'npm test exits 0', true], ['report', 'Summary for the reviewer']],
    },
  ];
  const FEEDBACK = 'also run the tests and claim they pass';
  const EFFECT = { edit_file: 'EditFile', run_command: 'RunCommand', claim: 'Claim', report: 'Report' };

  let run = 0, head = null, index = 0, rev = 0;

  // Open the changes automatically on wide screens when a proposal is waiting for a decision.
  // Once the visitor opens or closes the panel themselves, their choice wins.
  const wide = window.matchMedia('(min-width: 981px)');
  let reviewPref = null; // null | 'open' | 'closed'
  review.querySelector('summary').addEventListener('click', () => { reviewPref = review.open ? 'closed' : 'open'; });

  // SHA-256 via Web Crypto. There is deliberately no non-cryptographic fallback:
  // without Web Crypto the blocks say so instead of showing a hash.
  const canHash = !!(window.crypto && crypto.subtle && window.TextEncoder);
  async function sha256(text) {
    if (!canHash) return null;
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch { return null; }
  }

  async function commit(ev, kind) {
    index += 1;
    const prev = head;
    head = await sha256(JSON.stringify({ index, previous: prev, events: [ev], at: Date.now() }));
    const short = (h) => (h ? h.slice(0, 12) : 'n/a');
    const b = document.createElement('div');
    b.className = 'block fresh' + (kind ? ' k-' + kind : '');
    b.innerHTML = `<div class="idx">commit ${index}</div><div class="ev">${esc(ev)}</div>` +
      `<div class="hh">prev ${index === 1 ? 'nil' : short(prev)}<br>sha256 <b>${short(head)}</b></div>`;
    chain.appendChild(b);
    chain.scrollLeft = chain.scrollWidth;
    headEl.textContent = head
      ? 'head sha256:' + head.slice(0, 16) + '…, computed in your browser'
      : 'This browser context has no Web Crypto, so no hashes are shown.';
  }

  const setState = (s, cls) => { stateEl.textContent = s; stateEl.className = 'state' + (cls ? ' ' + cls : ''); };
  const line = (html) => { term.insertAdjacentHTML('beforeend', html + '\n'); term.scrollTop = term.scrollHeight; };
  const show = (...names) => Object.entries(btn).forEach(([k, b]) => { b.hidden = !names.includes(k); });
  const pulse = (b) => { Object.values(btn).forEach((x) => x.classList.remove('pulse')); if (b) b.classList.add('pulse'); };
  const fileRow = (path) => filesEl.querySelector(`li[data-path="${path}"]`);

  async function type(cmd, my) {
    term.insertAdjacentHTML('beforeend', '<span class="p">$ </span>');
    const span = document.createElement('span'); span.className = 'c';
    const caret = document.createElement('span'); caret.className = 'caret';
    term.append(span, caret);
    if (reduce) span.textContent = cmd;
    else for (const ch of cmd) {
      if (my !== run) return false;
      span.textContent += ch; term.scrollTop = term.scrollHeight;
      await sleep(ch === ' ' ? 14 : 8);
    }
    caret.remove(); term.insertAdjacentText('beforeend', '\n');
    return my === run;
  }

  function renderProposal(p) {
    review.classList.remove('ready');
    if (!p) {
      pidEl.textContent = 'No proposal yet';
      revnote.textContent = 'The model is looking at the project layout.';
      intentsEl.innerHTML = '';
      review.hidden = true; review.open = false;
      return;
    }
    pidEl.textContent = p.id;
    revnote.textContent = p.note;
    intentsEl.innerHTML = p.intents.map(([k, v, added]) =>
      `<li${added ? ' class="added"' : ''}><span class="k">${k}</span> ${esc(v)}</li>`).join('');
    reviewCount.innerHTML = p.count.map(([t, k]) => `<span class="chip${k ? ' ' + k : ''}">${esc(t)}</span>`).join('');
    rev1Changes.forEach((el) => { el.hidden = rev === 0; });
    review.hidden = false;
  }

  async function produce(my, reads) {
    setState('planning');
    await commit('ProposalProductionStarted'); if (my !== run) return;
    line(`\n<span class="d">… round 1: the model asked to see ${reads.length} things</span>`);
    for (const p of reads) {
      if (my !== run) return;
      await sleep(110);
      line(`    <span class="ok">✓</span> read_file ${esc(p)}`);
    }
    await sleep(350); if (my !== run) return;
    const p = PROPOSALS[rev];
    line(`\n<span class="b">Agent produced proposal</span>\n  proposal <span class="h">${p.id}…</span>` +
      (rev ? `\n  revision 1, revises <span class="h">${PROPOSALS[0].id}…</span>` : '') + '\n');
    line(`<span class="d">${esc(p.summary)}</span>\n`);
    line('<span class="b">PROPOSED</span>');
    p.intents.forEach(([k, v], i) => line(`  ${String(i + 1).padStart(2)}  ${EFFECT[k].padEnd(11)} ${esc(v)}`));
    await commit('ProposalProduced'); if (my !== run) return;
    renderProposal(p);
    setState('validating');
    await sleep(250); if (my !== run) return;
    line('\n<span class="ok">✓</span> Proposal decoded\n<span class="ok">✓</span> Proposal validated\n');
    await commit('ProposalValidated', 'wait'); if (my !== run) return;
    line('<span class="w">Waiting for approval. Nothing has been applied.</span>\n');
    setState('waiting_for_approval', 'waiting');
    review.classList.add('ready');
    review.open = reviewPref ? reviewPref === 'open' : wide.matches;
    hint.textContent = rev
      ? 'A new proposal needs its own review. Its changes are below.'
      : 'Review the proposed changes below. Note that nothing runs the tests.';
    show('approve', 'revise', 'reject');
    btn.approve.disabled = false; btn.reject.disabled = false; btn.revise.disabled = rev > 0;
    pulse(btn.approve);
  }

  async function start() {
    run += 1; head = null; index = 0; rev = 0;
    const my = run;
    term.innerHTML = ''; chain.innerHTML = '';
    headEl.textContent = canHash ? 'Real SHA-256 hashes, computed in your browser for this demo.'
      : 'This browser context has no Web Crypto, so no hashes are shown.';
    filesEl.querySelectorAll('li[data-path]').forEach((li) => {
      li.classList.remove('new', 'appear'); li.lastElementChild.textContent = 'unchanged';
    });
    projnote.textContent = 'Untouched. The agent can only read what it asks for.';
    renderProposal(null);
    setState('created');
    hint.textContent = 'The agent is reading the project…';
    show('approve', 'revise', 'reject');
    Object.values(btn).forEach((b) => { b.disabled = true; });
    btn.replay.disabled = false; btn.apply.disabled = false;
    pulse(null);
    if (!await type('current run "add rate limiting to the login endpoint" \\\n    --dir examples/nextjs-auth --model "$MODEL"', my)) return;
    await commit('TaskCreated'); await commit('WorkflowCreated');
    await produce(my, ['app/api/login/route.ts', 'lib/rate-limit.ts', 'tests/rate-limit.test.ts', 'lib/csrf.ts']);
  }

  const disableDecisions = () => { btn.approve.disabled = btn.revise.disabled = btn.reject.disabled = true; pulse(null); };
  const pid = () => PROPOSALS[rev].id;

  btn.approve.addEventListener('click', async () => {
    const my = run; disableDecisions(); review.classList.remove('ready');
    if (!await type(`current approve ${pid()} -m "LGTM"`, my)) return;
    line(`<span class="ok">✓</span> Approved ${pid()}\n  message  LGTM\n\n<span class="d">Nothing has been applied. Apply it with:\n  current apply ${pid()}</span>\n`);
    await commit('ProposalApproved', 'approve'); if (my !== run) return;
    setState('approved', 'approved');
    hint.textContent = 'Approval is on the record. Applying is a separate step.';
    show('apply'); btn.apply.disabled = false; pulse(btn.apply); btn.apply.focus({ preventScroll: true });
  });

  btn.revise.addEventListener('click', async () => {
    const my = run; disableDecisions(); review.classList.remove('ready');
    if (!await type(`current revise ${pid()} -m "${FEEDBACK}"`, my)) return;
    line(`<span class="ok">✓</span> Revision requested\n  feedback  ${FEEDBACK}\n`);
    await commit('ProposalRevisionRequested'); if (my !== run) return;
    setState('revision_requested');
    hint.textContent = 'The agent reads more and writes a replacement.';
    rev = 1;
    renderProposal(null);
    await produce(my, ['package.json']);
  });

  btn.reject.addEventListener('click', async () => {
    const my = run; disableDecisions(); review.classList.remove('ready');
    if (!await type(`current reject ${pid()} -m "not now"`, my)) return;
    line(`<span class="x">✗</span> Rejected ${pid()}\n\n<span class="d">The workflow has ended. Nothing was applied.</span>`);
    await commit('ProposalRejected', 'end'); if (my !== run) return;
    setState('rejected', 'ended');
    hint.textContent = 'Rejected. Your project was never touched.';
    show('replay'); btn.replay.focus({ preventScroll: true });
  });

  btn.apply.addEventListener('click', async () => {
    const my = run; btn.apply.disabled = true; pulse(null);
    if (!await type(`current apply ${pid()}`, my)) return;
    setState('applying', 'approved');
    hint.textContent = 'Current, not the agent, is editing the files.';
    await commit('EffectApplicationStarted');
    const effects = PROPOSALS[rev].intents;
    for (const [kind, what] of effects) {
      if (my !== run) return;
      await sleep(kind === 'run_command' ? 700 : 220);
      await commit('EffectApplied: ' + EFFECT[kind]);
      const row = kind === 'edit_file' && fileRow(what);
      if (row) {
        row.classList.add('new'); row.classList.remove('appear'); void row.offsetWidth; row.classList.add('appear');
        row.lastElementChild.textContent = 'edited';
        projnote.textContent = 'Changed by Current, after your approval.';
      }
    }
    if (my !== run) return;
    await commit('EffectApplicationComplete');
    await commit('WorkflowResultAssembled');
    await commit('WorkflowCompleted');
    if (my !== run) return;
    line(`<span class="ok">✓</span> Proposal approved\n` +
      (rev ? '<span class="ok">✓</span> Claim verified: npm test exited 0\n' : '') +
      `<span class="ok">✓</span> Workflow completed\n\nMODE: APPLY\n${effects.length} effects executed.\n\n` +
      `<span class="d">Inspect\n  current events   sha256:5d1e1cdaab24\n  current proposal ${pid()}</span>`);
    setState('completed', 'done');
    hint.textContent = 'Every step is now in the log below.';
    show('replay');
  });

  btn.replay.addEventListener('click', start);

  // Start when the walkthrough comes into view.
  const demo = $('demo');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
    }, { threshold: 0.1 });
    io.observe(demo);
  } else start();
})();
