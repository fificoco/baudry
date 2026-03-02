// ================================
// Variables globales et données
// ================================
let citiesData = [];
let userMarker = null;
let rings = [];
let agenceMarker = null;
let zonesActives = false;
let centerAgence = [48.18025, 3.29187];
let rayonAdresse = null;
const lastZoneLimit = 80000;
const agencySelect = document.getElementById('agency');
const villeInput = document.querySelector('input[placeholder="Ville"]');
const cpInput = document.querySelector('input[placeholder="Code Postal"]');


const map = L.map('map', {
  zoomControl: false,          // Supprime les boutons + / –
  attributionControl: false    // Supprime le texte "© OpenStreetMap contributors"
}).setView(centerAgence, 11);

const agences = [
  { name: "Baudry Sens 89", coords: [48.18025, 3.29187] },
  { name: "Congy Marc 89", coords: [47.81970,3.58274] },
];

agences.forEach(a => updateAgenceMarker(a.name, a.coords));

// ================================================================================
// mise en place de la carte Leaflet
// ================================================================================
L.control.attribution({
  position: 'bottomright' // ou 'topright', etc.
}).addTo(map).setPrefix('© Appli BAUDRY');

L.control.zoom({ position: 'topright' }).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ================================================================================
// charge des données de villes/codes postaux/geocodage
// ================================================================================
fetch('villes.json')
  .then(res => res.json())
  .then(data => { citiesData = data;
});

// ================================================================================
//
// ================================================================================
function getDefaultZones() {
    return [
      { rmin: 0, rmax: 12000, color: '#008000' },
      { rmin: 12000, rmax: 24000, color: '#ffff00' },
      { rmin: 24000, rmax: 36000, color: '#ffa500' },
      { rmin: 36000, rmax: 47000, color: '#ff0000' },
      { rmin: 47000, rmax: 76000, color: '#800080' },
    ];
  }
// ================================================================================
// mise a jour des marqueurs des agences
// ================================================================================
function updateAgenceMarker(name, coords) {
  if (agenceMarker) map.removeLayer(agenceMarker);
  agenceMarker = L.marker(coords, {
    icon: L.icon({
      iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png',
      iconSize: [32, 32]
    })
  }).addTo(map).bindPopup(`<b>${name}</b>`);
}
// ================================================================================
// affiche/masque la sidebar
// ================================================================================
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

const menuBurger = document.getElementById('menuBurger');
const sidebar = document.getElementById('sidebar');

menuBurger.addEventListener('click', () => {
  const isOpen = sidebar.classList.toggle('open');

  // Ternaire : tu peux loguer, changer un attribut, etc.
  console.log(isOpen ? 'Menu ouvert' : 'Menu fermé');

  // Bonus : si tu veux changer l’icône image (exemple)
  // menuBurger.setAttribute('xlink:href', isOpen ? 'iconeFermer.png' : 'iconeMenu.png');
});

// ================================================================================
// suppression des zones de livraison
// ================================================================================
function clearZones() {
  rings.forEach(r => map.removeLayer(r));
  rings = [];
}
// ================================================================================
// dessine une zone de livraison avec trou
// ================================================================================
function drawZoneEvidee(center, rMin, rMax, color) {
  const steps = 64;
  const latlngsOuter = [];
  const latlngsInner = [];
  const toLatLng = (angle, radius) => {
    const dx = radius * Math.cos(angle);
    const dy = radius * Math.sin(angle);
    const lat = center[0] + (180 / Math.PI) * (dy / 6378137);
    const lng = center[1] + (180 / Math.PI) * (dx / 6378137) / Math.cos(center[0] * Math.PI / 180);
    return [lat, lng];
  };
  for (let i = 0; i < steps; i++) {
    const angle = 2 * Math.PI * i / steps;
    latlngsOuter.push(toLatLng(angle, rMax));
    latlngsInner.unshift(toLatLng(angle, rMin));
  }
  const polygon = L.polygon([latlngsOuter, latlngsInner], {
    color: 'black',
    fillColor: color,
    fillOpacity: 0.2,
    weight: 0.7,
    opacity: 0.3
  }).addTo(map);
  rings.push(polygon);
}
// ================================================================================
// dessine les zones de livraison sans recherche
// ================================================================================
function drawZones(center, all = false) {
  clearZones();
  if (!zonesActives) return;
  // ✅ Recharge zones personnalisées ou défaut
  const stored = localStorage.getItem('zonesConfig');
  zonesConfig = stored ? JSON.parse(stored) : getDefaultZones();
  // 📏 Distance cible
  let distance = all ? lastZoneLimit : rayonAdresse;
  zonesConfig.forEach(zone => {
    if (all || (distance !== null && distance >= zone.rmin)) {
      drawZoneEvidee(center, zone.rmin, zone.rmax, zone.color);
    }
  });
  map.setView(center, 9);
}
// ================================================================================
// mise en ecoute du select des agences
// ================================================================================

function preventResize() {
  window.resizeTo(1080, 720);

  window.addEventListener('resize', function () {
    window.resizeTo(1080, 720);
  });
}

window.onload = preventResize;
// ================================================================================
// mise en ecoute du select des agences
// ================================================================================
agencySelect.addEventListener('change', e => {
  const [lat, lng] = e.target.value.split(',').map(Number);
  centerAgence = [lat, lng];
  const name = e.target.options[e.target.selectedIndex].dataset.name;
  map.setView(centerAgence, 11);
  updateAgenceMarker(name, centerAgence);
  if (zonesActives) drawZones(centerAgence);
});
// ================================================================================
// calcul de la distance entre deux points géographiques
// ================================================================================
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// ================================================================================
// mise en ecoute du bouton de validation de l'adresse
// ================================================================================
document.querySelector('.validate').addEventListener('click', () => {
  const ville = document.querySelector('input[placeholder="Ville"]').value.trim();
  const code = document.querySelector('input[placeholder="Code Postal"]').value.trim();
  const adresse = document.querySelector('input[placeholder="Adresse"]')?.value.trim();
  const resultZone = document.getElementById('result-zone');

  if (adresse) {
    const fullAddress = `${adresse}, ${ville} ${code}`;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          if (userMarker) map.removeLayer(userMarker);
          userMarker = L.marker([lat, lng], {
            icon: L.icon({
              iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/red.png',
              iconSize: [32, 32]
            })
          }).addTo(map).bindPopup("Destination : " + fullAddress).openPopup();
          rayonAdresse = getDistance(centerAgence[0], centerAgence[1], lat, lng);
          if (rayonAdresse > lastZoneLimit) {
            zonesActives = false;
            clearZones();
            resultZone.textContent = "🚫 Adresse hors zone de livraison (> 76 km)";
          } else {
            zonesActives = true;
            if (rayonAdresse <= 12000) {
              resultZone.textContent = "🟢 Zone 1 (0–12 km)";
            } else if (rayonAdresse <= 24000) {
              resultZone.textContent = "🟡 Zone 2 (12–24 km)";
            } else if (rayonAdresse <= 36000) {
              resultZone.textContent = "🟠 Zone 3 (24–36 km)";
            } else if (rayonAdresse <= 47000) {
              resultZone.textContent = "🔴 Zone 4 (36–47 km)";
            } else if (rayonAdresse <= 76000) {
            resultZone.textContent = "🟣 Zone 5 (47–76 km)";
            }
            drawZones(centerAgence);
          }
          resultZone.classList.add("resultZone-style-temp");
        } else {
          resultZone.textContent = "❌ Adresse introuvable.";
          resultZone.classList.add("resultZone-style-temp");
        }
      })
      .catch(() => {
        resultZone.textContent = "❌ Erreur de géocodage.";
        resultZone.classList.add("resultZone-style-temp");
      });
  } else {
    const match = citiesData.find(c =>
      ville && code &&
      c.ville.toLowerCase() === ville.toLowerCase() &&
      c.code === code
    );
    if (match) {
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker([match.lat, match.lng], {
        icon: L.icon({
          iconUrl: 'https://maps.gstatic.com/mapfiles/ms2/micons/red.png',
          iconSize: [32, 32]
        })
      }).addTo(map).bindPopup(match.ville).openPopup();
      rayonAdresse = getDistance(centerAgence[0], centerAgence[1], match.lat, match.lng);
      if (rayonAdresse > lastZoneLimit) {
        zonesActives = false;
        clearZones();
        resultZone.textContent = "🚫 Adresse hors zone de livraison (> 76 km)";
      } else {
        zonesActives = true;
        if (rayonAdresse <= 12000) {
          resultZone.textContent = "🟢 Zone 1 (0–12 km)";
        } else if (rayonAdresse <= 24000) {
          resultZone.textContent = "🟡 Zone 2 (12–24 km)";
        } else if (rayonAdresse <= 36000) {
          resultZone.textContent = "🟠 Zone 3 (24–36 km)";
        } else if (rayonAdresse <= 47000) {
          resultZone.textContent = "🔴 Zone 4 (36–47 km)";
        } else if (rayonAdresse <= 76000) {
          resultZone.textContent = "🟣 Zone 5 (47–76 km)";
        }
        drawZones(centerAgence);
      }
      resultZone.classList.add("resultZone-style-temp");
    } else {
      resultZone.textContent = "❌ Ville + code postal non trouvé.";
      resultZone.classList.add("resultZone-style-temp");
    }
  }
});
// ================================================================================
// mise en ecoute du champ ville et mise a jour des suggestions de villes
// ================================================================================
document.querySelector('input[placeholder="Ville"]').addEventListener('input', function () {
  const input = this.value.toLowerCase();
  const datalist = document.getElementById('suggestions-ville');
  datalist.innerHTML = '';
  citiesData
    .filter(c => c.ville.toLowerCase().startsWith(input))
    .slice(0, 15)
    .forEach(c => {
      const option = document.createElement('option');
      option.value = `${c.ville} (${c.code})`;
      datalist.appendChild(option);
    });
});
// ================================================================================
// mise en ecoute du champ code postal et mise a jour des suggestions de villes
// ================================================================================
document.querySelector('input[placeholder="Code Postal"]').addEventListener('input', function () {
  const input = this.value;
  const datalist = document.getElementById('suggestions-cp');
  datalist.innerHTML = '';
  citiesData
    .filter(c => c.code.startsWith(input))
    .slice(0, 15)
    .forEach(c => {
      const option = document.createElement('option');
      option.value = `${c.code} - ${c.ville}`;
      datalist.appendChild(option);
    });
});
// ================================================================================
// mise en ecoute du champ ville et mise a jour du champ code postal
// ================================================================================
villeInput.addEventListener('change', () => {
  const match = villeInput.value.match(/^(.+?)\s*\((\d{4,5})\)$/);
  if (match) {
    villeInput.value = match[1];
    cpInput.value = match[2];
  }
});
// ================================================================================
// mise en ecoute du champ code postal et mise a jour du champ ville
// ================================================================================
cpInput.addEventListener('change', () => {
  const match = cpInput.value.match(/^(\d{4,5})\s*-\s*(.+)$/);
  if (match) {
    cpInput.value = match[1];
    villeInput.value = match[2];
  }
});
// ================================================================================
// chargement du DOMContentLoaded et initialisation de la carte
// ================================================================================
window.addEventListener("DOMContentLoaded", () => {
  const agencySelect = document.getElementById('agency');
  const selectedOption = agencySelect.options[agencySelect.selectedIndex];
  const [lat, lng] = selectedOption.value.split(',').map(Number);
  centerAgence = [lat, lng];
  const selectedName = selectedOption.dataset.name;
  map.setView(centerAgence, 11);
  updateAgenceMarker(selectedName, centerAgence);
  zonesActives = false;
});
// ================================================================================
// mise en ecoute du bouton de réinitialisation
// ================================================================================
document.getElementById('resetBtn').addEventListener('click', () => {
  document.getElementById('villeInput').value = '';
  document.getElementById('cpInput').value = '';
  document.getElementById('adresseInput').value = '';
  document.getElementById('result-zone').innerHTML = '';
  document.getElementById('suggestions-ville').innerHTML = '';
  document.getElementById('suggestions-cp').innerHTML = '';
  // Supprimer le marqueur client s’il existe
  if (userMarker) {
    map.removeLayer(userMarker);
    userMarker = null;
  }
  // Supprimer toutes les zones de livraison affichées
  clearZones();
  // Réinitialiser les flags
  zonesActives = false;
  rayonAdresse = null;
  // Recentrer sur l’agence sélectionnée
  const agencySelect = document.getElementById('agency');
  const [lat, lng] = agencySelect.value.split(',').map(Number);
  map.setView([lat, lng], 11);
});
// ================================================================================
// mise en ecoute du bouton zones de livraison
// ================================================================================
document.getElementById('zoneBtn').addEventListener('click', () => {
  zonesActives = !zonesActives;
  if (zonesActives) {
    // 🔍 Recherche en cours → afficher uniquement la zone concernée
    if (rayonAdresse !== null) {
      drawZones(centerAgence, false);
    } else {
      // 🚫 Pas de recherche → affiche toutes les zones
      drawZones(centerAgence, true);
    }
  } else {
    clearZones();
  }
});
// ================================================================================
// mise en ecoute du bouton site web et ouverture du site
// ================================================================================
document.getElementById('websiteBtn').addEventListener('click', () => {
  window.open('https://www.baudry-sa.com', '_blank');
});
// ================================================================================
// mise en ecoute du bouton itinéraire et ouverture de Google Maps
// ================================================================================
document.getElementById('itineraireBtn').addEventListener('click', () => {
  if (userMarker && agenceMarker) {
    const { lat: lat1, lng: lng1 } = agenceMarker.getLatLng();
    const { lat: lat2, lng: lng2 } = userMarker.getLatLng();
    const url = `https://www.google.com/maps/dir/?api=1&origin=${lat1},${lng1}&destination=${lat2},${lng2}&travelmode=driving`;
    window.open(url, '_blank');
  } else {
    alert("Veuillez d’abord valider une adresse client.");
  }
});
// ================================================================================
// Gestion du panneau de zones
// Création de la modale pour configurer les zones de livraison
// ================================================================================
window.addEventListener('DOMContentLoaded', () => {
  const btnMenuPerso = document.getElementById('btnMenuPerso');
  const zoneModal = document.getElementById('zoneModal');
  const closeModal = document.getElementById('closeModal');
  const addZoneBtn = document.getElementById('addZone');
  const saveZonesBtn = document.getElementById('saveZones');
  const resetZonesBtn = document.getElementById('resetZones');
  const zoneInputsContainer = document.getElementById('zoneInputs');
  // Configuration zones
  let zonesConfig = [];
  function updateZoneCount() {
    const count = document.querySelectorAll('.zone-row').length;
    document.getElementById('zoneCount').textContent = count;
  }
  function addSingleZone(rmin = 0, rmax = 10000, color = '#cccccc') {
    const row = document.createElement('div');
    row.className = 'zone-row';
    row.innerHTML = `
      <label>Min <input type="number" class="rmin" value="${rmin}" min="0" step="1000"></label>
      <label>Max <input type="number" class="rmax" value="${rmax}" min="1000" step="1000"></label>
      <input type="color" class="color" value="${color}">
      <button class="removeZone">✖</button>
    `;
    row.querySelector('.removeZone').addEventListener('click', () => {
      row.remove();
      updateZoneCount();
    });
    zoneInputsContainer.appendChild(row);
    updateZoneCount();
  }
  function generateZoneInputs(zones = getDefaultZones()) {
    zoneInputsContainer.innerHTML = '';
    zones.forEach(z => addSingleZone(z.rmin, z.rmax, z.color));
  }
  btnMenuPerso.addEventListener('click', () => {
    const config = localStorage.getItem('zonesConfig');
    zonesConfig = config ? JSON.parse(config) : getDefaultZones();
    generateZoneInputs(zonesConfig);
    zoneModal.classList.remove('hidden');
  });
  closeModal.addEventListener('click', () => {
    zoneModal.classList.add('hidden');
  });
  addZoneBtn.addEventListener('click', () => {
    addSingleZone();
  });
  saveZonesBtn.addEventListener('click', () => {
    const rows = document.querySelectorAll('.zone-row');
    zonesConfig = [];
    rows.forEach(row => {
      const rmin = parseInt(row.querySelector('.rmin').value);
      const rmax = parseInt(row.querySelector('.rmax').value);
      const color = row.querySelector('.color').value;
      if (!isNaN(rmin) && !isNaN(rmax) && rmin < rmax) {
        zonesConfig.push({ rmin, rmax, color });
      }
    });
    localStorage.setItem('zonesConfig', JSON.stringify(zonesConfig));
    zoneModal.classList.add('hidden');
  });
  resetZonesBtn.addEventListener('click', () => {
    localStorage.removeItem('zonesConfig');
    zonesConfig = getDefaultZones();
    generateZoneInputs(zonesConfig);
  });
});