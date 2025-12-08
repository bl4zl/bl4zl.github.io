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
      // Verificar si es la última categoría
      if(idx + 1 >= categoriesList.length){
        // Mostrar pantalla de resultados después de un pequeño delay
        setTimeout(showResultsScreen, 1000);
        return;
      }
      scrollToIndex(idx + 1);
    } else {
      scrollToIndex(currentIndex + 1);
    }
  }

  // Función para obtener los resultados globales
  function getGlobalRankings(){
    const rankings = {};
    
    // Iterar sobre todas las claves del localStorage
    for(let i = 0; i < localStorage.length; i++){
      const key = localStorage.key(i);
      if(key.startsWith('gala_votes::')){
        // Extraer el nombre del nominado de la clave
        const parts = key.split('::');
        if(parts.length >= 3){
          const nominee = parts[2];
          const votes = parseInt(localStorage.getItem(key) || '0', 10);
          if(!rankings[nominee]){
            rankings[nominee] = 0;
          }
          rankings[nominee] += votes;
        }
      }
    }
    
    // Convertir a array y ordenar por votos descendente
    const rankingArray = Object.entries(rankings)
      .map(([name, votes]) => ({ name, votes }))
      .sort((a, b) => b.votes - a.votes);
    
    return rankingArray;
  }

  // Función para mostrar la pantalla de resultados
  function showResultsScreen(){
    const resultsScreen = document.getElementById('results-screen');
    if(!resultsScreen) return;
    
    const container = document.querySelector('.container');
    if(container) container.style.display = 'none';
    
    const rankings = getGlobalRankings();
    const rankingContainer = resultsScreen.querySelector('.results-ranking');
    
    // Limpiar contenido anterior
    rankingContainer.innerHTML = '';
    
    // Crear elemento para cada nominado
    if(rankings.length === 0){
      rankingContainer.innerHTML = '<p>No hay votos registrados.</p>';
    } else {
      rankings.forEach((item, index) => {
        const position = index + 1;
        let medal = '';
        if(position === 1) medal = '🥇';
        else if(position === 2) medal = '🥈';
        else if(position === 3) medal = '🥉';
        
        const rankItem = document.createElement('div');
        rankItem.className = 'rank-item';
        rankItem.style.animationDelay = (index * 100) + 'ms';
        rankItem.innerHTML = `
          <div class="rank-medal">${medal}</div>
          <div class="rank-name">${item.name}</div>
          <div class="rank-votes">${item.votes} votos</div>
        `;
        rankingContainer.appendChild(rankItem);
      });
    }
    
    // Mostrar la pantalla con animación
    resultsScreen.classList.remove('hidden');
    resultsScreen.classList.add('show');
  }

  // Función para resetear la votación
  function resetVotingFromResults(){
    if(!confirm('¿Deseas reiniciar la votación? Se perderán todos los votos.')) return;
    
    // Limpiar localStorage
    const keys = Object.keys(localStorage).filter(k => k.startsWith('gala_votes::') || k.startsWith('gala_voted::'));
    keys.forEach(k => localStorage.removeItem(k));
    
    // Ocultar pantalla de resultados
    const resultsScreen = document.getElementById('results-screen');
    if(resultsScreen){
      resultsScreen.classList.remove('show');
      resultsScreen.classList.add('hidden');
    }
    
    // Mostrar contenedor de categorías
    const container = document.querySelector('.container');
    if(container) container.style.display = '';
    
    // Volver a la primera categoría
    currentIndex = 0;
    scrollToIndex(0);
    
    // Actualizar contadores
    categoriesList.forEach(c => updateCountsForCategory(c));
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

  // Sistema de tela de araña interactiva
  function initParticleSystem(){
    const canvas = document.getElementById('particles-canvas');
    if(!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouseX = 0;
    let mouseY = 0;
    let isAnimating = false;
    
    // Configurar canvas con dimensiones correctas
    function setupCanvas(){
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    
    // Colores más suaves y complementarios al fondo ciberpunk
    const colors = [
      'rgba(168, 85, 247, 0.8)',    // Púrpura
      'rgba(0, 217, 255, 0.8)',     // Cian luminoso
      'rgba(124, 58, 237, 0.7)',    // Púrpura más oscuro
      'rgba(139, 92, 246, 0.7)',    // Púrpura claro
      'rgba(6, 182, 212, 0.7)',     // Cian más oscuro
      'rgba(168, 85, 247, 0.75)',   // Púrpura alternativo
      'rgba(0, 217, 255, 0.75)'     // Cian alternativo
    ];
    
    class Particle {
      constructor(){
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.baseX = this.x;
        this.baseY = this.y;
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.radius = Math.random() * 2.5 + 1;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.originalRadius = this.radius;
      }
      
      update(mx, my){
        // Movimiento suave
        this.x += this.vx;
        this.y += this.vy;
        
        // Oscilación suave hacia la base
        this.baseX += (Math.random() - 0.5) * 1.2;
        this.baseY += (Math.random() - 0.5) * 1.2;
        this.x += (this.baseX - this.x) * 0.08;
        this.y += (this.baseY - this.y) * 0.08;
        
        // Rebotar en bordes
        if(this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if(this.y < 0 || this.y > canvas.height) this.vy *= -1;
        
        this.x = Math.max(0, Math.min(canvas.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height, this.y));
        
        // Reacción al ratón
        const dx = mx - this.x;
        const dy = my - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if(dist < 150){
          this.radius = this.originalRadius + (1 - dist / 150) * 5;
        } else {
          this.radius = this.originalRadius;
        }
      }
      
      draw(){
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Dibujar líneas entre partículas
    function drawNetwork(){
      for(let i = 0; i < particles.length; i++){
        for(let j = i + 1; j < particles.length; j++){
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if(dist < 120){
            ctx.strokeStyle = `rgba(168, 85, 247, ${0.3 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      
      // Conectar al ratón
      for(let i = 0; i < particles.length; i++){
        const dx = mouseX - particles[i].x;
        const dy = mouseY - particles[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if(dist < 150 && dist > 0){
          ctx.strokeStyle = `rgba(0, 217, 255, ${0.6 * (1 - dist / 150)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(mouseX, mouseY);
          ctx.lineTo(particles[i].x, particles[i].y);
          ctx.stroke();
        }
      }
    }
    
    function animate(){
      // Limpiar canvas
      ctx.fillStyle = 'rgba(10, 10, 21, 0)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Actualizar y dibujar
      particles.forEach(p => p.update(mouseX, mouseY));
      drawNetwork();
      particles.forEach(p => p.draw());
      
      // Mantener cantidad de partículas
      while(particles.length < 120) particles.push(new Particle());
      while(particles.length > 120) particles.pop();
      
      requestAnimationFrame(animate);
    }
    
    // Tracking del ratón
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    
    // Inicializar partículas después de un delay
    setTimeout(() => {
      for(let i = 0; i < 120; i++){
        particles.push(new Particle());
      }
      animate();
    }, 100);
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
    
    // Botón para resetear desde la pantalla de resultados
    const resetVotesBtn = document.getElementById('reset-votes');
    if(resetVotesBtn){
      resetVotesBtn.addEventListener('click', resetVotingFromResults);
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

  // Inicializar partículas apenas el DOM esté listo
  function initParticlesEarly(){
    setTimeout(() => {
      initParticleSystem();
    }, 50);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initParticlesEarly);
    document.addEventListener('DOMContentLoaded', attachStart);
  } else {
    initParticlesEarly();
    attachStart();
  }

})();