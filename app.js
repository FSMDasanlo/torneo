// Torneo de Padel - Lógica completa

// Grupos y parejas
let groups = { 1: [], 2: [] };
let matches = [];
let semifinals = [];
let finalMatch = null;
let thirdPlace = null;
let groupLimit = 4;
let nextColorIndex = 0; // Nuevo: Índice para la paleta de colores

// Paleta de colores pastel única para cada pareja (se pueden añadir más)
const COLOR_PALETTE = [
    '#FFCDD2', // Rojo Claro
    '#C8E6C9', // Verde Claro
    '#BBDEFB', // Azul Claro
    '#FFF9C4', // Amarillo Claro
    '#E1BEE7', // Morado Claro
    '#FFECB3', // Naranja Claro
    '#B2EBF2', // Cyan Claro
    '#D7CCC8', // Marrón Claro
    '#F0F4C3', // Lima Claro
    '#CFD8DC'  // Azul Grisáceo Claro
];

function getNextColor() {
    // Usamos el índice actual y lo incrementamos. Modulo para evitar desbordamiento si se superan los colores definidos.
    const color = COLOR_PALETTE[nextColorIndex % COLOR_PALETTE.length];
    nextColorIndex++;
    return color;
}

// =======================================================
// === FUNCIONES DE PERSISTENCIA (localStorage) ==========
// =======================================================

// Guardar todos los datos del torneo en el almacenamiento local
function saveToLocalStorage(){
  // Incluimos nextColorIndex en el guardado
  const data = JSON.stringify({ groups, matches, semifinals, finalMatch, thirdPlace, groupLimit, nextColorIndex }); 
  localStorage.setItem('padelTournamentData', data);
}

// Cargar los datos del torneo desde el almacenamiento local
function loadFromLocalStorage(){
  const data = localStorage.getItem('padelTournamentData');
  if(data){
    const saved = JSON.parse(data);
    groups = saved.groups || { 1: [], 2: [] };
    matches = saved.matches || [];
    semifinals = saved.semifinals || [];
    finalMatch = saved.finalMatch || null;
    thirdPlace = saved.thirdPlace || null;
    groupLimit = saved.groupLimit || 4;
    nextColorIndex = saved.nextColorIndex || 0; // Cargamos el índice
    
    // Lógica para asignar colores a parejas antiguas (si la propiedad no existía)
    let assignedNewColors = false;
    for(const g in groups){
        groups[g] = groups[g].map(p => {
            if (!p.color) {
                // Asignamos un nuevo color usando el índice actual y actualizamos el índice.
                p.color = getNextColor(); 
                assignedNewColors = true;
            }
            return p;
        });
    }
    // Si se asignaron nuevos colores, guardar para persistir.
    if (assignedNewColors) {
        // NO usamos saveToLocalStorage aquí para evitar un bucle si hay error, solo guardamos.
        const updatedData = JSON.stringify({ groups, matches, semifinals, finalMatch, thirdPlace, groupLimit, nextColorIndex });
        localStorage.setItem('padelTournamentData', updatedData);
    }
  }
}

// =======================================================
// === FUNCIONES DE LÓGICA (CRUD de Parejas) =============
// =======================================================

// Límite
function updateGroupLimit(limit){
    groupLimit = limit;
    saveToLocalStorage();
}

// Añadir pareja
function addPair(group, player1, player2){
    const newPair = { 
        id: Date.now()+Math.random(), 
        players:[player1, player2],
        color: getNextColor() // Asignar color único
    };
    groups[group].push(newPair);
    saveToLocalStorage(); // GUARDADO
}

// Eliminar pareja
function deletePair(pairId){
    let pairGroup = null;
    let deleted = false;
    for(const g in groups){
        const initialLength = groups[g].length;
        groups[g] = groups[g].filter(p => p.id !== pairId);
        if (groups[g].length < initialLength) {
            pairGroup = g;
            deleted = true;
            break;
        }
    }
    
    if (deleted) {
        // Si se elimina una pareja, se deben eliminar sus partidos y resultados
        matches = matches.filter(m => m.a.id !== pairId && m.b.id !== pairId);
        
        // También limpiamos las eliminatorias, ya que el cruce será incorrecto
        semifinals = [];
        finalMatch = null;
        thirdPlace = null;
        
        saveToLocalStorage(); // GUARDADO
    }
}

// Editar pareja
function editPair(pairId, newP1, newP2){
    for(const g in groups){
        const pairIndex = groups[g].findIndex(p => p.id === pairId);
        if (pairIndex !== -1) {
            groups[g][pairIndex].players = [newP1, newP2];
            
            // Actualizar la pareja en los partidos existentes
            matches.forEach(m => {
                if (m.a.id === pairId) m.a.players = [newP1, newP2];
                if (m.b.id === pairId) m.b.players = [newP1, newP2];
            });
            
            saveToLocalStorage(); // GUARDADO
            return;
        }
    }
}

// Generar enfrentamientos todos contra todos
function generateGroupMatches(){
  // Conservar los resultados de los partidos existentes si las parejas no han cambiado
  const oldMatches = matches.map(m => ({ id: m.id, group: m.group, a: m.a.id, b: m.b.id, sets: m.sets }));

  matches = [];
  for(const g of [1,2]){
    const pairs = groups[g];
    for(let i=0;i<pairs.length;i++){
      for(let j=i+1;j<pairs.length;j++){
        const pair1Id = pairs[i].id;
        const pair2Id = pairs[j].id;
        
        // Buscar el partido anterior para conservar sets
        const existing = oldMatches.find(m => m.group === g && 
            ((m.a === pair1Id && m.b === pair2Id) || (m.a === pair2Id && m.b === pair1Id))
        );
        
        matches.push({ 
            id: existing ? existing.id : Date.now()+Math.random(), 
            group: g, 
            a: pairs[i], 
            b: pairs[j], 
            sets: existing ? existing.sets : [] 
        });
      }
    }
  }
  saveToLocalStorage(); // GUARDADO
}

// Registrar resultado de fase de grupos
function recordResult(matchId, set1, set2, set3){
  const match = matches.find(m=>m.id===matchId);
  match.sets = [set1, set2, set3].filter(Boolean);
  saveToLocalStorage(); // GUARDADO
}

// Función auxiliar para obtener sets/juegos de un partido
function getMatchResult(match){
    let setsA=0, setsB=0, gamesA=0, gamesB=0;
    let winner = null;
    for(const set of match.sets){
        gamesA += set[0];
        gamesB += set[1];
        if(set[0]>set[1]) setsA++; else setsB++;
    }
    if (setsA > setsB) winner = match.a.id;
    if (setsB > setsA) winner = match.b.id;
    
    // Si hay un resultado, devolverlo
    if(winner) return { winner, setsA, setsB, gamesA, gamesB };
    return null;
}

// Calcular clasificación (NO necesita guardar, solo lee)
function computeStandings(){
  const standings = { 1:[], 2:[] };
  for(const g of [1,2]){
    const base = groups[g].map(p=>({ pair:p, puntos:0, sets:0, juegos:0 }));
    
    for(const match of matches.filter(m=>m.group===g && m.sets.length>0)){
        const result = getMatchResult(match);
        if(!result) continue;

        const idxA = base.findIndex(x=>x.pair.id===match.a.id);
        const idxB = base.findIndex(x=>x.pair.id===match.b.id);
        
        // Puntos y sets
        if(result.winner === match.a.id){
            base[idxA].puntos += 3; 
        } else {
            base[idxB].puntos += 3;
        }
        base[idxA].sets += result.setsA;
        base[idxB].sets += result.setsB;
        
        // Juegos
        base[idxA].juegos += result.gamesA;
        base[idxB].juegos += result.gamesB;
    }
    
    // Ordenar (Puntos > Sets a favor > Juegos a favor)
    standings[g] = base.sort(
      (a, b) => b.puntos - a.puntos ||
      b.sets - a.sets ||
      b.juegos - a.juegos
    );
  }
  return standings;
}

// Crear semifinales
function generateSemifinals(){
  const st = computeStandings();
  const g1 = st[1];
  const g2 = st[2];

  if(g1.length<2 || g2.length<2) return;
  
  // Guardar los datos de las semis si ya existen (para conservar resultados)
  const existingSemis = semifinals.map(s => ({ a: s.a.id, b: s.b.id, winner: s.winner, sets: s.sets, id: s.id }));

  // Cruce: 1º Grupo 1 vs 2º Grupo 2; 1º Grupo 2 vs 2º Grupo 1
  const newSemisData = [
    { a:g1[0].pair, b:g2[1].pair },
    { a:g2[0].pair, b:g1[1].pair }
  ];

  semifinals = newSemisData.map(newS => {
    const existing = existingSemis.find(e => 
        (e.a === newS.a.id && e.b === newS.b.id) || 
        (e.a === newS.b.id && e.b === newS.a.id)
    );
    if(existing) {
        return { ...newS, id: existing.id, sets: existing.sets, winner: existing.winner };
    } else {
        return { id:Date.now()+Math.random(), ...newS, sets:[], winner:null };
    }
  });

  saveToLocalStorage(); // GUARDADO
}

// Función auxiliar para calcular el ganador en eliminatorias (Semis/Finales)
function calculateKnockoutWinner(match){
    let winsA = 0, winsB = 0;
    for(const set of match.sets){
        if(set[0] > set[1]) winsA++;
        else if (set[1] > set[0]) winsB++;
    }
    if (winsA > winsB) return match.a.id;
    if (winsB > winsA) return match.b.id;
    return null; // Aún no hay ganador
}

// Registrar semifinal
function recordSemiResult(semiId, set1, set2, set3){
  const s = semifinals.find(x=>x.id===semiId);
  s.sets = [set1,set2,set3].filter(Boolean);
  s.winner = calculateKnockoutWinner(s);
  saveToLocalStorage(); // GUARDADO
}

// Generar final y partido 3º-4º
function generateFinals(){
  if(semifinals.length<2 || semifinals.some(s=>!s.winner)) return;

  const winners = semifinals.map(s => s.winner === s.a.id ? s.a : s.b);
  const losers = semifinals.map(s => s.winner === s.a.id ? s.b : s.a);
  
  // Final - Conservar resultados si ya estaban
  finalMatch = { a:winners[0], b:winners[1], sets: finalMatch ? finalMatch.sets : [], winner: finalMatch ? finalMatch.winner : null };
  // 3er Puesto - Conservar resultados si ya estaban
  thirdPlace = { a:losers[0], b:losers[1], sets: thirdPlace ? thirdPlace.sets : [], winner: thirdPlace ? thirdPlace.winner : null };
  
  saveToLocalStorage(); // GUARDADO
}

// Registrar resultado final
function recordFinalResult(set1, set2, set3){
    if(!finalMatch) return;
    finalMatch.sets = [set1,set2,set3].filter(Boolean);
    finalMatch.winner = calculateKnockoutWinner(finalMatch);
    saveToLocalStorage(); // GUARDADO
}

// Registrar resultado 3er puesto
function recordThirdPlaceResult(set1, set2, set3){
    if(!thirdPlace) return;
    thirdPlace.sets = [set1,set2,set3].filter(Boolean);
    thirdPlace.winner = calculateKnockoutWinner(thirdPlace);
    saveToLocalStorage(); // GUARDADO
}

// =======================================================
// === INICIALIZACIÓN DE LA APP ==========================
// =======================================================

// Cargar los datos al inicio
loadFromLocalStorage();