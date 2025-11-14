// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBKYu9icthWhs5kEp0NFHxxcCGBwknAhVA",
    authDomain: "torneospadel.firebaseapp.com",
    projectId: "torneospadel",
    storageBucket: "torneospadel.firebasestorage.app",
    messagingSenderId: "962820410331",
    appId: "1:962820410331:web:a4e658fda5afee8d6cf5fe"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- Lógica de la aplicación ---

async function createNewTournament() {
    const nameInput = document.getElementById('newTournamentName');
    const tournamentName = nameInput.value.trim();
    if (!tournamentName) {
        alert('Por favor, introduce un nombre para el torneo.');
        return;
    }
    // Crea un nuevo documento con un ID automático en la colección 'tournaments'
    const newDocRef = await db.collection('tournaments').add({
        name: tournamentName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), // Guarda la fecha de creación
        groups: { 1: [], 2: [] }, matches: [], semifinals: [], finalMatch: null, thirdPlace: null, groupLimit: 4, nextColorIndex: 0
    });
    // Redirige al usuario a la página del torneo con el ID del nuevo documento
    window.location.href = `torneo.html?id=${newDocRef.id}`;
}

function loadTournament(id) {
    window.location.href = `torneo.html?id=${id}`;
}

async function deleteTournament(id, name) {
    const password = prompt("Para realizar esta acción, por favor introduce la contraseña:");
    if (password === null) return; // El usuario pulsó "Cancelar"

    if (password !== "Traid1959") {
        alert("Contraseña incorrecta. La operación ha sido cancelada.");
        return;
    }

    // Si la contraseña es correcta, se continúa con la confirmación
    if (confirm(`¿Estás seguro de que quieres borrar el torneo "${name}"? Esta acción es permanente.`)) {
        try {
            await db.collection('tournaments').doc(id).delete();
            console.log(`Torneo ${id} borrado.`);
        } catch (error) {
            console.error("Error al borrar el torneo: ", error);
            alert("Hubo un error al intentar borrar el torneo.");
        }
    }
}

async function copyTournament(idToCopy, originalName) {
    const password = prompt("Para realizar esta acción, por favor introduce la contraseña:");
    if (password === null) return; // El usuario pulsó "Cancelar"

    if (password !== "Traid1959") {
        alert("Contraseña incorrecta. La operación ha sido cancelada.");
        return;
    }

    // Si la contraseña es correcta, se continúa con la copia
    const newName = prompt(`Introduce el nombre para la copia del torneo:`, `Copia de ${originalName}`);
    if (!newName || newName.trim() === '') {
        // El usuario canceló o no introdujo nombre
        return;
    }

    try {
        // 1. Leer los datos del torneo original
        const docRef = db.collection('tournaments').doc(idToCopy);
        const doc = await docRef.get();

        if (!doc.exists) {
            alert('Error: El torneo que intentas copiar no existe.');
            return;
        }

        const originalData = doc.data();

        // 2. Crear el nuevo objeto de torneo, copiando solo lo que nos interesa
        const newData = {
            name: newName.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            groups: originalData.groups || { 1: [], 2: [] }, // Copia las parejas y grupos
            groupLimit: originalData.groupLimit || 4,       // Copia el límite
            nextColorIndex: originalData.nextColorIndex || 0, // Copia el índice de color
            matches: [], semifinals: [], finalMatch: null, thirdPlace: null // RESULTADOS LIMPIOS
        };

        // 3. Crear el nuevo torneo y redirigir
        const newDocRef = await db.collection('tournaments').add(newData);
        window.location.href = `torneo.html?id=${newDocRef.id}`;

    } catch (error) {
        console.error("Error al copiar el torneo: ", error);
        alert("Hubo un error al intentar copiar el torneo.");
    }
}

// Cargar y mostrar la lista de torneos al cargar la página
function initializeTournamentList() {
    const listContainer = document.getElementById('tournamentsList');
    const createBtn = document.querySelector('.btn-primary');
    const nameInput = document.getElementById('newTournamentName');

    // Asignar eventos a los elementos
    createBtn.onclick = createNewTournament;
    nameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            createNewTournament();
        }
    });

    db.collection('tournaments').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        if (snapshot.empty) {
            listContainer.innerHTML = '<p>No hay torneos creados. ¡Crea el primero!</p>';
            return;
        }
        
        let tournamentsHTML = ''; // Construir el HTML en una variable
        snapshot.forEach(doc => {
            const tournament = doc.data();
            const tournamentName = tournament.name || 'Torneo sin nombre';
            const date = tournament.createdAt ? new Date(tournament.createdAt.seconds * 1000).toLocaleDateString() : 'Sin fecha';
            const escapedName = tournamentName.replace(/'/g, "\\'");

            let statusHtml = '';
            if (tournament.finalMatch && tournament.finalMatch.winner) {
                const final = tournament.finalMatch;
                const winnerPair = final.a.id === final.winner ? final.a : final.b;
                const runnerUpPair = final.a.id !== final.winner ? final.a : final.b;
                const winnerName = winnerPair.players.join(' - ');
                const runnerUpName = runnerUpPair.players.join(' - ');
                statusHtml = `<div class="tournament-status"><span class="status-label finished">Finalizado</span><span class="winner" title="Ganadores"><i class="fas fa-crown"></i> ${winnerName}</span><span class="runner-up" title="Subcampeones"><i class="fas fa-medal"></i> ${runnerUpName}</span></div>`;
            } else if (tournament.matches && tournament.matches.some(m => m.sets && m.sets.length > 0)) {
                statusHtml = `<div class="tournament-status"><span class="status-label in-progress">En juego</span></div>`;
            } else {
                statusHtml = `<div class="tournament-status"><span class="status-label upcoming">Próximamente</span></div>`;
            }

            tournamentsHTML += `
                <div class="tournament-list-item" data-id="${doc.id}">
                    <div class="tournament-info">
                        <div class="tournament-name">${tournamentName}</div>
                        <div class="tournament-date">Creado el: ${date}</div>
                    </div>
                    ${statusHtml}
                    <div class="actions">
                        <button class="btn-copy-small" data-id="${doc.id}" data-name="${escapedName}" title="Copiar torneo"><i class="fas fa-copy"></i></button>
                        <button class="btn-delete-small" data-id="${doc.id}" data-name="${escapedName}" title="Borrar torneo"><i class="fas fa-trash-alt"></i></button>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>`;
        });
        listContainer.innerHTML = tournamentsHTML; // Asignar el HTML una sola vez

        // Añadir event listeners después de crear los elementos
        listContainer.querySelectorAll('.tournament-list-item').forEach(item => item.addEventListener('click', () => loadTournament(item.dataset.id)));
        listContainer.querySelectorAll('.btn-copy-small').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); copyTournament(btn.dataset.id, btn.dataset.name); }));
        listContainer.querySelectorAll('.btn-delete-small').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); deleteTournament(btn.dataset.id, btn.dataset.name); }));

    }, error => {
        console.error("Error al cargar la lista de torneos:", error);
        listContainer.innerHTML = '<p style="color: red;"><b>Error al cargar torneos.</b> Es posible que las reglas de seguridad de Firebase hayan expirado. Por favor, revisa la consola de Firebase.</p>';
    });
}

// Iniciar la carga de torneos cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeTournamentList);