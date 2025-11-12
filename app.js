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
let groupLimit = 4;
let nextColorIndex = 0; // Nuevo: Índice para la paleta de colores

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
    groupLimit,
    nextColorIndex,
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
      groupLimit = saved.groupLimit || 4;
      tournamentName = saved.name || "Torneo sin nombre"; // Cargar el nombre del torneo
      nextColorIndex = saved.nextColorIndex || 0; 

      console.log("Datos cargados/actualizados desde Firestore.");

      // Una vez cargados los datos, actualizamos toda la interfaz.
      if (document.getElementById('limitInput')) {
        document.getElementById('limitInput').value = groupLimit;
      }
      // Llama a todas las funciones de renderizado para refrescar la vista
      renderCurrentPairs();
      updateGenerateMatchesButtonState(); // Actualiza el estado del botón de generar partidos
      updateTournamentHeader(tournamentName); // Actualizar el título del torneo      
      // La lógica de renderizado de cada pestaña se gestiona ahora en openTab()
      // para evitar regeneraciones automáticas no deseadas al cargar.

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
// === FUNCIONES DE LÓGICA (CRUD de Parejas) =============
// =======================================================

// Límite
function updateGroupLimit(limit) {
  groupLimit = limit;
  saveTournamentData();
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

    saveTournamentData();
    updateGenerateMatchesButtonState(); // Actualiza el estado del botón al borrar una pareja
  }
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
    // CORRECCIÓN FINAL: Guardar como un array de objetos, no de arrays.
    // Esto es compatible con Firestore.
    const setsToSave = [set1, set2, set3, set4, set5].filter(set => set !== null);
    match.sets = setsToSave; // La función handleRecordResult ya los crea como objetos
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
      if (set.a > set.b) setsA++;
      else setsB++;
    }
  }
  if (setsA > setsB) winner = match.a.id;
  if (setsB > setsA) winner = match.b.id;

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

  if (!g1 || g1.length < 2 || !g2 || g2.length < 2) {
    semifinals = []; // Limpia las semifinales si no se pueden generar
    saveTournamentData();
    return;
  }

  // Guardar los datos de las semis si ya existen (para conservar resultados)
  const existingSemis = semifinals.map((s) => ({
    a: s.a.id,
    b: s.b.id,
    winner: s.winner,
    sets: s.sets,
    id: s.id,
  }));

  // Cruce: 1º Grupo 1 vs 2º Grupo 2; 1º Grupo 2 vs 2º Grupo 1
  const newSemisData = [
    { a: g1[0].pair, b: g2[1].pair },
    { a: g2[0].pair, b: g1[1].pair },
  ];

  semifinals = newSemisData.map((newS) => {
    const existing = existingSemis.find(
      (e) =>
        (e.a === newS.a.id && e.b === newS.b.id) ||
        (e.a === newS.b.id && e.b === newS.a.id)
    );
    if (existing) {
      return {
        ...newS,
        id: existing.id,
        sets: existing.sets,
        winner: existing.winner,
      };
    } else {
      return {
        id: Date.now() + Math.random(),
        ...newS,
        sets: [],
        winner: null,
      };
    }
  });

  saveTournamentData();
}

// Función auxiliar para calcular el ganador en eliminatorias (Semis/Finales)
function calculateKnockoutWinner(match) {
  let winsA = 0,
    winsB = 0;
  for (const set of match.sets) { // Ahora 'set' es un objeto {a, b}
    if (set && typeof set.a === 'number' && typeof set.b === 'number') {
      if (set.a > set.b) winsA++;
      else if (set.b > set.a) winsB++;
    }
  }
  if (winsA > winsB) return match.a.id;
  if (winsB > winsA) return match.b.id;
  return null; // Aún no hay ganador
}

// Registrar semifinal
function recordSemiResult(semiId, set1, set2, set3, set4, set5) {
  const s = semifinals.find((x) => x.id === semiId);
  if (s) {
    s.sets = [set1, set2, set3, set4, set5].filter(set => set !== null);
    s.winner = calculateKnockoutWinner(s);
    saveTournamentData();
  }
}

// Generar final y partido 3º-4º
function generateFinals() {
  if (semifinals.length < 2 || semifinals.some((s) => !s.winner)) {
    finalMatch = null;
    thirdPlace = null;
    return;
  }

  const winners = semifinals.map((s) => (s.winner === s.a.id ? s.a : s.b));
  const losers = semifinals.map((s) => (s.winner === s.a.id ? s.b : s.a));

  // Final - Conservar resultados si ya estaban
  finalMatch = {
    a: winners[0],
    b: winners[1],
    sets: finalMatch ? finalMatch.sets : [],
    winner: finalMatch ? finalMatch.winner : null,
  };
  // 3er Puesto - Conservar resultados si ya estaban
  thirdPlace = {
    a: losers[0],
    b: losers[1],
    sets: thirdPlace ? thirdPlace.sets : [],
    winner: thirdPlace ? thirdPlace.winner : null,
  };

  saveTournamentData();
}

// Registrar resultado final
function recordFinalResult(set1, set2, set3, set4, set5) {
  if (!finalMatch) return;
  finalMatch.sets = [set1, set2, set3, set4, set5].filter(set => set !== null);
  finalMatch.winner = calculateKnockoutWinner(finalMatch);
  saveTournamentData();
}

// Registrar resultado 3er puesto
function recordThirdPlaceResult(set1, set2, set3, set4, set5) {
  if (!thirdPlace) return;
  thirdPlace.sets = [set1, set2, set3, set4, set5].filter(set => set !== null);
  thirdPlace.winner = calculateKnockoutWinner(thirdPlace);
  saveTournamentData();
}

// =======================================================
// === INICIALIZACIÓN DE LA APP ==========================
// =======================================================

// Cargar los datos al inicio y escuchar cambios en tiempo real
loadTournamentData();
