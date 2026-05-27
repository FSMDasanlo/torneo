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

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-triangle';
    
    notification.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 4000);
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

async function createNewTournament() {
    const nameInput = document.getElementById('newTournamentName');
    const tournamentName = nameInput.value.trim();
    const classificationMethod = document.querySelector('input[name="classificationMethod"]:checked')?.value || 'points';
    const setsInput = document.getElementById('newTournamentSets');
    const maxSets = parseInt(setsInput ? setsInput.value : 3) || 3;
    if (!tournamentName) {
        showNotification('Por favor, introduce un nombre para el torneo.', 'error');
        return;
    }
    // Crea un nuevo documento con un ID automático en la colección 'tournaments'
    const newDocRef = await db.collection('tournaments').add({
        name: tournamentName,
        classificationMethod,
        maxSets,
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
    const confirmed = await showConfirm({
        title: 'Borrar Torneo',
        message: `¿Estás seguro de que quieres borrar el torneo "${name}"? Esta acción es permanente y no se puede deshacer.`,
        okText: 'Borrar Permanentemente',
        isDanger: true,
        needsPassword: true
    });

    if (confirmed) {
        try {
            await db.collection('tournaments').doc(id).delete();
            console.log(`Torneo ${id} borrado.`);
            showNotification('Torneo eliminado correctamente.', 'success');
        } catch (error) {
            console.error("Error al borrar el torneo: ", error);
            showNotification("Hubo un error al intentar borrar el torneo.", "error");
        }
    }
}

function copyTournament(idToCopy, originalName) {
    document.getElementById('copyTournamentId').value = idToCopy;
    document.getElementById('copyTournamentName').value = `Copia de ${originalName}`;
    document.getElementById('copyPassword').value = '';
    document.getElementById('copyTournamentModal').style.display = 'block';
}

async function performCopy() {
    try {
        const idToCopy = document.getElementById('copyTournamentId').value;
        const newName = document.getElementById('copyTournamentName').value.trim();
        const copyOption = document.querySelector('input[name="copyOption"]:checked').value;
        const password = document.getElementById('copyPassword').value;

        if (!newName) {
            showNotification("Introduce un nombre para el torneo.", "error");
            return;
        }

        if (password !== "Traid1959") {
            showNotification("Contraseña incorrecta", "error");
            return;
        }

        const docRef = db.collection('tournaments').doc(idToCopy);
        const doc = await docRef.get();
        if (!doc.exists) {
            showNotification('El torneo original no existe.', 'error');
            return;
        }

        const originalData = doc.data();

        const copyResults = (copyOption === 'full_copy');

        const newData = {
            name: newName.trim(),
            classificationMethod: originalData.classificationMethod || 'points',
            maxSets: originalData.maxSets || 5,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            
            // --- Datos que se copian siempre ---
            groups: originalData.groups || { 1: [], 2: [] },
            groupLimit: originalData.groupLimit || 4,
            nextColorIndex: originalData.nextColorIndex || 0,
            tournamentMode: originalData.tournamentMode || 'directed',
            drawPool: originalData.drawPool || [], // Copia la bolsa de sorteo por si acaso

            // --- Datos que se copian condicionalmente ---
            matches: copyResults ? (originalData.matches || []) : [],
            semifinals: copyResults ? (originalData.semifinals || []) : [],
            finalMatch: copyResults ? (originalData.finalMatch || null) : null,
            thirdPlace: copyResults ? (originalData.thirdPlace || null) : null,
            fifthPlaceMatch: copyResults ? (originalData.fifthPlaceMatch || null) : null,
            seventhPlaceMatch: copyResults ? (originalData.seventhPlaceMatch || null) : null
        };

        const newDocRef = await db.collection('tournaments').add(newData);
        
        showNotification(`Torneo "${newData.name}" copiado con éxito.`, 'success');
        document.getElementById('copyTournamentModal').style.display = 'none';

    } catch (error) {
        console.error("Error al copiar el torneo: ", error);
        showNotification("Error al intentar copiar el torneo.", "error");
        document.getElementById('copyTournamentModal').style.display = 'none';
    }
}

// Cargar y mostrar la lista de torneos al cargar la página
function initializeTournamentList() {
    const listContainer = document.getElementById('tournamentsList');
    const createBtn = document.querySelector('#createTournamentCard .btn-primary');
    const nameInput = document.getElementById('newTournamentName');
    
    // NUEVO: Elementos para mostrar/ocultar el formulario de creación
    const showCreateBtn = document.getElementById('showCreateBtn');
    const createTournamentCard = document.getElementById('createTournamentCard');

    // Asignar eventos a los elementos
    createBtn.onclick = createNewTournament;
    showCreateBtn.onclick = () => {
        createTournamentCard.style.display = 'block'; // Muestra el contenedor
        nameInput.focus(); // Pone el foco en el campo de texto
    };
    nameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            createNewTournament();
        }
    });

    // Eventos del modal de copia
    const modal = document.getElementById('copyTournamentModal');
    const closeBtn = modal.querySelector('.close-button');
    const confirmCopyBtn = document.getElementById('confirmCopyBtn');

    closeBtn.onclick = () => modal.style.display = 'none';
    confirmCopyBtn.onclick = performCopy;
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
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