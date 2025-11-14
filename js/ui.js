// =======================================================
// === LÓGICA DE LA INTERFAZ DE USUARIO (UI) =============
// =======================================================

// --- Lógica de formato para las parejas ---
function updateTournamentHeader(name) {
  const titleElement = document.getElementById('tournamentTitle');
  if (titleElement) {
    titleElement.innerHTML = `<i class="fas fa-tennis-ball"></i> ${name}`;
  }
}

function formatPairDisplay(pair) {
    if (!pair || !pair.players) return '<span>Pareja no definida</span>';
    const separator = ' - '; 
    const pairName = pair.players.join(separator);
    const color = pair.color || '#E0E0E0'; // Color por defecto si no existe
    const borderColor = color.replace('C', 'B').replace('F', 'E');
    return `<span class="pair-box" style="background-color: ${color}; border: 1px solid ${borderColor};">${pairName}</span>`;
}

// --- Lógica de Pestañas ---
function openTab(evt, tabId) {
  var i, tabContents, tabButtons;
  tabContents = document.getElementsByClassName("tab-content");
  for (i = 0; i < tabContents.length; i++) {
    tabContents[i].style.display = "none";
  }
  tabButtons = document.getElementsByClassName("tab-button");
  for (i = 0; i < tabButtons.length; i++) {
    tabButtons[i].className = tabButtons[i].className.replace(" active", "");
  }
  document.getElementById(tabId).style.display = "block";
  evt.currentTarget.className += " active";

  // La lógica de renderizado principal se llama desde onSnapshot en app.js
  // Aquí solo manejamos casos especiales que no dependen de los datos principales
  if (tabId === 'tab-galeria') {
      initGallery();
  }
}

// --- Funciones de Parejas (Gestión de UI) ---

function handleUpdateLimit(){
    const newLimit = parseInt(document.getElementById('limitInput').value);
    if (newLimit >= 2) {
        updateGroupLimit(newLimit); // Llama a la lógica de app.js
    } else {
        alert('El límite debe ser al menos 2.');
        document.getElementById('limitInput').value = groupLimit; // Vuelve al valor anterior
    }
}

// --- NUEVO: Lógica de cambio de modo ---
function handleModeChange() {
    const mode = document.querySelector('input[name="tournamentMode"]:checked').value;
    
    // Ocultar todos los paneles de inputs
    document.getElementById('mode-directed-inputs').style.display = 'none';
    document.getElementById('mode-semi-directed-inputs').style.display = 'none';
    document.getElementById('mode-open-inputs').style.display = 'none';

    // Mostrar el panel correspondiente
    document.getElementById(`mode-${mode}-inputs`).style.display = 'flex';

    // Si el modo ha cambiado, lo guardamos. Pedimos confirmación si hay datos.
    if (mode !== tournamentMode) {
        if (groups[1].length > 0 || groups[2].length > 0 || drawPool.length > 0) {
            if (confirm("Cambiar de modo borrará las parejas y jugadores actuales. ¿Continuar?")) {
                setTournamentMode(mode);
            } else {
                // Si cancela, vuelve a seleccionar el radio button anterior
                document.querySelector(`input[name="tournamentMode"][value="${tournamentMode}"]`).checked = true;
                handleModeChange(); // Vuelve a llamar para restaurar la UI
            }
        } else {
            setTournamentMode(mode);
        }
    }
}

function handleClearGroupResults() {
    if (confirm('¿Estás seguro de que quieres borrar todos los resultados de la fase de grupos? Los enfrentamientos se mantendrán.')) {
        clearGroupResults(); // Lógica en app.js
    }
}

// Renderiza el listado de parejas actual
function renderCurrentPairs(){
  const container = document.getElementById('currentPairs');
  const fragment = document.createDocumentFragment();

  // Sincronizar el radio button con el modo actual al cargar
  const radioToCheck = document.querySelector(`input[name="tournamentMode"][value="${tournamentMode}"]`);
  if (radioToCheck) {
      radioToCheck.checked = true;
  }

  // Actualizar estado del select de grupos
  const groupSelect = document.getElementById('groupSelect');
  if (groupSelect) {
    const options = groupSelect.options;
    for (const g of [1, 2]) {
        const option = Array.from(options).find(opt => parseInt(opt.value) == g);
        if (option) {
          option.disabled = groups[g] && groups[g].length >= groupLimit;
        }
    }
  }

  if (tournamentMode === 'directed') {
      const title = document.createElement('h4');
      title.textContent = 'Parejas Registradas:';
      fragment.appendChild(title);

      for(const g of [1, 2]){
        const groupContainer = document.createElement('div');
        groupContainer.className = 'group-container';

        const currentGroup = groups[g] || [];
        const groupHeader = document.createElement('h4'); // Título más grande
        groupHeader.innerHTML = `<i class="fas fa-users-cog"></i> Grupo ${g} (${currentGroup.length}/${groupLimit} parejas)`;
        groupContainer.appendChild(groupHeader);

        currentGroup.forEach(p => {
            const pairItemDiv = document.createElement('div');
            pairItemDiv.className = 'match-item pair-item';
            pairItemDiv.innerHTML = `
                <span>${formatPairDisplay(p)}</span>
                <div class="pair-actions">
                    <button class="btn-icon btn-edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete"><i class="fas fa-trash-alt"></i></button>
                </div>`;
            
            pairItemDiv.querySelector('.btn-edit').onclick = () => handleEditPair(p.id, g);
            pairItemDiv.querySelector('.btn-delete').onclick = () => handleDeletePair(p.id);

            groupContainer.appendChild(pairItemDiv);
        });
        fragment.appendChild(groupContainer);
      }
  } else {
      // Modos Semidirigido y Abierto
      const title = document.createElement('h4');
      title.innerHTML = `<i class="fas fa-ticket-alt"></i> Bolsa para Sorteo (${drawPool.length} inscritos)`;
      fragment.appendChild(title);

      if (drawPool.length > 0) {
          const poolContainer = document.createElement('div');
          poolContainer.className = 'draw-pool-container';
          drawPool.forEach(item => {
              const itemDiv = document.createElement('div');
              itemDiv.className = 'draw-pool-item';
              if (item.type === 'pair') {
                  itemDiv.innerHTML = `<span><i class="fas fa-user-friends"></i> ${item.players.join(' - ')}</span>`;
              } else {
                  itemDiv.innerHTML = `<span><i class="fas fa-user"></i> ${item.name}</span>`;
              }
              poolContainer.appendChild(itemDiv);
          });
          fragment.appendChild(poolContainer);

          const drawButton = document.createElement('button');
          drawButton.id = 'performDrawBtn';
          drawButton.className = 'btn-primary';
          drawButton.style.marginTop = '15px';
          drawButton.innerHTML = '<i class="fas fa-dice"></i> Realizar Sorteo';
          drawButton.onclick = () => {
              if (confirm("¿Realizar el sorteo? Esto asignará las parejas/jugadores a los grupos y limpiará la bolsa.")) {
                  performDraw(); // Lógica en app.js
                  document.querySelector('.tab-button[onclick*="tab-grupos"]').click(); // Cambia a la pestaña "Cuadro"
              }
          };
          fragment.appendChild(drawButton);
      } else {
          const p = document.createElement('p');
          p.textContent = 'Añade parejas o jugadores para el sorteo.';
          fragment.appendChild(p);
      }
  }

  container.innerHTML = '';
  container.appendChild(fragment);
}

function handleAddPair(){
  const group = parseInt(document.getElementById('groupSelect').value);
  const p1 = document.getElementById('player1').value.trim();
  const p2 = document.getElementById('player2').value.trim();
  
  if(p1 && p2){
    if (groups[group] && groups[group].length >= groupLimit) {
         alert(`ERROR: No se pueden añadir más de ${groupLimit} parejas al Grupo ${group}.`);
         return;
    }
    addPair(group, p1, p2); // Lógica en app.js
    document.getElementById('player1').value = '';
    document.getElementById('player2').value = '';
    document.getElementById('player1').focus();
  } else {
    alert('Debes introducir el nombre de los dos jugadores.');
  }
}

function handleAddSemiPair() {
    const p1 = document.getElementById('semi-p1').value.trim();
    const p2 = document.getElementById('semi-p2').value.trim();
    if (p1 && p2) {
        addPairToPool(p1, p2);
        document.getElementById('semi-p1').value = '';
        document.getElementById('semi-p2').value = '';
        document.getElementById('semi-p1').focus();
    } else {
        alert('Debes introducir el nombre de los dos jugadores.');
    }
}

function handleAddOpenPlayer() {
    const player = document.getElementById('open-player').value.trim();
    if (player) {
        addPlayerToPool(player);
        document.getElementById('open-player').value = '';
        document.getElementById('open-player').focus();
    } else {
        alert('Debes introducir un nombre de jugador.');
    }
}

function handleDeletePair(pairId){
    if(confirm('¿Estás seguro de que quieres eliminar esta pareja? Esto borrará cualquier resultado asociado.')){
        deletePair(pairId); // Lógica en app.js
    }
}

function handleEditPair(pairId, groupId){
    const pair = groups[groupId].find(p => p.id === pairId);
    if (!pair) return;
    
    // Rellenar el modal con los datos actuales
    document.getElementById('editPairId').value = pairId;
    document.getElementById('editPlayer1').value = pair.players[0];
    document.getElementById('editPlayer2').value = pair.players[1];

    // Mostrar el modal
    document.getElementById('editPairModal').style.display = 'block';
}

function handleSaveChanges() {
    const pairId = parseFloat(document.getElementById('editPairId').value); // Convertir a número
    const newP1 = document.getElementById('editPlayer1').value.trim();
    const newP2 = document.getElementById('editPlayer2').value.trim();

    editPair(pairId, newP1, newP2); // Lógica en app.js que ahora sí encontrará la pareja

    document.getElementById('editPairModal').style.display = 'none';
}

// --- Funciones de Partidos ---

function handleGenerateGroupMatches(){
  generateGroupMatches(); // Lógica en app.js
}

function updateGenerateMatchesButtonState() {
    const generateBtn = document.getElementById('generateMatchesBtn');
    if (!generateBtn) return;

    if (matches.length > 0) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-check"></i> Partidos Generados';
    } else {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-cogs"></i> Generar partidos';
    }
}

function renderMatchesList() {
    const container = document.getElementById('matchesList');
    
    updateGenerateMatchesButtonState();

    if (matches.length > 0) { // Siempre mostramos la lista si hay partidos
        const matchesByGroup = { 1: [], 2: [] };
        matches.forEach(m => {
            if (matchesByGroup[m.group]) matchesByGroup[m.group].push(m);
        });

        let html = '';
        for (const groupNum in matchesByGroup) {
            const groupMatches = matchesByGroup[groupNum];
            if (groupMatches.length > 0) {
                html += `<h5><i class="fas fa-users-cog"></i> Grupo ${groupNum}</h5>`;
                groupMatches.forEach(m => {
                    html += `<div class="match-item">${formatPairDisplay(m.a)} <span class="vs">vs</span> ${formatPairDisplay(m.b)}</div>`;
                });
            }
        }
        container.innerHTML = html;
    } else {
        container.innerHTML = '';
    }
}

function renderResultForms(){
  const container = document.getElementById('resultForms');
  let html = '';
  [1, 2].forEach(groupNum => {
    const groupMatches = matches.filter(m => m.group == groupNum);
    if (groupMatches.length > 0) {
        html += `<h4><i class="fas fa-users-cog"></i> Grupo ${groupNum}</h4>`;
        groupMatches.forEach(m => {
            const id = m.id;
            const hasResult = m.sets && m.sets.length > 0;
            const registerButtonClass = hasResult ? 'btn-success' : 'btn-secondary';
            
            const sets = m.sets || [];
            const s_vals = Array(5).fill(null).map((_, i) => ({
                a: sets[i] ? sets[i].a : '',
                b: sets[i] ? sets[i].b : ''
            }));
            
            html += `
                <div class="result-form-item">
                    <table class="result-table">
                        <thead>
                            <tr>
                                <th>Enfrentamiento</th>
                                ${Array(5).fill(null).map((_, i) => `<th>Set ${i+1}</th>`).join('')}
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${formatPairDisplay(m.a)}</td>
                                ${s_vals.map((s, i) => `<td><input type="number" min="0" id="s${i+1}-a-${id}" value="${s.a}" class="set-input"></td>`).join('')}
                                <td rowspan="2">
                                    <button class="${registerButtonClass}" onclick="handleRecordResult(${id})"><i class="fas fa-check"></i> Registrar</button>
                                </td>
                            </tr>
                            <tr>
                                <td>${formatPairDisplay(m.b)}</td>
                                ${s_vals.map((s, i) => `<td><input type="number" min="0" id="s${i+1}-b-${id}" value="${s.b}" class="set-input"></td>`).join('')}
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        });
    }
  });
  container.innerHTML = html;
}

function handleRecordResult(id){
  const sets = [];
  for (let i = 1; i <= 5; i++) {
      const s_a = document.getElementById(`s${i}-a-${id}`).value;
      const s_b = document.getElementById(`s${i}-b-${id}`).value;
      if (s_a !== '' && s_b !== '') {
          sets.push({ a: parseInt(s_a) || 0, b: parseInt(s_b) || 0 });
      } else {
          sets.push({ a: 0, b: 0 });
      }
  }
  recordResult(id, ...sets); // Lógica en app.js
  showNotification('Resultado registrado correctamente.');
}

function showNotification(message) {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => { notification.remove(); }, 3000);
}

function handleShowStandings(standingsData){
  const st = standingsData || computeStandings(); // Usa los datos pasados o los calcula si no existen
  const container = document.getElementById('standings');
  let html = '';
  for(const g of [1,2]){
    html += `<h3><i class="fas fa-list-ol"></i> Grupo ${g}</h3>`;
    html += `<table class="standings-table">
                <thead>
                    <tr>
                        <th>Pos</th><th>Pareja</th><th>Puntos</th><th>Sets Ganados</th><th>Juegos Ganados</th>
                    </tr>
                </thead>
                <tbody>`; 
    if (st[g] && st[g].length > 0) {
        st[g].forEach((r, index) => {
            const rowClass = index < 2 ? 'class="qualified-row"' : '';
            html += `<tr ${rowClass}><td>${index + 1}</td><td>${formatPairDisplay(r.pair)}</td><td>${r.puntos}</td><td>${r.sets}</td><td>${r.juegos}</td></tr>`;
        });
    } else {
        html += `<tr><td colspan="5">No hay datos de clasificación para este grupo.</td></tr>`;
    }
    html += `</tbody></table>`;
  }
  container.innerHTML = html;
}

// --- Funciones de Eliminatorias (UI) ---

function renderKnockoutMatch(containerId, matchData, title, iconClass, matchIdPrefix) {
    // Si se pasa un ID de contenedor, lo usamos. Si no, la función solo devolverá el HTML.
    const container = containerId ? document.getElementById(containerId) : null;
    
    let html = '';
    if (matchData) {
        const match = matchData;
        const id = match.id || matchIdPrefix; // Usar ID del objeto o un prefijo
        const sets = match.sets || [];
        const s_vals = Array(5).fill(null).map((_, i) => ({
            a: sets[i] ? sets[i].a : '',
            b: sets[i] ? sets[i].b : ''
        }));
        const winnerIconA = match.winner === match.a.id ? ` <i class="fas ${iconClass} winner-icon"></i>` : '';
        const winnerIconB = match.winner === match.b.id ? ` <i class="fas ${iconClass} winner-icon"></i>` : '';

        html = `
            <div class="result-form-item knockout-match ${match.winner ? 'match-completed' : ''}">
                ${title ? `<h4><i class="fas ${iconClass}"></i> ${title}</h4>` : ''}
                <table class="result-table">
                    <thead>
                        <tr>
                            <th>Enfrentamiento</th>
                            ${Array(5).fill(null).map((_, i) => `<th>Set ${i+1}</th>`).join('')}
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${formatPairDisplay(match.a)}${winnerIconA}</td>
                            ${s_vals.map((s, i) => `<td><input type="number" min="0" id="${matchIdPrefix}-s${i+1}-a-${id}" value="${s.a}" class="set-input"></td>`).join('')}
                            <td rowspan="2"><button class="btn-secondary" onclick="handleRecordKnockoutResult('${matchIdPrefix}', '${id}')"><i class="fas fa-check"></i> Registrar</button></td>
                        </tr>
                        <tr>
                            <td>${formatPairDisplay(match.b)}${winnerIconB}</td>
                            ${s_vals.map((s, i) => `<td><input type="number" min="0" id="${matchIdPrefix}-s${i+1}-b-${id}" value="${s.b}" class="set-input"></td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>`;
    }

    // Si hay un contenedor, pintamos el HTML. Si no, lo devolvemos como texto.
    if (container) {
        container.innerHTML = html;
    }
    return html;
}

function handleGenerateSemifinals(){
  // Esta función ahora guarda las semifinales que se estén mostrando en ese momento.
  generateSemifinals(); 
  showNotification('Semifinales guardadas oficialmente.');
}

function renderSemifinals(semisToRender) {
    const container = document.getElementById('semis');
    const generateBtn = document.getElementById('generateSemifinalsBtn');
    const currentSemis = semisToRender || []; // Usa las semis pasadas o un array vacío

    // El botón siempre está activo para poder (re)generar.
    generateBtn.disabled = currentSemis.length === 0;
    generateBtn.innerHTML = '<i class="fas fa-cogs"></i> Guardar/Actualizar Semifinales';

    let html = '';
    if (currentSemis.length > 0) {
        currentSemis.forEach((s, index) => {
            html += renderKnockoutMatch(null, s, `Semifinal ${index + 1}`, 'fa-chevron-circle-right', 'semi');
        });
    }
    container.innerHTML = html;
}

function handleGenerateFinals(){
  generateFinals(); // Lógica en app.js
}

function renderFinals() {
    const generateBtn = document.getElementById('generateFinalAndThirdPlaceBtn');
    if (finalMatch || thirdPlace) {
        generateBtn.disabled = true;
    } else {
        generateBtn.disabled = false;
    }
    // Generamos el HTML de ambos y lo juntamos antes de pintar
    const finalContainer = document.getElementById('finals');
    if(finalContainer) {
        const finalHtml = renderKnockoutMatch(null, finalMatch, 'Final', 'fa-crown', 'final');
        const thirdHtml = renderKnockoutMatch(null, thirdPlace, '3er Puesto', 'fa-medal', 'third');
        finalContainer.innerHTML = finalHtml + thirdHtml;
    }
}

function handleGenerateFifthPlaceMatch() {
    generateFifthPlaceMatch(); // Lógica en app.js
}

function renderFifthPlaceMatch() {
    const generateBtn = document.getElementById('generateFifthPlaceBtn');
    if (fifthPlaceMatch) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-check"></i> Partido Creado';
    } else {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-cogs"></i> Generar partido';
    }
    document.getElementById('fifthPlace').innerHTML = renderKnockoutMatch(null, fifthPlaceMatch, null, 'fa-award', 'fifth');
}

function handleGenerateSeventhPlaceMatch() {
    generateSeventhPlaceMatch(); // Lógica en app.js
}

function renderSeventhPlaceMatch() {
    const generateBtn = document.getElementById('generateSeventhPlaceBtn');
    if (seventhPlaceMatch) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-check"></i> Partido Creado';
    } else {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-cogs"></i> Generar partido';
    }
    document.getElementById('seventhPlace').innerHTML = renderKnockoutMatch(null, seventhPlaceMatch, null, 'fa-list-ol', 'seventh');
}

function handleRecordKnockoutResult(matchType, id) {
    const sets = [];
    for (let i = 1; i <= 5; i++) {
        const s_a_el = document.getElementById(`${matchType}-s${i}-a-${id}`);
        const s_b_el = document.getElementById(`${matchType}-s${i}-b-${id}`);
        if (s_a_el && s_b_el) {
            const s_a = s_a_el.value;
            const s_b = s_b_el.value;
            if (s_a !== '' && s_b !== '') {
                sets.push({ a: parseInt(s_a), b: parseInt(s_b) });
            } else {
                sets.push(null);
            }
        }
    }

    switch(matchType) {
        case 'semi':
            recordSemiResult(id, ...sets);
            showNotification('Resultado de semifinal registrado.');
            break;
        case 'final':
            recordFinalResult(...sets);
            showNotification('Resultado final registrado.');
            break;
        case 'third':
            recordThirdPlaceResult(...sets);
            showNotification('Resultado de 3er puesto registrado.');
            break;
        case 'fifth':
            recordFifthPlaceResult(...sets);
            showNotification('Resultado de 5º/6º puesto registrado.');
            break;
        case 'seventh':
            recordSeventhPlaceResult(...sets);
            showNotification('Resultado de 7º/8º puesto registrado.');
            break;
    }
}

// --- Lógica de la Galería ---
let slideIndex = 0;
let imageFiles = [];
let galleryInitialized = false;

function checkImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

async function initGallery() {
    const slideContainer = document.querySelector('.carousel-slide');
    if (!slideContainer || galleryInitialized) {
        if (galleryInitialized) showSlide(slideIndex);
        return;
    }

    slideContainer.innerHTML = '<p>Cargando galería...</p>';
    imageFiles = [];

    for (let i = 1; ; i++) {
        const imageUrl = `img/img${i}.jpg`;
        const exists = await checkImage(imageUrl);
        if (exists) {
            imageFiles.push(imageUrl);
        } else {
            break;
        }
    }

    galleryInitialized = true;

    if (imageFiles.length > 0) {
        slideContainer.innerHTML = imageFiles.map(url => `<img src="${url}" alt="Foto del torneo">`).join('');
        showSlide(0);
    } else {
        slideContainer.innerHTML = '<p>No se encontraron imágenes para la galería.</p>';
    }
}

function moveSlide(n) {
    showSlide(slideIndex += n);
}

function showSlide(n) {
    const slides = document.querySelectorAll('.carousel-slide img');
    if (slides.length === 0) return;

    if (n >= slides.length) slideIndex = 0;
    if (n < 0) slideIndex = slides.length - 1;

    slides.forEach(slide => slide.style.display = 'none');
    slides[slideIndex].style.display = 'block';
}

// --- Inicialización de Eventos ---
document.addEventListener('DOMContentLoaded', () => {
    // Abrir la primera pestaña por defecto
    document.querySelector('.tab-button').click();

    // Asignar eventos a elementos estáticos
    document.getElementById('limitInput').addEventListener('change', handleUpdateLimit);
    document.getElementById('addPairBtn').addEventListener('click', handleAddPair);
    document.getElementById('addSemiPairBtn').addEventListener('click', handleAddSemiPair);
    document.getElementById('addOpenPlayerBtn').addEventListener('click', handleAddOpenPlayer);

    // --- NUEVO: Eventos para el modal de edición ---
    const modal = document.getElementById('editPairModal');
    document.querySelector('.close-button').addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == modal) modal.style.display = 'none';
    });
    document.getElementById('savePairChangesBtn').addEventListener('click', handleSaveChanges);

    document.getElementById('player1').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddPair(); });
    document.getElementById('player2').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddPair(); });
    document.getElementById('changeTournamentBtn').addEventListener('click', () => window.location.href='index.html');
    
    document.getElementById('generateMatchesBtn').addEventListener('click', handleGenerateGroupMatches);

    document.getElementById('clearResultsBtn').addEventListener('click', handleClearGroupResults);

    document.getElementById('generateSemifinalsBtn').addEventListener('click', handleGenerateSemifinals);
    document.getElementById('generateFinalAndThirdPlaceBtn').addEventListener('click', handleGenerateFinals);
    document.getElementById('generateFifthPlaceBtn').addEventListener('click', handleGenerateFifthPlaceMatch);
    document.getElementById('generateSeventhPlaceBtn').addEventListener('click', handleGenerateSeventhPlaceMatch);

    document.querySelector('.carousel-button.prev').addEventListener('click', () => moveSlide(-1));
    document.querySelector('.carousel-button.next').addEventListener('click', () => moveSlide(1));
});