// script.js - Lógica de votación y visor de clips (versión limpia sin UI de edición)
(function(){
  'use strict';

  const CATEGORY_SELECTOR = '.category';
  const RESET_BTN_ID = 'reset-local';

  // clips por categoría (vacío por defecto)
  const clipsData = {};

  // navegación / indicador
  let categoriesList = [];
  let currentIndex = 0;
  let scrollDebounceTimer = null;

  function scrollToIndex(i){
    if(!categoriesList || categoriesList.length === 0) return;
    const idx = Math.max(0, Math.min(i, categoriesList.length - 1));
    const containerEl = document.querySelector('.container');
    if(containerEl){
      // calcular desplazamiento horizontal relativo al contenedor para evitar cualquier scroll vertical
      const targetRect = categoriesList[idx].getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      const left = targetRect.left - containerRect.left + containerEl.scrollLeft;
      containerEl.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    } else {
      // fallback a scrollIntoView si no existe el contenedor
      categoriesList[idx].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
    currentIndex = idx;
    updateIndicator();
  }

  function updateIndicator(){
    const el = document.getElementById('category-indicator');
    if(!el) return;
    el.textContent = (categoriesList.length ? (currentIndex + 1) + '/' + categoriesList.length : '0/0');
  }

  function detectCurrentIndex(){
    if(!categoriesList || categoriesList.length === 0) return;
    const centerX = window.innerWidth / 2;
    let best = 0; let bestDist = Infinity;
    categoriesList.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const cx = (r.left + r.right) / 2;
      const d = Math.abs(cx - centerX);
      if(d < bestDist){ bestDist = d; best = i; }
    });
    if(best !== currentIndex){ currentIndex = best; updateIndicator(); }
  }

  function debounceDetect(){ clearTimeout(scrollDebounceTimer); scrollDebounceTimer = setTimeout(detectCurrentIndex, 120); }

  // Helpers de almacenamiento
  function sanitizeId(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
  function storageKeyVotes(category, nominee){ return 'gala_votes::' + sanitizeId(category) + '::' + sanitizeId(nominee); }
  function storageKeyVoted(category){ return 'gala_voted::' + sanitizeId(category); }
  function getCount(category, nominee){ return parseInt(localStorage.getItem(storageKeyVotes(category, nominee)) || '0', 10); }
  function setCount(category, nominee, n){ localStorage.setItem(storageKeyVotes(category, nominee), String(n)); }
  function markVoted(category){ localStorage.setItem(storageKeyVoted(category), '1'); }
  function hasVoted(category){ return !!localStorage.getItem(storageKeyVoted(category)); }

  // Render provisional: 3 nominados por categoría si no hay contenidos dinámicos
  function renderPlaceholders(){
    document.querySelectorAll('.category').forEach(card => {
      const cat = card.dataset.category;
      if(card.querySelector('.category-main')) return;
      const html = '' +
        '<div class="category-main">' +
          '<h2 class="category-title">' + cat + '</h2>' +
          '<div class="nominees">' +
            '<div class="nominee" data-name="Provisional A">' +
              '<div class="nominee-card"><div class="nominee-info"><div class="nominee-name">Provisional A</div></div>' +
                '<div class="nominee-actions"><button class="clips-btn" data-slot="0">Ver clips</button>' +
                '<button class="vote-btn">Votar <span class="count">0</span></button></div></div>' +
            '</div>' +
            '<div class="nominee" data-name="Provisional B">' +
              '<div class="nominee-card"><div class="nominee-info"><div class="nominee-name">Provisional B</div></div>' +
                '<div class="nominee-actions"><button class="clips-btn" data-slot="1">Ver clips</button>' +
                '<button class="vote-btn">Votar <span class="count">0</span></button></div></div>' +
            '</div>' +
            '<div class="nominee" data-name="Provisional C">' +
              '<div class="nominee-card"><div class="nominee-info"><div class="nominee-name">Provisional C</div></div>' +
                '<div class="nominee-actions"><button class="clips-btn" data-slot="2">Ver clips</button>' +
                '<button class="vote-btn">Votar <span class="count">0</span></button></div></div>' +
            '</div>' +
          '</div>' +
        '</div>';
      card.insertAdjacentHTML('beforeend', html);
    });
  }

  // Modal de clips
  function openClipModal(title, clips){
    const modal = document.getElementById('clip-modal');
    const body = modal.querySelector('.modal-body');
    modal.querySelector('.modal-title').textContent = title;
    body.innerHTML = '';
    if(!clips || clips.length === 0){
      body.innerHTML = '<p>No hay clips disponibles para este nominado.</p>';
      modal.setAttribute('aria-hidden', 'false');
      return;
    }
    clips.forEach(c => {
      const div = document.createElement('div'); div.className = 'clip-card';
      const thumb = c.embed ? ('<iframe src="' + c.embed + '" allowfullscreen></iframe>') : '<div style="padding:.5rem;color:var(--muted)">No preview</div>';
      div.innerHTML = '<div class="clip-thumb">' + thumb + '</div>' + '<div class="clip-title">' + (c.title||'Clip') + '</div>' + '<div class="clip-source">' + (c.src||'') + '</div>';
      body.appendChild(div);
    });
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeClipModal(){ const modal = document.getElementById('clip-modal'); if(modal) modal.setAttribute('aria-hidden','true'); }
  function bindModalClose(){ const modal = document.getElementById('clip-modal'); if(!modal) return; modal.querySelectorAll('[data-close], .modal-close').forEach(btn => btn.addEventListener('click', closeClipModal)); }

  function updateCountsForCategory(card){
    const category = card.dataset.category;
    // soportar .nominee (dinámico) o .provisional-card (estático en el HTML)
    const items = Array.from(card.querySelectorAll('.nominee')).concat(Array.from(card.querySelectorAll('.provisional-card')));
    items.forEach(n => {
      // intentar obtener nombre desde data-name, luego desde data-nominee en botones, luego desde texto
      let name = n.dataset && n.dataset.name ? n.dataset.name : null;
      if(!name){
        // buscar un button con data-nominee dentro
        const btnWithData = n.querySelector('[data-nominee]');
        if(btnWithData) name = btnWithData.dataset.nominee;
      }
      if(!name){
        const nameEl = n.querySelector('.name, .nominee-name');
        if(nameEl) name = nameEl.textContent.trim();
      }
      const btn = n.querySelector('.vote-btn');
      // el contador puede estar como .count dentro del item o en acciones
      const countSpan = n.querySelector('.count') || card.querySelector('.count');
      if(name && countSpan) countSpan.textContent = getCount(category, name);
      if(hasVoted(category) && btn) btn.disabled = true;
    });

    // además actualizar contadores para clip-slots (si existen)
    const slotButtons = card.querySelectorAll('.clip-slot');
    slotButtons.forEach(slot => {
      const nomineeName = slot.dataset && slot.dataset.nominee ? slot.dataset.nominee : null;
      const countEl = slot.querySelector('.count');
      if(nomineeName && countEl) countEl.textContent = getCount(category, nomineeName);
      // deshabilitar botón de votar si ya se votó en la categoría
      const voteBtn = slot.querySelector('.vote-btn');
      if(voteBtn && hasVoted(category)) voteBtn.disabled = true;
    });
  }

  function goToNextCategory(currentCard){
    if(!categoriesList || categoriesList.length === 0) return;
    if(currentCard){
      const idx = categoriesList.indexOf(currentCard);
      scrollToIndex(idx + 1);
    } else {
      scrollToIndex(currentIndex + 1);
    }
  }

  function bindCategory(card){
    card.addEventListener('click', function(e){
      // CLICK EN IMÁGEN: votar al hacer click en la imagen (slot-body)
      const slotBodyEl = e.target.closest('.slot-body');
      if(slotBodyEl && card.contains(slotBodyEl)){
        const slotEl = slotBodyEl.closest('.clip-slot');
        if(slotEl){
          const nomineeName = slotEl.dataset.nominee || (slotBodyEl.querySelector('img') && slotBodyEl.querySelector('img').alt) || slotEl.dataset.slot;
          if(nomineeName){
            const cat = card.dataset.category;
            if(hasVoted(cat)){
              // ya votado en esta categoría
              // pequeño feedback visual
              slotBodyEl.classList.add('voted');
              setTimeout(()=> slotBodyEl.classList.remove('voted'), 700);
              return;
            }
            const current = getCount(cat, nomineeName);
            setCount(cat, nomineeName, current + 1);
            markVoted(cat);
            slotBodyEl.classList.add('voted');
            updateCountsForCategory(card);
            setTimeout(()=> slotBodyEl.classList.remove('voted'), 900);
            setTimeout(() => goToNextCategory(card), 600);
          }
        }
        return;
      }
      // VOTAR
      if(e.target.classList.contains('vote-btn')){
        // obtener nombre del nominado: preferir data-nominee del botón, sino buscar .nominee o .provisional-card
        const btn = e.target;
        const dataNom = btn.dataset && btn.dataset.nominee ? btn.dataset.nominee : null;
        let name = dataNom;
        if(!name){
          const nomineeEl = btn.closest('.nominee') || btn.closest('.provisional-card');
          if(nomineeEl){
            name = nomineeEl.dataset && nomineeEl.dataset.name ? nomineeEl.dataset.name : null;
            if(!name){
              const nameEl = nomineeEl.querySelector('.name, .nominee-name');
              if(nameEl) name = nameEl.textContent.trim();
            }
          }
        }
        if(!name) return; // no podemos votar sin identificado el nominado
        const cat = card.dataset.category;
        const current = getCount(cat, name);
        setCount(cat, name, current + 1);
        markVoted(cat);
        updateCountsForCategory(card);
        setTimeout(() => goToNextCategory(card), 600);
      }

      // VER CLIPS
      if(e.target.classList.contains('clips-btn')){
        const btn = e.target;
        const dataNom = btn.dataset && btn.dataset.nominee ? btn.dataset.nominee : null;
        const slot = btn.dataset && btn.dataset.slot ? btn.dataset.slot : '0';
        let name = dataNom;
        if(!name){
          const nomineeEl = btn.closest('.nominee') || btn.closest('.provisional-card');
          if(nomineeEl){
            name = nomineeEl.dataset && nomineeEl.dataset.name ? nomineeEl.dataset.name : null;
            if(!name){
              const nameEl = nomineeEl.querySelector('.name, .nominee-name');
              if(nameEl) name = nameEl.textContent.trim();
            }
          }
        }
        const cat = card.dataset.category;
        const clips = (clipsData[cat] && clipsData[cat][slot]) ? clipsData[cat][slot] : [];
        openClipModal((name||'') + ' — Clips', clips);
      }
    });
  }

  // Inicialización
  function init(){
    renderPlaceholders();
    // Envolver dinámicamente el h2 y .category-desc en una sola "cajita" visual
    // para evitar tocar manualmente cada sección en el HTML.
    function wrapCategoryHeaders(){
      document.querySelectorAll('.category').forEach(cat => {
        if(cat.querySelector('.category-header')) return; // ya envuelto
        const h2 = cat.querySelector('h2');
        const desc = cat.querySelector('.category-desc');
        if(h2 && desc){
          const wrapper = document.createElement('div');
          wrapper.className = 'category-header';
          h2.parentNode.insertBefore(wrapper, h2);
          wrapper.appendChild(h2);
          wrapper.appendChild(desc);
        }
      });
    }
    wrapCategoryHeaders();

    // construir lista de categorías y enlazar navegación
    categoriesList = Array.from(document.querySelectorAll(CATEGORY_SELECTOR));
    // enlazar handlers y actualizar contadores
    categoriesList.forEach(card => {
      bindCategory(card);
      updateCountsForCategory(card);
    });
    bindModalClose();

    // indicador inicial y detección
    updateIndicator();
    // detectar índice visible tras un pequeño retardo (por si el layout varía)
    setTimeout(detectCurrentIndex, 50);

    // botones prev/next
    const prevBtn = document.getElementById('prev-cat');
    const nextBtn = document.getElementById('next-cat');
    if(prevBtn) prevBtn.addEventListener('click', () => scrollToIndex(currentIndex - 1));
    if(nextBtn) nextBtn.addEventListener('click', () => scrollToIndex(currentIndex + 1));

    // actualizar indicador al hacer scroll en el contenedor
    const containerEl = document.querySelector('.container');
    if(containerEl) containerEl.addEventListener('scroll', debounceDetect, { passive: true });
    window.addEventListener('resize', debounceDetect);

    const resetBtn = document.getElementById(RESET_BTN_ID);
    if(resetBtn){
      resetBtn.addEventListener('click', () => {
        if(!confirm('¿Restablecer los votos guardados en este navegador?')) return;
        const keys = Object.keys(localStorage).filter(k => k.startsWith('gala_votes::') || k.startsWith('gala_voted::'));
        keys.forEach(k => localStorage.removeItem(k));
        document.querySelectorAll(CATEGORY_SELECTOR).forEach(c => updateCountsForCategory(c));
        alert('Votos locales restablecidos.');
      });
    }
  }

  // Arranque condicionado: esperamos a que el usuario pulse "Empezar a votar" en la pantalla inicial.
  function startApp(){
    const home = document.getElementById('home-screen');
    if(home){
      // activar animación de cierre y esperar a que termine antes de inicializar
      home.classList.add('closing');
      const onTransitionEnd = (ev) => {
        // sólo reaccionar cuando la transición del propio elemento termine
        if(ev.target !== home) return;
        home.removeEventListener('transitionend', onTransitionEnd);
        home.style.display = 'none';
        // marcar que estamos en modo votación para estilos (logo a la derecha, más grande)
        try{ document.body.classList.remove('home-active'); document.body.classList.add('voting'); } catch(e){}
        init();
        // asegurar posición inicial
        scrollToIndex(0);
      };
      home.addEventListener('transitionend', onTransitionEnd);
      // Fallback por si la transición no se dispara: forzar hide + init tras 800ms
      setTimeout(() => {
        if(getComputedStyle(home).display !== 'none'){
          home.removeEventListener('transitionend', onTransitionEnd);
          home.style.display = 'none';
          home.classList.remove('closing');
          try{ document.body.classList.remove('home-active'); document.body.classList.add('voting'); } catch(e){}
          init();
          scrollToIndex(0);
        }
      }, 800);
    } else {
      // no hay pantalla inicial -> arrancar de inmediato
      try{ document.body.classList.remove('home-active'); document.body.classList.add('voting'); } catch(e){}
      init();
      scrollToIndex(0);
    }
  }

  function attachStart(){
    const startBtn = document.getElementById('start-voting');
    const home = document.getElementById('home-screen');
    // Marcar que la pantalla inicial está activa para que CSS oculte logos del header
    try{ if(home && !document.body.classList.contains('home-active')) document.body.classList.add('home-active'); } catch(e){}
    if(startBtn){
      startBtn.addEventListener('click', startApp);
    } else if(!home){
      // si no existe pantalla inicial, arrancar de inmediato
      try{ document.body.classList.remove('home-active'); } catch(e){}
      startApp();
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachStart); else attachStart();

})();