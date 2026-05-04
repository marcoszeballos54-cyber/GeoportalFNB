// ============================================
// CONFIGURACIÓN SUPABASE
// ============================================
const SUPABASE_URL = 'https://tejavqodtbofhfszoufq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlamF2cW9kdGJvZmhmc3pvdWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MjQ0OTYsImV4cCI6MjA5MzQwMDQ5Nn0.ilith1EIdOkty5oJ5KiZnAwgN_5LY9iwqCDvfQwvXbg';

let supabaseClient;
let map;
let areasFeatures = [];
let labelsMarkers = [];
let labelsVisible = true;
let currentBaseMap = 'streets';
let currentResultsDropdown = null;

// Inicializar cliente Supabase
supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// CONFIGURACIÓN DE MAPAS BASE
// ============================================
const baseMaps = {
    streets: {
        style: {
            version: 8,
            sources: {
                'osm': {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '© OpenStreetMap contributors'
                }
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
        },
        name: 'Calles'
    },
    satellite: {
        style: {
            version: 8,
            sources: {
                'satellite': {
                    type: 'raster',
                    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                    tileSize: 256,
                    attribution: '© Esri, Maxar, Earthstar Geographics'
                }
            },
            layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
        },
        name: 'Satélite'
    },
    topo: {
        style: {
            version: 8,
            sources: {
                'topo': {
                    type: 'raster',
                    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
                    tileSize: 256,
                    attribution: '© Esri, HERE, Garmin, FAO, NOAA, USGS'
                }
            },
            layers: [{ id: 'topo', type: 'raster', source: 'topo' }]
        },
        name: 'Topográfico'
    }
};

// ============================================
// INICIALIZAR MAPA
// ============================================
function initMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: baseMaps.streets.style,
        center: [-63.0, -17.0],
        zoom: 6.5,
        attributionControl: true
    });
    
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
    
    // Eventos de capa
    map.on('click', 'areas-fill', async (e) => {
        if (e.features && e.features.length > 0) {
            const gid = e.features[0].properties.gid;
            if (gid) await mostrarInfoArea(gid);
        }
    });
    
    map.on('mouseenter', 'areas-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'areas-fill', () => {
        map.getCanvas().style.cursor = '';
    });
    
    map.on('load', () => {
        cargarAreas();
        cargarEstadisticas();
    });
}

// ============================================
// CAMBIAR MAPA BASE
// ============================================
function cambiarMapaBase(tipo) {
    if (currentBaseMap === tipo) return;
    currentBaseMap = tipo;
    
    const newStyle = baseMaps[tipo].style;
    map.setStyle(newStyle);
    
    map.once('style.load', () => {
        if (areasFeatures.length > 0) {
            agregarCapasAreas();
        }
        if (labelsVisible) {
            agregarEtiquetas();
        }
    });
}

// ============================================
// AGREGAR CAPAS DE ÁREAS
// ============================================
function agregarCapasAreas() {
    if (areasFeatures.length === 0) return;
    
    const geojson = { type: 'FeatureCollection', features: areasFeatures };
    
    if (map.getSource('areas')) {
        map.getSource('areas').setData(geojson);
        return;
    }
    
    map.addSource('areas', { type: 'geojson', data: geojson });
    map.addLayer({
        id: 'areas-fill',
        type: 'fill',
        source: 'areas',
        paint: {
            'fill-color': '#2ecc71',
            'fill-opacity': 0.55,
            'fill-outline-color': '#1e7e34'
        }
    });
    map.addLayer({
        id: 'areas-line',
        type: 'line',
        source: 'areas',
        paint: {
            'line-color': '#1e7e34',
            'line-width': 2,
            'line-opacity': 0.8
        }
    });
}

// ============================================
// CARGAR ÁREAS DESDE SUPABASE
// ============================================
async function cargarAreas() {
    try {
        const { data, error } = await supabaseClient
            .from('areas_protegidas_fnb')
            .select('gid, nombre_cor, geom, departamen, municipio, sup_km2')
            .not('geom', 'is', null)
            .limit(3000);
        
        if (error) throw error;
        
        areasFeatures = [];
        for (let row of data) {
            let geom = row.geom;
            if (geom && typeof geom === 'object' && geom.type && geom.coordinates) {
                areasFeatures.push({
                    type: 'Feature',
                    geometry: geom,
                    properties: {
                        gid: row.gid,
                        nombre: row.nombre_cor || 'Sin nombre',
                        departamento: row.departamen || '',
                        municipio: row.municipio || '',
                        superficie: row.sup_km2 || 0
                    }
                });
            }
        }
        
        agregarCapasAreas();
        agregarEtiquetas();
        
        // Actualizar UI de capas
        document.getElementById('listaDeCapas').innerHTML = `
            <div class="capa-item">
                <div class="capa-info">
                    <div class="capa-icon">
                        <i class="fas fa-tree"></i>
                    </div>
                    <div>
                        <div class="capa-nombre">Áreas Protegidas FNB</div>
                        <div class="capa-badge">${areasFeatures.length} polígonos</div>
                    </div>
                </div>
                <button class="btn-capa" id="toggleCapaBtn">Ocultar</button>
            </div>
        `;
        
        document.getElementById('toggleCapaBtn').onclick = toggleCapaVisibilidad;
        
    } catch (err) {
        console.error('Error cargando áreas:', err);
        document.getElementById('listaDeCapas').innerHTML = `
            <div class="capa-item">
                <div class="capa-info">
                    <div class="capa-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="capa-nombre">Error al cargar capas</div>
                </div>
            </div>
        `;
    }
}

// ============================================
// ESTADÍSTICAS
// ============================================
async function cargarEstadisticas() {
    try {
        const { count, error } = await supabaseClient
            .from('areas_protegidas_fnb')
            .select('*', { count: 'exact', head: true });
        
        if (!error) {
            document.getElementById('totalAreas').textContent = count || '--';
        }
    } catch (err) {
        console.error('Error cargando estadísticas:', err);
        document.getElementById('totalAreas').textContent = '--';
    }
}

// ============================================
// ETIQUETAS
// ============================================
function agregarEtiquetas() {
    labelsMarkers.forEach(marker => marker.remove());
    labelsMarkers = [];
    
    if (!labelsVisible) return;
    
    areasFeatures.forEach(feature => {
        const nombre = feature.properties.nombre;
        if (!nombre || nombre === 'Sin nombre') return;
        
        let coords = null;
        const geom = feature.geometry;
        
        if (geom.type === 'MultiPolygon' && geom.coordinates && geom.coordinates[0] && geom.coordinates[0][0]) {
            const points = geom.coordinates[0][0];
            if (points && points.length > 0) {
                let sumX = 0, sumY = 0;
                points.forEach(p => {
                    sumX += p[0];
                    sumY += p[1];
                });
                coords = [sumX / points.length, sumY / points.length];
            }
        } else if (geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0]) {
            const points = geom.coordinates[0];
            if (points && points.length > 0) {
                let sumX = 0, sumY = 0;
                points.forEach(p => {
                    sumX += p[0];
                    sumY += p[1];
                });
                coords = [sumX / points.length, sumY / points.length];
            }
        }
        
        if (coords) {
            const labelEl = document.createElement('div');
            labelEl.className = 'map-label';
            labelEl.textContent = nombre;
            
            const marker = new maplibregl.Marker({
                element: labelEl,
                anchor: 'bottom',
                offset: [0, -5]
            })
            .setLngLat(coords)
            .addTo(map);
            
            labelsMarkers.push(marker);
        }
    });
}

function toggleCapaVisibilidad() {
    const btn = document.getElementById('toggleCapaBtn');
    const vis = map.getLayoutProperty('areas-fill', 'visibility');
    
    if (vis === 'none') {
        map.setLayoutProperty('areas-fill', 'visibility', 'visible');
        map.setLayoutProperty('areas-line', 'visibility', 'visible');
        btn.textContent = 'Ocultar';
        if (!labelsVisible) toggleLabels();
    } else {
        map.setLayoutProperty('areas-fill', 'visibility', 'none');
        map.setLayoutProperty('areas-line', 'visibility', 'none');
        btn.textContent = 'Mostrar';
    }
}

function toggleLabels() {
    labelsVisible = !labelsVisible;
    const btn = document.getElementById('toggleLabelsBtn');
    const span = btn.querySelector('span');
    
    if (labelsVisible) {
        agregarEtiquetas();
        span.textContent = 'Etiquetas';
    } else {
        labelsMarkers.forEach(marker => marker.remove());
        labelsMarkers = [];
        span.textContent = 'Etiquetas';
    }
}

// ============================================
// MOSTRAR INFORMACIÓN DEL ÁREA
// ============================================
async function mostrarInfoArea(gid) {
    const panelContent = document.getElementById('panelContent');
    panelContent.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Cargando información...</p></div>';
    abrirPanel();
    
    try {
        const { data, error } = await supabaseClient
            .rpc('obtener_info_area', { gid_param: gid });
        
        if (error) throw error;
        
        if (data && Object.keys(data).length > 0) {
            let html = '';
            const campos = [
                { key: 'nombre_cor', label: '📌 Nombre' },
                { key: 'departamen', label: '📍 Departamento' },
                { key: 'municipio', label: '🏘️ Municipio' },
                { key: 'designacio', label: '📋 Designación' },
                { key: 'iucn_cat', label: '🌿 Categoría IUCN' },
                { key: 'anho', label: '📅 Año' },
                { key: 'estado', label: '⚖️ Estado' },
                { key: 'sup_km2', label: '📏 Superficie (km²)', formatter: (v) => Number(v).toLocaleString() + ' km²' },
                { key: 'superficie', label: '📐 Superficie (ha)', formatter: (v) => Number(v).toLocaleString() + ' ha' },
                { key: 'region', label: '🌎 Región' },
                { key: 'obj_creac', label: '🏛️ Creación' },
                { key: 'ley_creaci', label: '⚖️ Ley' }
            ];
            
            for (let campo of campos) {
                let valor = data[campo.key];
                if (valor && valor !== null && valor !== '' && valor !== 0) {
                    if (campo.formatter) valor = campo.formatter(valor);
                    html += `<div class="campo"><div class="campo-label">${campo.label}</div><div class="campo-valor">${valor}</div></div>`;
                }
            }
            panelContent.innerHTML = html || '<div class="empty-state"><i class="fas fa-info-circle"></i><p>Sin información detallada</p></div>';
        } else {
            panelContent.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>No se encontraron datos</p></div>';
        }
    } catch (err) {
        console.error('Error:', err);
        panelContent.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error: ${err.message}</p></div>`;
    }
}

// ============================================
// BÚSQUEDA POR NOMBRE
// ============================================
async function buscarPorNombre(termino) {
    eliminarDropdown();
    
    try {
        const { data, error } = await supabaseClient
            .rpc('buscar_areas_por_nombre', { search_term: termino || '' });
        
        if (error) throw error;
        
        let resultados = data;
        if (typeof data === 'string') {
            resultados = JSON.parse(data);
        }
        
        const count = Array.isArray(resultados) ? resultados.length : 0;
        
        if (count === 0) {
            document.getElementById('resultadosCount').innerHTML = '🔍 No se encontraron áreas';
            return;
        }
        
        document.getElementById('resultadosCount').innerHTML = `🔍 ${count} área(s) encontrada(s)`;
        
        const dropdown = document.createElement('div');
        dropdown.className = 'resultados-dropdown';
        
        let html = '';
        for (let area of resultados) {
            const nombreEscapado = (area.nombre_cor || 'Sin nombre').replace(/'/g, "\\'");
            html += `
                <div class="resultado-item" data-gid="${area.gid}" data-nombre="${nombreEscapado}">
                    <div class="resultado-nombre">${area.nombre_cor || 'Sin nombre'}</div>
                    <div class="resultado-detalle">${area.departamen || ''} - ${area.municipio || ''} | ${area.sup_km2 || 0} km²</div>
                </div>
            `;
        }
        
        dropdown.innerHTML = html;
        
        const searchContainer = document.querySelector('.search-container');
        searchContainer.parentElement.style.position = 'relative';
        searchContainer.parentElement.appendChild(dropdown);
        currentResultsDropdown = dropdown;
        
        dropdown.querySelectorAll('.resultado-item').forEach(item => {
            item.addEventListener('click', () => {
                const gid = parseInt(item.dataset.gid);
                const nombre = item.dataset.nombre;
                seleccionarArea(gid, nombre);
                eliminarDropdown();
            });
        });
        
        setTimeout(() => {
            eliminarDropdown();
        }, 10000);
        
    } catch (err) {
        console.error('Error en búsqueda:', err);
        document.getElementById('resultadosCount').innerHTML = '❌ Error: ' + err.message;
    }
}

function eliminarDropdown() {
    if (currentResultsDropdown) {
        currentResultsDropdown.remove();
        currentResultsDropdown = null;
    }
}

function seleccionarArea(gid, nombre) {
    eliminarDropdown();
    mostrarInfoArea(gid);
    
    const feature = areasFeatures.find(f => f.properties.gid === gid);
    if (feature && feature.geometry) {
        let coords = null;
        const geom = feature.geometry;
        if (geom.type === 'MultiPolygon' && geom.coordinates && geom.coordinates[0] && geom.coordinates[0][0] && geom.coordinates[0][0][0]) {
            coords = [geom.coordinates[0][0][0][0], geom.coordinates[0][0][0][1]];
        } else if (geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0] && geom.coordinates[0][0]) {
            coords = [geom.coordinates[0][0][0], geom.coordinates[0][0][1]];
        }
        if (coords) map.flyTo({ center: coords, zoom: 10, duration: 1500 });
    }
}

function buscarTexto(texto) {
    document.getElementById('searchInput').value = texto;
    buscarPorNombre(texto);
}

// ============================================
// PANEL DE INFORMACIÓN
// ============================================
function abrirPanel() {
    document.getElementById('infoPanel').classList.add('open');
    document.getElementById('panelOverlay').classList.add('active');
}

function cerrarPanel() {
    document.getElementById('infoPanel').classList.remove('open');
    document.getElementById('panelOverlay').classList.remove('active');
}

// ============================================
// SIDEBAR TOGGLE (responsive)
// ============================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('mobile-open');
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    
    // Eventos
    document.getElementById('btnBuscar').onclick = () => buscarPorNombre(document.getElementById('searchInput').value);
    document.getElementById('searchInput').onkeypress = (e) => { if (e.key === 'Enter') buscarPorNombre(e.target.value); };
    document.getElementById('closePanelBtn').onclick = cerrarPanel;
    document.getElementById('panelOverlay').onclick = cerrarPanel;
    document.getElementById('toggleLabelsBtn').onclick = () => toggleLabels();
    document.getElementById('sidebarToggle').onclick = toggleSidebar;
    document.getElementById('mobileMenuBtn').onclick = toggleMobileSidebar;
    
    // Selector de mapa base
    document.querySelectorAll('.base-map-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.base-map-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cambiarMapaBase(btn.dataset.map);
        });
    });
    
    // Sugerencias de búsqueda
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const texto = chip.dataset.buscar || '';
            buscarTexto(texto);
        });
    });
    
    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container') && !e.target.closest('.resultados-dropdown')) {
            eliminarDropdown();
        }
    });
});