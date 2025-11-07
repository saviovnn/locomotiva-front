<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h1>
        <img :src="trainIconPath" alt="" class="title-icon">
        Rotas Ferroviárias - Brasil
      </h1>
      <p>Encontre a melhor rota entre as extensões ferroviárias do Brasil</p>
    </div>
    
    <div class="sidebar-content">
      <!-- Busca de Rota -->
      <div class="form-group">
        <label for="origem">Cidade de Origem</label>
        <select id="origem" v-model="store.origem" :disabled="loadingCidades">
          <option value="">Selecione uma cidade...</option>
          <option v-for="cidade in cidades" :key="cidade" :value="cidade">
            {{ cidade }}
          </option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="destino">Cidade de Destino</label>
        <select id="destino" v-model="store.destino" :disabled="loadingCidades">
          <option value="">Selecione uma cidade...</option>
          <option v-for="cidade in cidades" :key="cidade" :value="cidade">
            {{ cidade }}
          </option>
        </select>
      </div>
      
      <div class="controls-grid">
        <div class="form-group">
          <label for="bitola">Bitola</label>
          <select id="bitola" v-model="store.bitola" @change="handleBitolaChange">
            <option value="Larga">Larga</option>
            <option value="Metrica">Métrica</option>
            <option value="Standart">Standart</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="algoritmo">Algoritmo</label>
          <select id="algoritmo" v-model="store.algoritmo" @change="handleAlgoritmoChange">
            <option v-for="alg in store.ALGORITMOS" :key="alg.value" :value="alg.value">
              {{ alg.label }}
            </option>
          </select>
        </div>
      </div>
      
      <!-- Input para profundidade -->
      <div v-if="store.precisaProfundidade" class="form-group">
        <label for="profundidade">Profundidade Máxima</label>
        <input
          type="number"
          id="profundidade"
          v-model.number="store.profundidade"
          placeholder="Ex: 20"
          min="1"
          max="100"
        >
      </div>
      
      <div class="form-group">
        <Button
          variant="success"
          size="large"
          :loading="store.loading"
          :disabled="!store.origem || !store.destino"
          @click="buscarRota"
          class="full"
        >
          Buscar Rota
        </Button>
      </div>
      
      <!-- Ver Todas as Estações por bitola -->
      <div class="form-group">
        <label>Ver Todas as Estações</label>
        <div class="button-group">
          <Button variant="info" size="small" @click="verTodasRotas('Larga')">
            Larga
          </Button>
          <Button variant="info" size="small" @click="verTodasRotas('Metrica')">
            Métrica
          </Button>
          <Button variant="info" size="small" @click="verTodasRotas('Standart')">
            Standart
          </Button>
        </div>
      </div>
      
      <!-- Controles do Mapa -->
      <div class="form-group">
        <label>Controles do Mapa</label>
        <div class="button-group">
          <Button
            :variant="store.railwayVisible ? 'success' : 'secondary'"
            size="small"
            @click="toggleRailways"
          >
            {{ store.railwayVisible ? 'Ocultar' : 'Mostrar' }} Ferrovias
          </Button>
          <Button variant="danger" size="small" @click="limparMapa">
            Limpar Mapa
          </Button>
        </div>
      </div>
      
      <!-- Resultados da Busca -->
      <div v-if="rotaResultado" class="form-group search-results">
        <label>Resultados da Busca</label>
        <div class="search-results-content">
          <div class="route-info-grid">
            <div class="info-card">
              <div class="info-label">Distância</div>
              <div class="info-value">{{ rotaResultado.distancia_total }} km</div>
            </div>
            <div class="info-card">
              <div class="info-label">Paradas</div>
              <div class="info-value">{{ rotaResultado.numero_paradas }}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Algoritmo</div>
              <div class="info-value-small">{{ rotaResultado.algoritmo_usado }}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Bitola</div>
              <div class="info-value-small">{{ rotaResultado.bitola_usada }}</div>
            </div>
          </div>
          <div class="cities-list">
            <h4>Cidades da Rota</h4>
            <div class="cities-scroll">
              <div
                v-for="(cidade, index) in rotaResultado.caminho"
                :key="index"
                class="city-item"
              >
                <div
                  :class="['city-number', {
                    'city-origin': index === 0,
                    'city-destination': index === rotaResultado.caminho.length - 1,
                    'city-stop': index > 0 && index < rotaResultado.caminho.length - 1
                  }]"
                >
                  {{ index + 1 }}
                </div>
                <span>{{ cidade }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useGlobalStore } from '../stores/globalStore'
import { apiService } from '../services/api'
import { getCidades, saveCidades } from '../services/indexedDB'
import Button from './Button.vue'

const store = useGlobalStore()
const cidades = ref([])
const loadingCidades = ref(false)
const rotaResultado = computed(() => store.rotaAtual)
const trainIconPath = `${import.meta.env.BASE_URL}train.png`

async function carregarCidades() {
  loadingCidades.value = true
  try {
    // Tentar obter do IndexedDB primeiro
    const cached = await getCidades(store.bitola)
    if (cached) {
      cidades.value = cached
    } else {
      // Se não tiver no cache, buscar da API
      const data = await apiService.getCidades(store.bitola)
      cidades.value = data
      // Salvar no IndexedDB
      await saveCidades(store.bitola, data)
    }
  } catch (error) {
    console.error('Erro ao carregar cidades:', error)
    store.setApiError(error)
  } finally {
    loadingCidades.value = false
  }
}

async function handleBitolaChange() {
  await carregarCidades()
  store.setOrigem('')
  store.setDestino('')
}

function handleAlgoritmoChange() {
  // Apenas atualizar o algoritmo, a profundidade já está sendo gerenciada
}

function buscarRota() {
  store.triggerBuscarRota()
}

function verTodasRotas(bitola) {
  store.triggerVerTodasRotas(bitola)
}

function toggleRailways() {
  store.toggleRailwayVisible()
}

function limparMapa() {
  store.clearRota()
  store.triggerLimparMapa()
}

watch(() => store.bitola, () => {
  carregarCidades()
})

onMounted(async () => {
  await carregarCidades()
})
</script>

<style scoped>
.sidebar {
  width: 320px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.sidebar-header h1 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.sidebar-header p {
  font-size: 14px;
  color: #64748b;
}

.sidebar-content {
  padding: 20px;
  flex: 1;
}

.form-group {
  margin-bottom: 16px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #374151;
  font-size: 14px;
}

select,
input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  transition: border-color 0.2s;
}

select:focus,
input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

select:disabled,
input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.controls-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.button-group .btn {
  flex: 1;
  min-width: 0;
}

.search-results {
  margin-top: 20px;
}

.search-results-content {
  background: #f8fafc;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  max-height: 300px;
  overflow-y: auto;
}

.route-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.info-card {
  background: white;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.info-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
}

.info-value {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.info-value-small {
  font-size: 12px;
  font-weight: 500;
  color: #1e293b;
}

.cities-list h4 {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 14px;
}

.cities-scroll {
  max-height: 200px;
  overflow-y: auto;
}

.city-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  margin-bottom: 4px;
  background: white;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  font-size: 12px;
}

.city-number {
  width: 20px;
  height: 20px;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  margin-right: 8px;
}

.city-origin {
  background: #10b981;
}

.city-destination {
  background: #ef4444;
}

.city-stop {
  background: #3b82f6;
}
</style>

