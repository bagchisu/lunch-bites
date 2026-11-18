(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=`<div id="app-shell">
  <aside class="app-sidebar" aria-label="Application navigation">
    <a class="sidebar__brand" href="./" aria-label="Lunch Bites capabilities">
      <span class="sidebar__brand-mark" aria-hidden="true">🍱</span>
      <span>Lunch Bites</span>
    </a>
    <section class="sidebar__budget" aria-label="Active budget">
      <span class="sidebar__budget-label">Active budget</span>
      <p id="budget-name"></p>
    </section>
    <nav id="capability-nav" class="capability-nav" aria-label="Capabilities">
      <p class="sidebar__section-label">Capabilities</p>
    </nav>
    <div class="sidebar__footer">
      <button id="updateBtn" class="update-btn sidebar__settings" type="button">Update API Key</button>
    </div>
    <dialog id="apiKeyModal">
      <form id="apiKeyForm">
        <h3>API Key Required</h3>
        <p class="api-key-prompt">
          Enter your Lunch Money access token. Get one from
          <a href="https://my.lunchmoney.app/developers" target="_blank" rel="noreferrer">Lunch Money developers</a>.
        </p>
        <input type="password" id="apiKeyInput" placeholder="API Key" autocomplete="current-password" required>
        <p id="apiKeyError" role="alert" aria-live="polite"></p>
        <button id="saveBtn" type="submit">Save</button>
      </form>
    </dialog>
  </aside>
  <main id="app">
    <div id="capability-root"></div>
  </main>
</div>
`,t=`/lunch-bites/`,n=[{title:`Expenses Treemap`,href:`${t}expenses_treemap.html`,description:`Explore category spending and budget usage.`},{title:`Cash Flow`,href:`${t}cash_flow.html`,description:`A view of upcoming income and expenses in cash accounts.`}],r=`https://api.lunchmoney.dev/v2`,i=`/me`,a=`lunch-bites.access-token`;async function o(e,t){let n=`${r}${t}`,i=await fetch(n,{headers:{Authorization:`Bearer ${e}`}});if(!i.ok)throw Error(`Error accessing ${n}: ${i.status} - ${i.statusText}`);return i.json()}function s(t,r){let s=document.getElementById(`application-root`);if(!s)throw Error(`Application page must include an element with id "application-root".`);s.innerHTML=e;let c=document.getElementById(`capability-root`);if(!c)throw Error(`The shared application shell must include an element with id "capability-root".`);let l=document.getElementById(`apiKeyModal`),u=document.getElementById(`apiKeyForm`),d=document.getElementById(`apiKeyInput`),f=document.getElementById(`apiKeyError`),p=document.getElementById(`saveBtn`),m=document.getElementById(`updateBtn`),h=document.getElementById(`budget-name`),g=sessionStorage.getItem(a)||``,_=!1,v=document.getElementById(`capability-nav`),y=window.location.pathname;for(let e of n){let t=document.createElement(`a`);t.className=`capability-nav__item`,t.href=e.href,e.href===y&&(t.classList.add(`is-active`),t.setAttribute(`aria-current`,`page`));let n=document.createElement(`span`);n.className=`capability-nav__marker`,n.setAttribute(`aria-hidden`,`true`);let r=document.createElement(`span`);r.textContent=e.title,t.append(n,r),v?.appendChild(t)}if(t)c.innerHTML=t;else{let e=document.createElement(`header`);e.className=`app-toolbar`;let t=document.createElement(`div`);t.className=`app-heading`;let r=document.createElement(`p`);r.className=`app-heading__eyebrow`,r.textContent=`Lunch Bites`;let i=document.createElement(`h2`);i.textContent=`Choose a capability`,t.append(r,i),e.appendChild(t);let a=document.createElement(`section`);a.className=`capability-home`,a.setAttribute(`aria-label`,`Available capability`);for(let e of n){let t=document.createElement(`a`);t.className=`capability-launch`,t.href=e.href;let n=document.createElement(`span`);n.className=`capability-launch__marker`,n.setAttribute(`aria-hidden`,`true`);let r=document.createElement(`span`);r.className=`capability-launch__copy`;let i=document.createElement(`span`);i.className=`capability-launch__title`,i.textContent=e.title;let o=document.createElement(`span`);o.className=`capability-launch__description`,o.textContent=e.description,r.append(i,o);let s=document.createElement(`span`);s.className=`capability-launch__arrow`,s.setAttribute(`aria-hidden`,`true`),s.textContent=`→`,t.append(n,r,s),a.appendChild(t)}c.append(e,a)}async function b(){let e=d?.value.trim()||``;if(!e){l?.showModal();return}p instanceof HTMLButtonElement&&(p.disabled=!0),f&&(f.textContent=``);let t;try{t=await o(e,i)}catch(e){f&&(f.textContent=`Unable to verify this API key. Check the key and try again.`),console.error(`Error loading user data:`,e),l?.open||l?.showModal(),p instanceof HTMLButtonElement&&(p.disabled=!1);return}g=e,_=!0,sessionStorage.setItem(a,g),h&&(h.textContent=t.budget_name||``),l?.close();let n={accessToken:g,userInfo:t,getInfo:e=>o(g,e)};if(r)try{await r(n)}catch(e){console.error(`Error initializing capability:`,e)}p instanceof HTMLButtonElement&&(p.disabled=!1)}u?.addEventListener(`submit`,e=>{e.preventDefault(),b()}),m?.addEventListener(`click`,()=>{l?.showModal()}),l?.addEventListener(`cancel`,e=>{_||e.preventDefault()}),d&&(d.value=g),l?.showModal(),g&&b()}export{s as t};