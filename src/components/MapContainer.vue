<template>
  <div class="map-container">
    <div ref="mapContainer" class="map-wrapper"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import L from 'leaflet'
import { useGlobalStore } from '../stores/globalStore'
import { apiService } from '../services/api'
import { getCoordenadas, saveCoordenadas } from '../services/indexedDB'

const store = useGlobalStore()
const mapContainer = ref(null)

let map = null
let routeLayer = null
let markersLayer = null
let railwayLayer = null

const props = defineProps({
  rota: {
    type: Object,
    default: null
  },
  railwayVisible: {
    type: Boolean,
    default: true
  }
})

// Removido emits - usando Pinia store

onMounted(async () => {
  await initMap()
  await carregarLinhasFerroviarias()
  store.setMapReady(true)
})

onUnmounted(() => {
  if (map) {
    map.remove()
  }
})

watch(() => props.railwayVisible, (visible) => {
  if (map && railwayLayer) {
    if (visible) {
      map.addLayer(railwayLayer)
    } else {
      map.removeLayer(railwayLayer)
    }
  }
})

watch(() => props.rota, (novaRota) => {
  if (novaRota) {
    exibirRota(novaRota)
  }
})

async function initMap() {
  map = L.map(mapContainer.value)
  
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map)
  
  // Bounds do Brasil todo
  const brasilBounds = [
    [-34.0, -74.0], // Sudoeste (lat, lon)
    [5.5, -28.0]    // Nordeste (lat, lon)
  ]
  
  map.fitBounds(brasilBounds, {
    padding: [20, 20],
    maxZoom: 5
  })
  
  map.zoomControl.setPosition('bottomright')
  
  adicionarLegendaMapa()
  
  routeLayer = L.layerGroup().addTo(map)
  markersLayer = L.layerGroup().addTo(map)
  railwayLayer = L.layerGroup().addTo(map)
}

function adicionarLegendaMapa() {
  const legend = L.control({ position: 'bottomleft' })
  
  legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'leaflet-control-legend')
    
    div.innerHTML = `
      <div class="legend-section">
        <div class="legend-title">
          Bitolas
          <button class="legend-help-btn" onclick="window.abrirModalBitola?.()" title="O que é uma bitola?">?</button>
        </div>
        <div class="legend-item">
          <div class="legend-line" style="background: #f59e0b;"></div>
          <span class="legend-text">Larga</span>
        </div>
        <div class="legend-item">
          <div class="legend-line" style="background: #3b82f6;"></div>
          <span class="legend-text">Métrica</span>
        </div>
        <div class="legend-item">
          <div class="legend-line" style="background: #10b981;"></div>
          <span class="legend-text">Standard</span>
        </div>
        <div class="legend-item">
          <div class="legend-line" style="background: #8b5cf6;"></div>
          <span class="legend-text">Mista</span>
        </div>
        <div class="legend-item">
          <div class="legend-line-thin" style="background: repeating-linear-gradient(to right, #6b7280 0px, #6b7280 3px, transparent 3px, transparent 6px);"></div>
          <span class="legend-text">Planejada</span>
        </div>
      </div>
    `
    
    return div
  }
  
  legend.addTo(map)
}

async function carregarLinhasFerroviarias() {
  try {
    const geojson = await apiService.getLinhasFerroviarias()
    
    L.geoJSON(geojson, {
      style: function (feature) {
        const bitola = feature.properties.bitola
        let color = store.BITOLA_COLORS[bitola] || '#6b7280'
        let weight = 2
        
        if (!store.BITOLA_COLORS[bitola]) {
          color = store.BITOLA_COLORS['Mista']
        }
        
        switch (bitola) {
          case 'Larga':
            weight = 3
            break
          case 'Metrica':
            weight = 2
            break
          case 'Standard':
          case 'Standart':
            weight = 2
            break
          default:
            weight = 2
            color = store.BITOLA_COLORS['Mista']
            break
        }
        
        return {
          color: color,
          weight: weight,
          opacity: 0.6,
          dashArray: feature.properties.tip_situac === 'Planejada' ? '5, 5' : null
        }
      },
      onEachFeature: function (feature, layer) {
        const props = feature.properties
        const popupContent = `
          <div style="font-size: 12px;">
            <strong>${props.nome || 'Ferrovia'}</strong><br>
            <strong>Bitola:</strong> ${props.bitola}<br>
            <strong>Situação:</strong> ${props.tip_situac}<br>
            <strong>Sigla:</strong> ${props.sigla || 'N/A'}<br>
            <strong>Município:</strong> ${props.municipio}<br>
            <strong>UF:</strong> ${props.uf}<br>
            <strong>Extensão:</strong> ${props.extensao ? props.extensao.toFixed(2) + ' km' : 'N/A'}
          </div>
        `
        layer.bindPopup(popupContent)
      }
    }).addTo(railwayLayer)
  } catch (error) {
    console.error('Erro ao carregar linhas ferroviárias:', error)
    store.setApiError(error)
  }
}

async function exibirRota(data) {
  const { rota, cidades, conexoes } = data
  
  routeLayer.clearLayers()
  markersLayer.clearLayers()
  
  // Restaurar estilo das ferrovias com opacidade reduzida
  railwayLayer.eachLayer(function (layer) {
    if (layer.feature) {
      const bitola = layer.feature.properties.bitola
      let color = store.BITOLA_COLORS[bitola] || '#6b7280'
      let weight = 2
      
      switch (bitola) {
        case 'Larga':
          weight = 3
          break
        case 'Metrica':
          weight = 2
          break
        case 'Standard':
        case 'Standart':
          weight = 2
          break
      }
      
      layer.setStyle({
        color: color,
        weight: weight,
        opacity: 0.3,
        dashArray: layer.feature.properties.tip_situac === 'Planejada' ? '5, 5' : null
      })
    }
  })
  
  // Adicionar marcadores das cidades
  cidades.forEach((cidade, index) => {
    const isFirst = index === 0
    const isLast = index === cidades.length - 1
    
    let iconColor = store.BITOLA_COLORS[rota.bitola_usada] || '#6b7280'
    if (isFirst) iconColor = '#ef4444'
    if (isLast) iconColor = '#10b981'
    
    const marker = L.circleMarker([cidade.latitude, cidade.longitude], {
      radius: isFirst || isLast ? 10 : 6,
      fillColor: iconColor,
      color: '#fff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(markersLayer)
    
    marker.bindPopup(`
      <strong>${cidade.nome}</strong><br>
      ${cidade.municipio} - ${cidade.uf}<br>
      ${isFirst ? 'Origem' : isLast ? 'Destino' : 'Parada'}
    `)
    
    marker.on('click', function () {
      map.setView([cidade.latitude, cidade.longitude], 12, {
        animate: true,
        duration: 1.0
      })
    })
  })
  
  // Adicionar linhas das conexões
  conexoes.forEach(conexao => {
    const polyline = L.polyline([
      [conexao.coordenadas_origem.latitude, conexao.coordenadas_origem.longitude],
      [conexao.coordenadas_destino.latitude, conexao.coordenadas_destino.longitude]
    ], {
      color: store.BITOLA_COLORS[rota.bitola_usada] || '#6b7280',
      weight: 5,
      opacity: 0.9
    }).addTo(routeLayer)
    
    polyline.bindPopup(`
      <strong>${conexao.origem}</strong> → <strong>${conexao.destino}</strong><br>
      Distância: ${conexao.distancia} km
    `)
  })
  
  // Ajustar zoom para mostrar toda a rota
  if (cidades.length > 0) {
    const group = new L.featureGroup(markersLayer.getLayers().concat(routeLayer.getLayers()))
    map.fitBounds(group.getBounds().pad(0.1), {
      maxZoom: 10
    })
  }
}

async function verTodasRotas(bitola) {
  try {
    routeLayer.clearLayers()
    markersLayer.clearLayers()
    
    const data = await apiService.getRotas(bitola)
    
    const cidadesUnicas = new Set()
    data.rotas.forEach(rota => {
      cidadesUnicas.add(rota.origem)
      cidadesUnicas.add(rota.destino)
    })
    
    const cidadesArray = Array.from(cidadesUnicas)
    
    for (const cidade of cidadesArray) {
      // Tentar obter do IndexedDB primeiro
      let coords = await getCoordenadas(cidade)
      
      if (!coords) {
        try {
          // Se não tiver no cache, buscar da API
          coords = await apiService.getCoordenadasCidade(cidade)
          if (coords) {
            // Salvar no IndexedDB
            await saveCoordenadas(cidade, coords)
          }
        } catch (error) {
          console.warn(`Erro ao obter coordenadas para ${cidade}:`, error)
          continue
        }
      }
      
      if (coords) {
        const marker = L.circleMarker([coords.latitude, coords.longitude], {
          radius: 3,
          fillColor: store.BITOLA_COLORS[bitola] || '#6b7280',
          color: '#fff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(markersLayer)
        
        marker.bindPopup(`<strong>${cidade}</strong><br>${coords.municipio} - ${coords.uf}`)
        
        marker.on('click', function () {
          map.setView([coords.latitude, coords.longitude], 12, {
            animate: true,
            duration: 1.0
          })
        })
      }
    }
    
    // Destacar linhas ferroviárias
    railwayLayer.eachLayer(function (layer) {
      if (layer.feature && layer.feature.properties.bitola === bitola) {
        layer.setStyle({
          color: store.BITOLA_COLORS[bitola] || store.BITOLA_COLORS['Mista'],
          weight: 4,
          opacity: 0.9
        })
        
        const props = layer.feature.properties
        layer.bindPopup(`
          <div style="font-size: 12px;">
            <strong>${props.nome || 'Ferrovia'}</strong><br>
            <strong>Bitola:</strong> ${props.bitola}<br>
            <strong>Situação:</strong> ${props.tip_situac}<br>
            <strong>Município:</strong> ${props.municipio} - ${props.uf}<br>
            <strong>Extensão:</strong> ${props.extensao ? props.extensao.toFixed(2) + ' km' : 'N/A'}
          </div>
        `)
      } else {
        layer.setStyle({
          opacity: 0.2
        })
      }
    })
    
    // Bounds do Brasil todo
    const brasilBounds = [
      [-34.0, -74.0], // Sudoeste (lat, lon)
      [5.5, -28.0]    // Nordeste (lat, lon)
    ]
    
    map.fitBounds(brasilBounds, {
      padding: [20, 20],
      maxZoom: 5
    })
  } catch (error) {
    console.error('Erro ao carregar todas as rotas:', error)
    store.setApiError(error)
  }
}

function limparMapa() {
  routeLayer.clearLayers()
  markersLayer.clearLayers()
  
  railwayLayer.eachLayer(function (layer) {
    if (layer.feature) {
      const bitola = layer.feature.properties.bitola
      let color = store.BITOLA_COLORS[bitola] || store.BITOLA_COLORS['Mista']
      let weight = 2
      
      switch (bitola) {
        case 'Larga':
          weight = 3
          break
        case 'Metrica':
          weight = 2
          break
        case 'Standard':
        case 'Standart':
          weight = 2
          break
        default:
          weight = 2
          color = store.BITOLA_COLORS['Mista']
          break
      }
      
      layer.setStyle({
        color: color,
        weight: weight,
        opacity: 1.0,
        dashArray: layer.feature.properties.tip_situac === 'Planejada' ? '5, 5' : null
      })
    }
  })
}

defineExpose({
  verTodasRotas,
  limparMapa,
  exibirRota
})
</script>

<style scoped>
.map-container {
  flex: 1;
  position: relative;
  background: #f8fafc;
}

.map-wrapper {
  height: 100%;
  width: 100%;
}
</style>

