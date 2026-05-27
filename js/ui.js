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
    return `<span class="pair-box" style="background-color: ${color}; border: 1px solid ${borderColor};" onclick="event.stopPropagation(); handlePairClick(${pair.id})">${pairName}</span>`;
}

let currentPairIdForExport = null; // Variable global para saber qué pareja exportar

function handlePairClick(pairId) {
    currentPairIdForExport = pairId;
    let pair = null;
    for (const g in groups) {
        pair = groups[g].find(p => p.id === pairId);
        if (pair) break;
    }
    if (!pair) return;

    // Recopilamos todos los partidos posibles (fase de grupos + todas las eliminatorias)
    const allMatchesList = [
        ...matches,
        ...semifinals,
        finalMatch,
        thirdPlace,
        fifthPlaceMatch,
        seventhPlaceMatch
    ].filter(m => m && m.a && m.b);

    const pairMatches = allMatchesList.filter(m => m.a.id === pairId || m.b.id === pairId);
    const modal = document.getElementById('pairResultsModal');
    const title = document.getElementById('pairResultsTitle');
    const body = document.getElementById('pairResultsBody');

    title.innerHTML = `<i class="fas fa-history"></i> Historial: ${pair.players.join(' - ')}`;
    
    let html = '';
    if (pairMatches.length === 0) {
        html = '<p style="text-align:center; padding:20px;">No hay partidos registrados para esta pareja.</p>';
    } else {
        html = '<table class="standings-table"><thead><tr><th>Rival</th><th>Resultado</th></tr></thead><tbody>';
        pairMatches.forEach(m => {
            const isA = m.a.id === pairId;
            const rival = isA ? m.b : m.a;
            const res = getMatchResult(m);
            let resStr = '<span style="color:#999">Pendiente</span>';
            if (res) {
                const score = isA ? `${res.setsA}-${res.setsB}` : `${res.setsB}-${res.setsA}`;
                // Generamos el detalle de juegos por cada set disputado
                const gamesDetail = m.sets
                    .filter(s => s && (s.a > 0 || s.b > 0))
                    .map(s => isA ? `${s.a}-${s.b}` : `${s.b}-${s.a}`)
                    .join(', ');

                const win = res.winner === pairId;
                resStr = `<b style="color:${win ? '#2ecc71' : '#e74c3c'}">${score}</b>`;
                if (gamesDetail) {
                    resStr += `<br><span style="font-size: 0.85em; color: #666;">(${gamesDetail})</span>`;
                }
            }
            html += `<tr><td>${formatPairDisplay(rival)}</td><td>${resStr}</td></tr>`;
        });
        html += '</tbody></table>';
    }
    body.innerHTML = html;
    modal.style.display = 'block';
}

async function exportPairHistoryToPDF() {
    if (!currentPairIdForExport) return;

    let pair = null;
    for (const g in groups) {
        pair = groups[g].find(p => p.id === currentPairIdForExport);
        if (pair) break;
    }
    if (!pair) return;

    const pairName = pair.players.join(' - ');
    const allMatchesList = [
        ...matches,
        ...semifinals,
        finalMatch,
        thirdPlace,
        fifthPlaceMatch,
        seventhPlaceMatch
    ].filter(m => m && m.a && m.b);

    const pairMatches = allMatchesList.filter(m => m.a.id === currentPairIdForExport || m.b.id === currentPairIdForExport);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(52, 73, 94);
    doc.text('Historial de Resultados', 14, 20);
    
    doc.setFontSize(14);
    doc.text(pairName, 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Torneo: ${tournamentName}`, 14, 38);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 44);

    const tableData = pairMatches.map(m => {
        const isA = m.a.id === currentPairIdForExport;
        const rival = isA ? m.b.players.join(' - ') : m.a.players.join(' - ');
        const res = getMatchResult(m);
        let scoreStr = 'Pendiente';
        let detailStr = '';
        if (res) {
            scoreStr = isA ? `${res.setsA}-${res.setsB}` : `${res.setsB}-${res.setsA}`;
            detailStr = m.sets
                .filter(s => s && (s.a > 0 || s.b > 0))
                .map(s => isA ? `${s.a}-${s.b}` : `${s.b}-${s.a}`)
                .join(', ');
            detailStr = `(${detailStr})`;
        }
        return [rival, scoreStr, detailStr];
    });

    doc.autoTable({
        startY: 50,
        head: [['Rival', 'Resultado (Sets)', 'Detalle (Juegos)']],
        body: tableData,
        headStyles: { fillColor: [52, 73, 94] },
        alternateRowStyles: { fillColor: [247, 249, 251] }
    });

    doc.save(`Historial_${pairName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}

async function exportStandingsToPDF() {
    const standings = computeStandings();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Título y Cabecera
    doc.setFontSize(18);
    doc.setTextColor(52, 73, 94);
    doc.text('Clasificación General del Torneo', 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Torneo: ${tournamentName}`, 14, 28);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 34);

    let currentY = 40;
    const isGameDiff = classificationMethod === 'gameDifference';

    for (const g of [1, 2]) {
        // Título del Grupo
        doc.setFontSize(14);
        doc.setTextColor(52, 73, 94);
        doc.text(`Grupo ${g}`, 14, currentY + 10);

        // Definir columnas según el criterio
        const head = isGameDiff 
            ? [['Pos', 'Pareja', 'Dif. Juegos', 'Ganados', 'Perdidos']]
            : [['Pos', 'Pareja', 'Puntos', 'Sets', 'Juegos']];

        // Preparar datos de las filas
        const body = (standings[g] || []).map((r, index) => {
            const pairName = r.pair.players.join(' - ') + (r.headToHeadResolved ? ' (E.D.)' : '');
            return isGameDiff
                ? [index + 1, pairName, r.diferenciaJuegos, r.juegos, r.gamesAgainst]
                : [index + 1, pairName, r.puntos, r.sets, r.juegos];
        });

        if (body.length === 0) {
            doc.setFontSize(10);
            doc.text('No hay datos en este grupo.', 14, currentY + 20);
            currentY += 25;
            continue;
        }

        doc.autoTable({
            startY: currentY + 15,
            head: head,
            body: body,
            headStyles: { fillColor: [52, 73, 94] },
            alternateRowStyles: { fillColor: [247, 249, 251] },
            margin: { left: 14 }
        });

        currentY = doc.lastAutoTable.finalY + 10;
    }

    doc.save(`Clasificacion_${tournamentName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
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
}

// --- Funciones de Parejas (Gestión de UI) ---

function handleUpdateLimit(){
    const newLimit = parseInt(document.getElementById('limitInput').value);
    if (newLimit >= 2) {
        updateGroupLimit(newLimit); // Llama a la lógica de app.js
    } else {
        showNotification('El límite debe ser al menos 2.', 'error');
        document.getElementById('limitInput').value = groupLimit; // Vuelve al valor anterior
    }
}

function handleUpdateMaxSets(){
    const newMax = parseInt(document.getElementById('setsInput').value);
    if (newMax >= 1 && newMax <= 5) {
        updateMaxSets(newMax); // Lógica en app.js
    } else {
        showNotification('El número de sets debe estar entre 1 y 5.', 'error');
        document.getElementById('setsInput').value = maxSets; // Vuelve al valor anterior
    }
}

// --- NUEVO: Lógica de cambio de modo ---
async function handleModeChange(forceHide = false) {
    const mode = document.querySelector('input[name="tournamentMode"]:checked').value;
    
    // Ocultar todos los paneles de inputs
    document.getElementById('mode-directed-inputs').style.display = 'none';
    document.getElementById('mode-semi-directed-inputs').style.display = 'none';
    document.getElementById('mode-open-inputs').style.display = 'none';
    
    // Si no estamos forzando el ocultado (porque el torneo ha empezado), mostramos el panel correcto
    if (!forceHide) {
        // Mostrar el panel correspondiente
        document.getElementById(`mode-${mode}-inputs`).style.display = 'flex';
    }

    // SOLO actuar si el modo seleccionado es REALMENTE diferente al actual.
    if (mode !== tournamentMode) {
        // Si hay datos en el torneo, es una acción destructiva, así que pedimos confirmación.
        if (groups[1].length > 0 || groups[2].length > 0 || drawPool.length > 0) {
            const confirmed = await showConfirm({
                title: 'Cambiar Modo',
                message: 'Cambiar de modo borrará las parejas y jugadores actuales. ¿Continuar?',
                isDanger: true
            });
            if (confirmed) {
                setTournamentMode(mode); // Lógica en app.js
            } else {
                // Si cancela, vuelve a seleccionar el radio button anterior
                document.querySelector(`input[name="tournamentMode"][value="${tournamentMode}"]`).checked = true;
            }
        }
    }
}

async function handleClearGroupResults() {
    const confirmed = await showConfirm({
        title: 'Limpiar Resultados',
        message: '¿Estás seguro de que quieres borrar todos los resultados de la fase de grupos? Los enfrentamientos se mantendrán.',
        isDanger: true
    });
    if (confirmed) {
        clearGroupResults(); // Lógica en app.js
    }
}

// --- NUEVO: Lógica de cambio de criterio de clasificación ---
function handleClassificationMethodChange() {
    const method = document.querySelector('input[name="classificationMethod"]:checked').value;
    if (method !== classificationMethod) {
        updateClassificationMethod(method); // Lógica en app.js
        showNotification('Criterio de clasificación actualizado.');
    }
}

// Renderiza el listado de parejas actual
function renderCurrentPairs(){
  const container = document.getElementById('currentPairs');
  const fragment = document.createDocumentFragment();

  // --- LÓGICA PARA DESHABILITAR EL CAMBIO DE MODO ---
  const tournamentHasStarted = hasTournamentStarted(); // Lógica en app.js
  const modeRadios = document.querySelectorAll('input[name="tournamentMode"]');
  
  // Elementos a deshabilitar/ocultar si el torneo ha empezado
  const limitInput = document.getElementById('limitInput');
  const setsInput = document.getElementById('setsInput');
  const addPairForms = document.querySelectorAll('.input-group'); // Coge todos los formularios de añadir

  modeRadios.forEach(radio => {
      radio.disabled = tournamentHasStarted;
      // Limpiar el resaltado anterior
      radio.parentElement.classList.remove('highlighted-mode');
  });

  // Deshabilitar inputs si el torneo ha comenzado
  if (setsInput) {
    setsInput.value = maxSets;
    setsInput.disabled = tournamentHasStarted;
  }

  limitInput.disabled = tournamentHasStarted;
  if (tournamentHasStarted) {
    // Si el torneo ha empezado, ocultamos todos los formularios de añadir.
    addPairForms.forEach(form => form.style.display = 'none');
  } else {
    // Si el torneo NO ha empezado, nos aseguramos de que se muestre el formulario correcto.
    handleModeChange(); 
  }

  if (tournamentHasStarted) {
      // Resaltar el modo actual y mostrar advertencia
      document.querySelector('input[name="tournamentMode"]:checked').parentElement.classList.add('highlighted-mode');
      document.getElementById('mode-change-warning').style.display = 'block';
  }

  // Sincronizar el radio button con el modo actual al cargar
  const radioToCheck = document.querySelector(`input[name="tournamentMode"][value="${tournamentMode}"]`);
  if (radioToCheck) {
      radioToCheck.checked = true;
  }

  // Sincronizar el criterio de clasificación
  const classificationRadio = document.querySelector(`input[name="classificationMethod"][value="${classificationMethod}"]`);
  if (classificationRadio) {
      classificationRadio.checked = true;
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

  // --- LÓGICA DE RENDERIZADO: Mostrar grupos si existen, si no, mostrar la bolsa de sorteo ---
  const hasPairsInGroups = (groups[1] && groups[1].length > 0) || (groups[2] && groups[2].length > 0);

  if (hasPairsInGroups) {
    // Si hay parejas en los grupos, las mostramos (esto ocurre en modo dirigido o después de un sorteo)
    const title = document.createElement('h4');
    title.textContent = 'Parejas Registradas:';
    fragment.appendChild(title);

    for(const g of [1, 2]){
      const groupContainer = document.createElement('div');
      groupContainer.className = 'group-container';

      const currentGroup = groups[g] || [];
      const groupHeader = document.createElement('h4');
      groupHeader.innerHTML = `<i class="fas fa-users-cog"></i> Grupo ${g} (${currentGroup.length}/${groupLimit} parejas)`;
      groupContainer.appendChild(groupHeader);

      currentGroup.forEach(p => {
          const pairItemDiv = document.createElement('div');
          pairItemDiv.className = 'match-item pair-item';
          pairItemDiv.innerHTML = `
              <span>${formatPairDisplay(p)}</span>
              <div class="pair-actions">
                  <button class="btn-icon btn-edit" title="Editar pareja"><i class="fas fa-edit"></i></button>
                  <button class="btn-icon btn-delete" title="Eliminar pareja"><i class="fas fa-trash-alt"></i></button>
              </div>`;
          
          pairItemDiv.querySelector('.btn-edit').onclick = () => handleEditPair(p.id, g);
          const deleteBtn = pairItemDiv.querySelector('.btn-delete');
          // Deshabilitar el botón de borrar si el torneo ha empezado
          deleteBtn.disabled = tournamentHasStarted;
          deleteBtn.onclick = () => handleDeletePair(p.id);

          groupContainer.appendChild(pairItemDiv);
      });
      fragment.appendChild(groupContainer);
    }
  } else if (tournamentMode !== 'directed') {
    // Si NO hay parejas en grupos Y el modo es de sorteo, mostramos la bolsa
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
        drawButton.onclick = async () => {
            const confirmed = await showConfirm({
                title: 'Realizar Sorteo',
                message: 'Esto asignará las parejas a los grupos y vaciará la bolsa. ¿Continuar?'
            });
            if (confirmed) {
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
  const groupSelect = document.getElementById('groupSelect');
  let group = parseInt(groupSelect.value);
  const p1 = document.getElementById('player1').value.trim();
  const p2 = document.getElementById('player2').value.trim();
  
  if(p1 && p2){
    // Comprobar si el grupo seleccionado está lleno antes de intentar añadir
    if (groups[group] && groups[group].length >= groupLimit) {
        // Intentar saltar automáticamente al otro grupo si tiene hueco
        const otherGroup = (group === 1) ? 2 : 1;
        if (groups[otherGroup] && groups[otherGroup].length < groupLimit) {
            showNotification(`Grupo ${group} completo. Saltando al Grupo ${otherGroup} automáticamente.`, 'info');
            group = otherGroup;
            groupSelect.value = group;
        } else {
            showNotification(`¡Atención! Ambos grupos han alcanzado el límite de ${groupLimit} parejas.`, 'error');
            return;
        }
    }

    addPair(group, p1, p2); 
    document.getElementById('player1').value = '';
    document.getElementById('player2').value = '';
    document.getElementById('player1').focus();

    // Mejora: Si tras añadir esta pareja el grupo se ha llenado, pre-seleccionamos el siguiente si hay hueco
    const nextGroup = (group === 1) ? 2 : 1;
    if (groups[group].length >= groupLimit && groups[nextGroup].length < groupLimit) {
        groupSelect.value = nextGroup;
    }
  } else {
    showNotification('Debes introducir el nombre de los dos jugadores.', 'error');
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
        showNotification('Debes introducir el nombre de los dos jugadores.', 'error');
    }
}

function handleAddOpenPlayer() {
    const player = document.getElementById('open-player').value.trim();
    if (player) {
        addPlayerToPool(player);
        document.getElementById('open-player').value = '';
        document.getElementById('open-player').focus();
    } else {
        showNotification('Debes introducir un nombre de jugador.', 'error');
    }
}

async function handleDeletePair(pairId) {
    const confirmed = await showConfirm({
        title: 'Eliminar Pareja',
        message: '¿Estás seguro de que quieres eliminar esta pareja? Esto borrará sus resultados y enfrentamientos.',
        isDanger: true
    });
    if (confirmed) {
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
            const s_vals = Array(maxSets).fill(null).map((_, i) => ({
                a: sets[i] ? sets[i].a : '',
                b: sets[i] ? sets[i].b : ''
            }));
            
            html += `
                <div class="result-form-item">
                    <table class="result-table">
                        <thead>
                            <tr>
                                <th>Enfrentamiento</th>
                                ${Array(maxSets).fill(null).map((_, i) => `<th>Set ${i+1}</th>`).join('')}
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
  for (let i = 1; i <= maxSets; i++) {
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

function showConfirm({ title, message, okText, isDanger = false, needsPassword = false }) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        const icon = document.getElementById('confirmIcon');
        const pwdArea = document.getElementById('confirmPasswordArea');
        const pwdInput = document.getElementById('confirmPasswordInput');

        titleEl.textContent = title;
        messageEl.textContent = message;
        okBtn.textContent = okText || 'Aceptar';
        okBtn.className = isDanger ? 'btn-danger' : 'btn-primary';
        icon.className = isDanger ? 'fas fa-exclamation-triangle' : 'fas fa-question-circle';
        pwdArea.style.display = needsPassword ? 'block' : 'none';
        pwdInput.value = '';

        modal.style.display = 'block';

        okBtn.onclick = () => {
            if (needsPassword && pwdInput.value !== "Traid1959") {
                showNotification("Contraseña incorrecta", "error");
                return;
            }
            modal.style.display = 'none';
            resolve(true);
        };
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(false);
        };
    });
}

function handleShowStandings(standingsData){
  const st = standingsData || computeStandings(); // Usa los datos pasados o los calcula si no existen
  const container = document.getElementById('standings');
  const methodLabel = classificationMethod === 'gameDifference'
    ? 'Criterio activo: Diferencia Juegos Ganados - Juegos Perdidos'
    : 'Criterio activo: Puntos + Sets + Juegos';
  const labelElement = document.getElementById('classificationMethodLabel');
  if (labelElement) {
    labelElement.textContent = methodLabel;
  }

  let html = '';
  for(const g of [1,2]){
    html += `<h3><i class="fas fa-list-ol"></i> Grupo ${g}</h3>`;
        if (classificationMethod === 'gameDifference') {
      html += `<table class="standings-table">
                <thead>
                    <tr>
                        <th>Pos</th><th>Pareja</th><th>Diferencia</th><th>Juegos Ganados</th><th>Juegos Perdidos</th>
                    </tr>
                </thead>
                <tbody>`;
    } else {
      html += `<table class="standings-table">
                <thead>
                    <tr>
                        <th>Pos</th><th>Pareja</th><th>Puntos</th><th>Sets Ganados</th><th>Juegos Ganados</th>
                    </tr>
                </thead>
                <tbody>`;
    }

    if (st[g] && st[g].length > 0) {
        st[g].forEach((r, index) => {
            const rowClass = index < 2 ? 'class="qualified-row"' : '';
                        if (classificationMethod === 'gameDifference') {
                            html += `<tr ${rowClass}><td>${index + 1}</td><td>${formatPairDisplay(r.pair)}${r.headToHeadResolved ? ' <i class="fas fa-handshake" title="Desempate por enfrentamiento directo"></i>' : ''}</td><td>${r.diferenciaJuegos}</td><td>${r.juegos}</td><td>${r.gamesAgainst}</td></tr>`;
                        } else {
                            html += `<tr ${rowClass}><td>${index + 1}</td><td>${formatPairDisplay(r.pair)}${r.headToHeadResolved ? ' <i class="fas fa-handshake" title="Desempate por enfrentamiento directo"></i>' : ''}</td><td>${r.puntos}</td><td>${r.sets}</td><td>${r.juegos}</td></tr>`;
                        }
        });
    } else {
        const colspan = classificationMethod === 'gameDifference' ? 5 : 5;
        html += `<tr><td colspan="${colspan}">No hay datos de clasificación para este grupo.</td></tr>`;
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
        const s_vals = Array(maxSets).fill(null).map((_, i) => ({
            a: sets[i] ? sets[i].a : '',
            b: sets[i] ? sets[i].b : ''
        }));
        const winnerIconA = match.winner === match.a.id ? ` <i class="fas ${iconClass} winner-icon"></i>` : '';
        const winnerIconB = match.winner === match.b.id ? ` <i class="fas ${iconClass} winner-icon"></i>` : '';

        const hasResult = sets.some(s => s && (s.a > 0 || s.b > 0));
        const buttonClass = hasResult ? 'btn-success' : 'btn-secondary';

        html = `
            <div class="result-form-item knockout-match ${match.winner ? 'match-completed' : ''}">
                ${title ? `<h4><i class="fas ${iconClass}"></i> ${title}</h4>` : ''}
                <table class="result-table">
                    <thead>
                        <tr>
                            <th>Enfrentamiento</th>
                            ${Array(maxSets).fill(null).map((_, i) => `<th>Set ${i+1}</th>`).join('')}
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${formatPairDisplay(match.a)}${winnerIconA}</td>
                            ${s_vals.map((s, i) => `<td><input type="number" min="0" id="${matchIdPrefix}-s${i+1}-a-${match.id}" value="${s.a}" class="set-input"></td>`).join('')}
                            <td rowspan="2"><button class="${buttonClass}" onclick="handleRecordKnockoutResult('${matchIdPrefix}', '${match.id}')"><i class="fas fa-check"></i> Registrar</button></td>
                        </tr>
                        <tr>
                            <td>${formatPairDisplay(match.b)}${winnerIconB}</td>
                            ${s_vals.map((s, i) => `<td><input type="number" min="0" id="${matchIdPrefix}-s${i+1}-b-${match.id}" value="${s.b}" class="set-input"></td>`).join('')}
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

    // El botón se activa si hay semifinales teóricas para guardar.
    // Una vez guardadas, se mantiene activo para poder actualizarlas.
    generateBtn.disabled = false;
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
    // La condición correcta: el botón se activa solo si las 2 semis tienen ganador y la final aún no está creada.
    const semisCompleted = semifinals.length === 2 && semifinals.every(s => s.winner);
    generateBtn.disabled = !semisCompleted || finalMatch;

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
    // Deshabilitar solo si el partido ya tiene un ganador.
    if (fifthPlaceMatch && fifthPlaceMatch.winner) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-check"></i> Partido Finalizado';
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
    // Deshabilitar solo si el partido ya tiene un ganador.
    if (seventhPlaceMatch && seventhPlaceMatch.winner) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-check"></i> Partido Finalizado';
    } else {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-cogs"></i> Generar partido';
    }
    document.getElementById('seventhPlace').innerHTML = renderKnockoutMatch(null, seventhPlaceMatch, null, 'fa-list-ol', 'seventh');
}

function handleRecordKnockoutResult(matchType, id) {
    const sets = [];
    for (let i = 1; i <= maxSets; i++) {
        const s_a_el = document.getElementById(`${matchType}-s${i}-a-${id}`);
        const s_b_el = document.getElementById(`${matchType}-s${i}-b-${id}`);
        if (s_a_el && s_b_el) {
            const s_a = s_a_el.value;
            const s_b = s_b_el.value;
            if (s_a !== '' && s_b !== '') {
                sets.push({ a: parseInt(s_a), b: parseInt(s_b) });
            } else {
                sets.push({ a: 0, b: 0 }); // CORRECCIÓN: Enviar objeto vacío en lugar de null
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

function renderGallery(imageUrls = []) {
    const slideContainer = document.querySelector('.carousel-slide');
    if (!slideContainer) return;

    if (imageUrls && imageUrls.length > 0) {
        slideContainer.innerHTML = imageUrls.map(url => `
            <div class="carousel-item">
                <img src="${url}" alt="Foto del torneo">
                <button class="btn-delete-img" title="Eliminar imagen"><i class="fas fa-trash-alt"></i></button>
            </div>
        `).join('');

        // Añadir eventos a los nuevos botones de eliminar
        slideContainer.querySelectorAll('.btn-delete-img').forEach((button, index) => {
            button.onclick = async () => {
                const imageUrlToDelete = imageUrls[index];
                const confirmed = await showConfirm({
                    title: 'Eliminar Imagen',
                    message: '¿Estás seguro de que quieres eliminar esta imagen de la galería?',
                    isDanger: true
                });
                if (confirmed) {
                    deleteImage(imageUrlToDelete); // Lógica en app.js
                }
            };
        });

        showSlide(imageUrls.length - 1); // Mostrar la última imagen subida
    } else {
        slideContainer.innerHTML = '<p>Aún no hay imágenes en la galería. ¡Sube la primera!</p>';
    }
}

function moveSlide(n) {
    showSlide(slideIndex += n);
}

function showSlide(n) {
    const slides = document.querySelectorAll('.carousel-slide .carousel-item');
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
    // CAMBIO: Renombrar la primera pestaña a "Gestión de jugadores"
    const firstTab = document.querySelector('.tab-button');
    if (firstTab) firstTab.innerHTML = '<i class="fas fa-users"></i> Gestión de jugadores';

    // Asignar eventos a elementos estáticos
    document.getElementById('limitInput').addEventListener('change', handleUpdateLimit);
    document.getElementById('addPairBtn').addEventListener('click', handleAddPair);
    document.getElementById('addSemiPairBtn').addEventListener('click', handleAddSemiPair);
    document.getElementById('addOpenPlayerBtn').addEventListener('click', handleAddOpenPlayer);

    // --- Eventos para la galería ---
    const uploadImagesBtn = document.getElementById('uploadImagesBtn');
    const imageUploadInput = document.getElementById('imageUpload');
    if (uploadImagesBtn) {
        uploadImagesBtn.addEventListener('click', () => {
            const files = imageUploadInput.files;
            if (!files.length) {
                showNotification('Por favor, selecciona al menos una imagen.', 'error');
                return;
            }
            // La función uploadImages y la variable currentTournamentId están en app.js
            uploadImages(files, currentTournamentId);
        });
    }

    // --- NUEVO: Eventos para el modal de edición ---
    // Cerrar cualquier modal al hacer clic en su respectiva X o fuera de él
    document.querySelectorAll('.modal').forEach(m => {
        const closeBtn = m.querySelector('.close-button');
        if (closeBtn) closeBtn.onclick = () => m.style.display = 'none';
        
        window.addEventListener('click', (event) => {
            if (event.target == m) m.style.display = 'none';
        });
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

    const exportBtn = document.getElementById('exportPairBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportPairHistoryToPDF);

    const exportStandingsBtn = document.getElementById('exportStandingsBtn');
    if (exportStandingsBtn) exportStandingsBtn.addEventListener('click', exportStandingsToPDF);
});