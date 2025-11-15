// Torneo de Padel - Lógica completa

// =======================================================
// === CONFIGURACIÓN DINÁMICA DE FIREBASE ================
// =======================================================
const db = firebase.firestore();

// Función para obtener el ID del torneo desde la URL (ej: torneo.html?id=XXXX)
function getTournamentIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

const tournamentId = getTournamentIdFromURL();
let tournamentDocRef; // La referencia ahora es variable
let tournamentName = "Cargando..."; // Variable para el nombre del torneo

let groups = { 1: [], 2: [] };
let matches = [];
let semifinals = [];
let finalMatch = null;
let thirdPlace = null;
let fifthPlaceMatch = null; // Nuevo: Partido 5º-6º puesto
let seventhPlaceMatch = null; // Nuevo: Partido 7º-8º puesto
let groupLimit = 4;
let nextColorIndex = 0; // Nuevo: Índice para la paleta de colores
let tournamentMode = 'directed'; // Nuevo: 'directed', 'semi-directed', 'open'
let drawPool = []; // Nuevo: "Bolsa" para sorteos

// Paleta de colores pastel única para cada pareja (se pueden añadir más)
const COLOR_PALETTE = [
  "#FFCDD2", // Rojo Claro
  "#C8E6C9", // Verde Claro
  "#BBDEFB", // Azul Claro
  "#FFF9C4", // Amarillo Claro
  "#E1BEE7", // Morado Claro
  "#FFECB3", // Naranja Claro
  "#B2EBF2", // Cyan Claro
  "#D7CCC8", // Marrón Claro
  "#F0F4C3", // Lima Claro
  "#CFD8DC", // Azul Grisáceo Claro
];

function getNextColor() {
  // Usamos el índice actual y lo incrementamos. Modulo para evitar desbordamiento si se superan los colores definidos.
  const color = COLOR_PALETTE[nextColorIndex % COLOR_PALETTE.length];
  nextColorIndex++;
  return color;
}

// =======================================================
// === FUNCIONES DE PERSISTENCIA (Firestore) ============
// =======================================================

// Guarda todos los datos del torneo en Firestore
async function saveTournamentData() {
  const dataToSave = {
    name: tournamentName, // ¡LA LÍNEA CLAVE QUE FALTABA!
    groups,
    matches,
    semifinals,
    finalMatch,
    thirdPlace,
    fifthPlaceMatch,
    seventhPlaceMatch,
    groupLimit,
    nextColorIndex,
    tournamentMode,
    drawPool,
  };
  try {
    // Usamos .update() en lugar de .set() para no borrar campos que no gestionamos aquí (como createdAt)
    // Pero como la estructura es completa, .set con la opción { merge: true } es más seguro
    // para asegurar que todos los campos se sincronicen.
    await tournamentDocRef.set(dataToSave, { merge: true });
    console.log("Datos del torneo guardados en Firestore.");
  } catch (e) {
    console.error("Error al guardar en Firestore: ", e);
  }
}

// Carga los datos y escucha cambios en tiempo real desde Firestore
function loadTournamentData() {
  if (!tournamentId) {
    alert("Error: No se ha especificado un ID de torneo. Volviendo a la página de selección.");
    window.location.href = 'index.html';
    return;
  }
  tournamentDocRef = db.collection("tournaments").doc(tournamentId);
  tournamentDocRef.onSnapshot((docSnap) => {
    if (docSnap.exists) {
      const saved = docSnap.data();
      groups = saved.groups || { 1: [], 2: [] };
      matches = saved.matches || [];
      semifinals = saved.semifinals || [];
      finalMatch = saved.finalMatch || null;
      thirdPlace = saved.thirdPlace || null;
      fifthPlaceMatch = saved.fifthPlaceMatch || null;
      seventhPlaceMatch = saved.seventhPlaceMatch || null;
      groupLimit = saved.groupLimit || 4;
      tournamentName = saved.name || "Torneo sin nombre"; // Cargar el nombre del torneo
      nextColorIndex = saved.nextColorIndex || 0; 
      tournamentMode = saved.tournamentMode || 'directed';
      drawPool = saved.drawPool || [];

      console.log("Datos cargados/actualizados desde Firestore.");

      // Una vez cargados los datos, actualizamos toda la interfaz.
      if (document.getElementById('limitInput')) {
        document.getElementById('limitInput').value = groupLimit;
      }
      
      // === RENDERIZADO GLOBAL ===
      // Cada vez que los datos cambian en Firestore, se vuelve a dibujar toda la interfaz.
      // Las funciones de renderizado están ahora en ui.js
      if (typeof renderCurrentPairs === 'function') {
        const standings = computeStandings(); // Calculamos la clasificación una vez

        updateTournamentHeader(tournamentName);
        renderCurrentPairs();
        renderMatchesList();
        renderResultForms();
        handleShowStandings(standings); // Pasamos la clasificación ya calculada
        // Si ya hay semifinales guardadas, las renderiza. Si no, calcula y muestra las teóricas.
        const semisToRender = semifinals.length > 0 ? semifinals : calculateCurrentSemifinals(standings);
        renderSemifinals(semisToRender);
        renderFinals();
        renderFifthPlaceMatch();
        renderSeventhPlaceMatch();
      }
    } else {
      // Esto puede pasar si el ID es incorrecto o el documento fue borrado.
      console.error("El documento del torneo no existe. Redirigiendo...");
      alert("Error: El torneo con este ID no fue encontrado.");
      window.location.href = 'index.html';
    }
  }, (error) => {
    console.error("Error al escuchar cambios de Firestore: ", error);
  });
}

// =======================================================
// === FUNCIONES DE GESTIÓN DEL TORNEO ===================
// =======================================================

// Reiniciar todo el torneo (ahora borra de Firestore)
async function resetTournament() {
  if (confirm("¿Seguro que quieres borrar ESTE TORNEO PERMANENTEMENTE? Esta acción no se puede deshacer.")) {
    // Borra el documento de Firestore para empezar de cero.
    await tournamentDocRef.delete();
    // La redirección se manejará automáticamente por el listener onSnapshot
  }
}

// Limpiar solo los resultados de la fase de grupos
function clearGroupResults() {
  matches.forEach((m) => (m.sets = []));
  saveTournamentData();
}

// =======================================================
// === FUNCIONES DE LÓGICA (CRUD de Parejas) =============
// =======================================================

function updateGroupLimit(limit) {
  groupLimit = limit;
  saveTournamentData();
}
// Añadir pareja
function addPair(group, player1, player2) {
  const newPair = {
    id: Date.now() + Math.random(),
    players: [player1, player2],
    color: getNextColor(), // Asignar color único
  };
  groups[group].push(newPair);
  saveTournamentData();
}

// Eliminar pareja
function deletePair(pairId) {
  let pairGroup = null;
  let deleted = false;
  for (const g in groups) {
    const initialLength = groups[g].length;
    groups[g] = groups[g].filter((p) => p.id !== pairId);
    if (groups[g].length < initialLength) {
      pairGroup = g;
      deleted = true;
      break;
    }
  }

  if (deleted) {
    // Si se elimina una pareja, se deben eliminar sus partidos y resultados
    matches = matches.filter((m) => m.a.id !== pairId && m.b.id !== pairId);

    // También limpiamos las eliminatorias, ya que el cruce será incorrecto
    semifinals = [];
    finalMatch = null;
    thirdPlace = null;
    fifthPlaceMatch = null;
    seventhPlaceMatch = null;

    saveTournamentData();
  }
}

// --- NUEVAS FUNCIONES PARA MODOS DE TORNEO ---

function setTournamentMode(mode) {
    tournamentMode = mode;
    // Al cambiar de modo, se reinicia TODO el estado del torneo para evitar inconsistencias.
    drawPool = [];
    groups = { 1: [], 2: [] };
    matches = [];
    semifinals = [];
    finalMatch = null;
    thirdPlace = null;
    fifthPlaceMatch = null;
    seventhPlaceMatch = null;
    nextColorIndex = 0; // Reiniciar el contador de colores
    saveTournamentData();
}

function addPairToPool(player1, player2) {
    drawPool.push({ type: 'pair', players: [player1, player2] });
    saveTournamentData();
}

function addPlayerToPool(player) {
    drawPool.push({ type: 'player', name: player });
    saveTournamentData();
}

function performDraw() {
    if (drawPool.length === 0) {
        alert("La bolsa de sorteo está vacía. Añade parejas o jugadores primero.");
        return;
    }

    let pairsToDistribute = [];

    if (tournamentMode === 'semi-directed') {
        // Las parejas ya están hechas, solo hay que barajarlas
        pairsToDistribute = drawPool.map(p => ({
            id: Date.now() + Math.random(),
            players: p.players,
            color: getNextColor(),
        }));
    } else if (tournamentMode === 'open') {
        // Hay que crear las parejas primero
        if (drawPool.length % 2 !== 0) {
            alert(`Hay un número impar de jugadores (${drawPool.length}). El último jugador de la lista no será emparejado.`)
        }
        // Barajamos los jugadores
        let shuffledPlayers = [...drawPool].sort(() => 0.5 - Math.random());
        for (let i = 0; i < Math.floor(shuffledPlayers.length / 2); i++) {
            pairsToDistribute.push({
                id: Date.now() + Math.random(),
                players: [shuffledPlayers[i*2].name, shuffledPlayers[i*2 + 1].name],
                color: getNextColor(),
            });
        }
    }

    // Ahora distribuimos las parejas en los grupos
    // Barajamos las parejas a distribuir
    let shuffledPairs = pairsToDistribute.sort(() => 0.5 - Math.random());

    // Limpiamos los grupos actuales
    groups = { 1: [], 2: [] };
    let currentGroup = 1;

    shuffledPairs.forEach(pair => {
        if (groups[currentGroup].length < groupLimit) {
            groups[currentGroup].push(pair);
        } else {
            // Si el grupo actual está lleno, pasamos al siguiente
            currentGroup = (currentGroup === 1) ? 2 : 1;
            if (groups[currentGroup].length < groupLimit) {
                groups[currentGroup].push(pair);
            } // Si ambos están llenos, la pareja se descarta (se podría avisar)
        }
    });

    drawPool = []; // Limpiamos la bolsa después del sorteo
    saveTournamentData();
}

// Editar pareja
function editPair(pairId, newP1, newP2) {
  for (const g in groups) {
    const pairIndex = groups[g].findIndex((p) => p.id === pairId);
    if (pairIndex !== -1) {
      groups[g][pairIndex].players = [newP1, newP2];

      // Actualizar la pareja en los partidos existentes
      matches.forEach((m) => {
        if (m.a.id === pairId) m.a.players = [newP1, newP2];
        if (m.b.id === pairId) m.b.players = [newP1, newP2];
      });

      saveTournamentData();
      return;
    }
  }
}

// Generar enfrentamientos todos contra todos
function generateGroupMatches() {
  // Conservar los resultados de los partidos existentes si las parejas no han cambiado
  const oldMatches = matches.map((m) => ({
    id: m.id,
    group: m.group,
    a: m.a,
    b: m.b,
    sets: m.sets,
  }));

  const newMatches = []; // Usamos una nueva variable temporal en lugar de borrar la principal
  for (const g of [1, 2]) {
    const pairs = groups[g];
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const pair1Id = pairs[i].id;
        const pair2Id = pairs[j].id;

        // Buscar el partido anterior para conservar sets
        const existing = oldMatches.find(
          (m) =>
            m.group == g && // Usar == para comparación flexible de número y string si es necesario
            ((m.a.id === pair1Id && m.b.id === pair2Id) ||
              (m.a.id === pair2Id && m.b.id === pair1Id))
        );

        if (existing) {
          // Si el partido existe, usamos SUS datos para mantener la coherencia de objetos.
          newMatches.push(existing);
        } else {
          // Si es un partido nuevo, lo creamos.
          newMatches.push({
            id: Date.now() + Math.random(),
            group: g,
            a: pairs[i],
            b: pairs[j],
            sets: [],
          });
        }
      }
    }
  }
  matches = newMatches; // Reemplazamos la lista de partidos principal con la nueva, ya completa.
  saveTournamentData();
}

// Registrar resultado de fase de grupos
function recordResult(matchId, set1, set2, set3, set4, set5) {
  const match = matches.find((m) => m.id === matchId);
  if (match) {
    // Guardamos siempre los 5 sets. La UI ahora envía {a:0, b:0} para los no jugados.
    match.sets = [set1, set2, set3, set4, set5];
    saveTournamentData();
  }
}

// Función auxiliar para obtener sets/juegos de un partido
function getMatchResult(match) {
  let setsA = 0,
    setsB = 0,
    gamesA = 0,
    gamesB = 0;
  let winner = null;
  for (const set of match.sets) {
    if (set && typeof set.a === 'number' && typeof set.b === 'number') {
      gamesA += set.a;
      gamesB += set.b;
      if (set.a > set.b) setsA++; // Gana A
      else if (set.b > set.a) setsB++; // Gana B (corregido para no contar empates 0-0)
    }
  }

  // CORRECCIÓN CLAVE: Determinar el ganador basado en quién ganó más sets,
  // siempre que se haya jugado al menos un set.
  if (setsA > setsB) {
    winner = match.a.id;
  } else if (setsB > setsA) {
    winner = match.b.id;
  }

  // Si hay un resultado, devolverlo
  if (winner) return { winner, setsA, setsB, gamesA, gamesB };
  return null;
}

// Calcular clasificación (NO necesita guardar, solo lee)
function computeStandings() {
  const standings = { 1: [], 2: [] };
  for (const g of [1, 2]) {
    if (!groups[g]) continue;
    const base = groups[g].map((p) => ({
      pair: p,
      puntos: 0,
      sets: 0,
      juegos: 0,
    }));

    for (const match of matches.filter(
      (m) => m.group == g && m.sets.length > 0
    )) {
      const result = getMatchResult(match);
      if (!result) continue;

      const idxA = base.findIndex((x) => x.pair.id === match.a.id);
      const idxB = base.findIndex((x) => x.pair.id === match.b.id);

      if (idxA === -1 || idxB === -1) continue;

      // Puntos y sets
      if (result.winner === match.a.id) {
        base[idxA].puntos += 1;
      } else {
        base[idxB].puntos += 1;
      }
      base[idxA].sets += result.setsA;
      base[idxB].sets += result.setsB;

      // Juegos
      base[idxA].juegos += result.gamesA;
      base[idxB].juegos += result.gamesB;
    }

    // Ordenar (Puntos > Sets a favor > Juegos a favor)
    standings[g] = base.sort(
      (a, b) => b.puntos - a.puntos || b.sets - a.sets || b.juegos - a.juegos
    );
  }
  return standings;
}

// Crear semifinales
function generateSemifinals() {
  const st = computeStandings();
  const g1 = st[1];
  const g2 = st[2];

  // Comprobación principal: ¿Hay suficientes equipos en la clasificación para los cruces?
  if (!g1 || g1.length < 2 || !g2 || g2.length < 2) { 
    alert("No hay suficientes equipos clasificados (se necesitan los 2 primeros de cada grupo) para generar las semifinales.");
    return;
  }

  // Cruce: 1º Grupo 1 vs 2º Grupo 2; 1º Grupo 2 vs 2º Grupo 1
  // Se regeneran siempre para reflejar el estado actual de la clasificación.
  semifinals = [
    { 
      id: Date.now() + Math.random(),
      a: g1[0].pair, b: g2[1].pair, 
      sets: [], winner: null 
    },
    { 
      id: Date.now() + Math.random() + 1,
      a: g2[0].pair, b: g1[1].pair, 
      sets: [], winner: null 
    },
  ];

  saveTournamentData();
}

// --- NUEVA FUNCIÓN ---
// Calcula los enfrentamientos de semifinales basándose en la clasificación actual,
// pero NO los guarda. Devuelve los enfrentamientos para poder pintarlos dinámicamente.
function calculateCurrentSemifinals(standings) {
  const st = standings || computeStandings();
  const g1 = st[1];
  const g2 = st[2];

  // Si no hay suficientes equipos, devuelve un array vacío.
  if (!g1 || g1.length < 2 || !g2 || g2.length < 2) {
    return [];
  }

  // Devuelve los cruces teóricos
  return [
    { id: 'temp-semi-1', a: g1[0].pair, b: g2[1].pair, sets: [], winner: null },
    { id: 'temp-semi-2', a: g2[0].pair, b: g1[1].pair, sets: [], winner: null },
  ];
}

// Función auxiliar para calcular el ganador en eliminatorias (Semis/Finales)
function calculateKnockoutWinner(match) {
  let winsA = 0,
    // No es necesario comprobar si match existe, las funciones que llaman a esta ya lo hacen.
    winsB = 0;
  for (const set of match.sets) { // Ahora 'set' es un objeto {a, b}
    if (set && typeof set.a === 'number' && typeof set.b === 'number') {
      // Solo se cuenta como set ganado si no hay empate.
      // Esto evita que los sets vacíos {a:0, b:0} se cuenten.
      if (set.a > set.b) winsA++; 
      if (set.b > set.a) winsB++;
    }
  }
  if (winsA > winsB) return match.a.id;
  if (winsB > winsA) return match.b.id;
  return null; // Aún no hay ganador
}

// Registrar semifinal
function recordSemiResult(semiId, set1, set2, set3, set4, set5) {
  // Convertimos el semiId (que viene como string desde la UI) a número para la comparación estricta.
  const s = semifinals.find((x) => x.id === parseFloat(semiId));
  if (s) {
    s.sets = [set1, set2, set3, set4, set5];
    s.winner = calculateKnockoutWinner(s);
    saveTournamentData();
  }
}

// Generar final y partido 3º-4º
function generateFinals() {
  // Comprobación principal: ¿Se han jugado ambas semifinales?
  if (semifinals.length < 2 || semifinals.some((s) => !s.winner)) {
    alert("Ambas semifinales deben tener un resultado registrado para poder generar la final y el 3er puesto.");
    return;
  }

  const winners = semifinals.map((s) => (s.winner === s.a.id ? s.a : s.b));
  const losers = semifinals.map((s) => (s.winner === s.a.id ? s.b : s.a));

  // Crear la final
  finalMatch = {
    id: 'final', a: winners[0], b: winners[1],
    sets: [], winner: null,
  };
  // Crear el 3er Puesto
  thirdPlace = {
    id: 'third', a: losers[0], b: losers[1],
    sets: [], winner: null,
  };

  saveTournamentData();
}

// Registrar resultado final
function recordFinalResult(set1, set2, set3, set4, set5) {
  if (!finalMatch) return;
  finalMatch.sets = [set1, set2, set3, set4, set5];
  finalMatch.winner = calculateKnockoutWinner(finalMatch);
  saveTournamentData();
}

// Registrar resultado 3er puesto
function recordThirdPlaceResult(set1, set2, set3, set4, set5) {
  if (!thirdPlace) return;
  thirdPlace.sets = [set1, set2, set3, set4, set5];
  thirdPlace.winner = calculateKnockoutWinner(thirdPlace);
  saveTournamentData();
}

// =======================================================
// === PARTIDOS DE CONSOLACIÓN (5º-8º PUESTO) ===========
// =======================================================

// Enfrenta a los 3º de cada grupo
function generateFifthPlaceMatch() {
    const standings = computeStandings();
    // Asegúrate de que hay al menos 3 equipos en cada grupo
    if (standings[1] && standings[1].length > 2 && standings[2] && standings[2].length > 2) {
        const thirdG1 = standings[1][2].pair;
        const thirdG2 = standings[2][2].pair;
        fifthPlaceMatch = { id: 'fifth', a: thirdG1, b: thirdG2, sets: [], winner: null };
        saveTournamentData();
    } else {
        alert('No hay suficientes equipos (3º de grupo) para generar este partido.');
    }
}

// Registra el resultado del partido por el 5º puesto
function recordFifthPlaceResult(s1, s2, s3, s4, s5) {
    if (!fifthPlaceMatch) return;
    fifthPlaceMatch.sets = [s1, s2, s3, s4, s5];
    fifthPlaceMatch.winner = calculateKnockoutWinner(fifthPlaceMatch);
    saveTournamentData();
}

// Enfrenta a los 4º de cada grupo
function generateSeventhPlaceMatch() {
    const standings = computeStandings();
    // Asegúrate de que hay al menos 4 equipos en cada grupo
    if (standings[1] && standings[1].length > 3 && standings[2] && standings[2].length > 3) {
        const fourthG1 = standings[1][3].pair;
        const fourthG2 = standings[2][3].pair;
        seventhPlaceMatch = { id: 'seventh', a: fourthG1, b: fourthG2, sets: [], winner: null };
        saveTournamentData();
    } else {
        alert('No hay suficientes equipos (4º de grupo) para generar este partido.');
    }
}

// Registra el resultado del partido por el 7º puesto
function recordSeventhPlaceResult(s1, s2, s3, s4, s5) {
    if (!seventhPlaceMatch) return;
    seventhPlaceMatch.sets = [s1, s2, s3, s4, s5];
    seventhPlaceMatch.winner = calculateKnockoutWinner(seventhPlaceMatch);
    saveTournamentData();
}

// =======================================================
// === INICIALIZACIÓN DE LA APP ==========================
// =======================================================

// Cargar los datos al inicio y escuchar cambios en tiempo real
document.addEventListener('DOMContentLoaded', loadTournamentData);
