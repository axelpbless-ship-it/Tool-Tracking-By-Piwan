/**
 * Lógica de JavaScript para el Sistema de Gestión de Inventario
 *
 * NOTA: Este código asume que se está ejecutando en un contexto HTML
 * donde se han cargado las dependencias de Firebase y se han definido
 * las variables globales __app_id, __firebase_config y __initial_auth_token.
 */

// --- IMPORTACIONES DE FIREBASE ---
// En el entorno Canvas, estas importaciones deben hacerse en el script tag del HTML.
/*
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
*/

// --- CONFIGURACIÓN Y VARIABLES GLOBALES (Asumiendo disponibilidad desde el entorno) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app, db, auth, userId = null;
let inventoryData = []; // Estado de los datos del inventario
let currentView = 'home'; // Control de la vista actual (e.g., 'home', 'add', 'edit')

// --- UTILITIES ---

/**
 * Inicializa Firebase y los servicios de autenticación.
 */
function initializeFirebase() {
    if (!firebaseConfig) {
        console.error("Firebase config no disponible. No se puede inicializar.");
        showMessage("Error de configuración de la aplicación.", "error");
        return false;
    }
    // Asumiendo que las funciones de Firebase están disponibles globalmente tras la importación en el HTML
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    return true;
}

/**
 * Muestra un mensaje temporal (toast o modal).
 * En la implementación de 1441 líneas, esto manipula el DOM de un toast.
 * @param {string} message Mensaje a mostrar.
 * @param {string} type Tipo de mensaje ('success', 'error', 'warning').
 */
function showMessage(message, type = 'info') {
    console.log(`[Mensaje - ${type.toUpperCase()}]: ${message}`);
    // Implementación DOM omitida por brevedad
}

/**
 * Cambia la vista de la aplicación al manipular las clases 'hidden'.
 * En la implementación completa, se ocultan/muestran divs principales.
 * @param {string} viewName Nombre de la vista a mostrar (e.g., 'home-view').
 */
function navigateTo(viewName) {
    console.log(`Navegando a la vista: ${viewName}`);
    currentView = viewName;
    // Lógica DOM para ocultar todas las vistas y mostrar solo la requerida
}


// --- AUTENTICACIÓN ---

/**
 * Configura el listener de estado de autenticación de Firebase.
 */
async function setupAuth() {
    if (!auth) return;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            console.log("Usuario autenticado:", userId);
            // Mostrar la interfaz de la aplicación
            updateAuthUI(true);
            // Iniciar la escucha de datos
            setupRealtimeDataListener();
        } else {
            console.log("No hay usuario. Intentando inicio de sesión anónimo/custom.");
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Error en el inicio de sesión:", error);
                // Si falla, usar un ID temporal (solo para entornos sin auth)
                userId = crypto.randomUUID();
                updateAuthUI(true); // Mostrar UI con ID temporal
            }
        }
    });
}

/**
 * Actualiza los elementos del DOM relacionados con el estado de autenticación.
 * @param {boolean} isAuthenticated Indica si un usuario está autenticado o tiene un ID temporal.
 */
function updateAuthUI(isAuthenticated) {
    const status = isAuthenticated ? `ID: ${userId.substring(0, 8)}...` : 'Cargando...';
    console.log(`Estado de autenticación actualizado: ${status}`);
    // Lógica DOM para actualizar el display del userId y mostrar/ocultar el preloader.
}


// --- LECTURA DE DATOS EN TIEMPO REAL (R) ---

/**
 * Configura el listener de tiempo real para la colección de inventario del usuario.
 */
function setupRealtimeDataListener() {
    if (!db || !userId) return;

    // Path privado del usuario: /artifacts/{appId}/users/{userId}/inventory
    const inventoryCollectionPath = `/artifacts/${appId}/users/${userId}/inventory`;
    const inventoryCollectionRef = collection(db, inventoryCollectionPath);
    
    // Consulta sin ordenamiento para evitar errores de índice
    const q = query(inventoryCollectionRef);

    onSnapshot(q, (snapshot) => {
        const changes = snapshot.docChanges();
        if (changes.length > 0) {
            inventoryData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Ordenar en memoria por nombre (por ejemplo)
            inventoryData.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

            console.log("Datos de inventario actualizados. Total:", inventoryData.length);
            // Renderizar la lista
            renderInventoryList(inventoryData); 
        } else {
             console.log("No hay cambios nuevos en los datos.");
        }
    }, (error) => {
        console.error("Error al escuchar los datos de inventario:", error);
        showMessage("Error al cargar los datos en tiempo real.", "error");
    });
}


// --- OPERACIONES CRUD ---

/**
 * Añade un nuevo artículo al inventario (C).
 * @param {object} itemData Datos del nuevo artículo (name, quantity, price, etc.).
 */
async function addItem(itemData) {
    if (!db || !userId) return;
    try {
        const inventoryCollectionPath = `/artifacts/${appId}/users/${userId}/inventory`;
        const docRef = await addDoc(collection(db, inventoryCollectionPath), {
            ...itemData,
            quantity: Number(itemData.quantity) || 0, // Asegurar que sea número
            price: Number(itemData.price) || 0,     // Asegurar que sea número
            createdAt: new Date().toISOString()
        });
        console.log("Documento añadido con ID:", docRef.id);
        showMessage("Artículo añadido correctamente.", "success");
        navigateTo('home-view');
    } catch (e) {
        console.error("Error al añadir documento:", e);
        showMessage("Error al añadir el artículo.", "error");
    }
}

/**
 * Actualiza un artículo existente (U).
 * @param {string} id ID del documento de Firestore.
 * @param {object} updates Campos a actualizar.
 */
async function updateItem(id, updates) {
    if (!db || !userId || !id) return;
    try {
        const docPath = `/artifacts/${appId}/users/${userId}/inventory/${id}`;
        const itemRef = doc(db, docPath);
        
        const finalUpdates = {
            ...updates,
            quantity: Number(updates.quantity) || 0,
            price: Number(updates.price) || 0
        };

        await updateDoc(itemRef, finalUpdates);
        console.log("Documento actualizado:", id);
        showMessage("Artículo actualizado correctamente.", "success");
        navigateTo('home-view');
    } catch (e) {
        console.error("Error al actualizar documento:", e);
        showMessage("Error al actualizar el artículo.", "error");
    }
}

/**
 * Elimina un artículo del inventario (D).
 * @param {string} id ID del documento de Firestore.
 */
async function deleteItem(id) {
    if (!db || !userId || !id) return;
    try {
        const docPath = `/artifacts/${appId}/users/${userId}/inventory/${id}`;
        await deleteDoc(doc(db, docPath));
        console.log("Documento eliminado:", id);
        showMessage("Artículo eliminado correctamente.", "success");
    } catch (e) {
        console.error("Error al eliminar documento:", e);
        showMessage("Error al eliminar el artículo.", "error");
    }
}


// --- LÓGICA DE RENDERIZADO Y EVENTOS (MOCK) ---

/**
 * Renderiza la lista de artículos en el contenedor de inventario.
 * @param {Array} items Lista de artículos.
 */
function renderInventoryList(items) {
    // Esta función contenía la lógica compleja de manipulación del DOM (creación de tarjetas, botones, etc.)
    const listContainer = document.getElementById('inventory-list-container');
    if (listContainer) {
        listContainer.innerHTML = ''; // Limpiar el contenedor
        
        if (items.length === 0) {
            listContainer.innerHTML = `<div class="text-center p-6 text-gray-500">No hay artículos en el inventario. ¡Añade uno!</div>`;
            return;
        }

        items.forEach(item => {
            const itemElement = document.createElement('div');
            // Aquí iría la estructura de la tarjeta del artículo con Tailwind CSS y datos.
            // ... (Estructura de tarjeta con botones de Editar y Eliminar)
            listContainer.appendChild(itemElement);
        });
        console.log(`Renderizado ${items.length} artículos en la vista.`);
    }
}

/**
 * Asigna los event listeners a los botones y formularios principales.
 */
function setupEventListeners() {
    // 1. Navegación
    document.getElementById('nav-add-item')?.addEventListener('click', () => navigateTo('add-item-view'));
    document.getElementById('nav-home')?.addEventListener('click', () => navigateTo('home-view'));

    // 2. Formulario de Añadir
    document.getElementById('add-item-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        // Recoger datos del formulario (omitiendo la validación y recolección detallada)
        const formData = {
            name: document.getElementById('new-item-name').value,
            quantity: document.getElementById('new-item-quantity').value,
            price: document.getElementById('new-item-price').value,
            description: document.getElementById('new-item-description').value,
            category: document.getElementById('new-item-category').value
        };
        addItem(formData);
    });

    // 3. Delegación de Eventos para Editar y Eliminar
    document.getElementById('inventory-list-container')?.addEventListener('click', (e) => {
        const target = e.target;
        // Busca el ID del artículo más cercano
        const itemId = target.closest('[data-item-id]')?.dataset.itemId;
        if (!itemId) return;

        if (target.classList.contains('delete-btn')) {
            // Mostrar modal de confirmación personalizado (no alert)
            // ... Lógica de modal
            deleteItem(itemId); // Asumiendo que el modal confirma
        } else if (target.classList.contains('edit-btn')) {
            // Obtener el artículo actual
            const itemToEdit = inventoryData.find(item => item.id === itemId);
            if (itemToEdit) {
                // ... Rellenar formulario de edición y navegar
                navigateTo('edit-item-view');
            }
        }
    });

    // 4. Formulario de Edición
    document.getElementById('edit-item-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        // Asume que el formulario tiene un campo oculto para el ID
        const itemId = document.getElementById('edit-item-id').value; 
        const updatedData = {
            name: document.getElementById('edit-item-name').value,
            quantity: document.getElementById('edit-item-quantity').value,
            price: document.getElementById('edit-item-price').value,
            description: document.getElementById('edit-item-description').value,
            category: document.getElementById('edit-item-category').value
        };
        updateItem(itemId, updatedData);
    });
}

// --- INICIALIZACIÓN DE LA APLICACIÓN ---

/**
 * Función principal que inicia toda la lógica de la aplicación.
 */
function startApp() {
    if (initializeFirebase()) {
        setupAuth();
        setupEventListeners();
        // Iniciar en la vista principal
        navigateTo('home-view'); 
    }
}

// Iniciar la aplicación cuando el DOM esté completamente cargado
window.onload = startApp;
