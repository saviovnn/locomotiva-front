<template>
  <div class="app-container">
    <Sidebar />
    
    <MapContainer
      ref="mapContainerRef"
      :rota="store.rotaAtual"
      :railway-visible="store.railwayVisible"
    />
    
    <!-- Toast -->
    <Toast
      v-if="toast.visible"
      :type="toast.type"
      :title="toast.title"
      :message="toast.message"
      :duration="toast.duration"
      @close="toast.visible = false"
    />
    
    <!-- Modal de Bitola -->
    <Modal
      v-model:visible="modalBitolaVisible"
      title="O que é uma Bitola Ferroviária?"
    >
      <p><strong>Bitola</strong> é a distância entre os trilhos de uma ferrovia, medida entre as faces internas dos trilhos.</p>
      
      <p><strong>Tipos de Bitola no Brasil:</strong></p>
      <p>• <strong>Larga (1,60m):</strong> Usada em ferrovias principais, permite trens maiores e mais pesados.</p>
      <p>• <strong>Métrica (1,00m):</strong> Padrão mais comum no Brasil, usada em ferrovias regionais.</p>
      <p>• <strong>Standart (1,435m):</strong> Padrão internacional, permite integração com outros países.</p>
      <p>• <strong>Mista:</strong> Ferrovias que operam com múltiplas bitolas.</p>
      
      <p>Diferentes bitolas requerem equipamentos específicos e podem limitar a integração entre redes ferroviárias.</p>
    </Modal>
    
    <!-- Modal de Erro da API -->
    <ModalError
      v-model:visible="modalErrorVisible"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useGlobalStore } from './stores/globalStore'
import { apiService } from './services/api'
import Sidebar from './components/Sidebar.vue'
import MapContainer from './components/MapContainer.vue'
import Toast from './components/Toast.vue'
import Modal from './components/Modal.vue'
import ModalError from './components/ModalError.vue'

const store = useGlobalStore()
const mapContainerRef = ref(null)

const toast = ref({
  visible: false,
  type: 'error',
  title: '',
  message: '',
  duration: 5000
})

const modalBitolaVisible = ref(false)
const modalErrorVisible = ref(false)

// Expor função para abrir modal de bitola globalmente
window.abrirModalBitola = () => {
  modalBitolaVisible.value = true
}

function mostrarToast(type, title, message, duration = 5000) {
  toast.value = {
    visible: true,
    type,
    title,
    message,
    duration
  }
}

// Watch para buscar rota
watch(() => store.buscarRotaTrigger, async () => {
  if (store.buscarRotaTrigger > 0) {
    await handleBuscarRota()
  }
})

// Watch para ver todas as rotas
watch(() => store.verTodasRotasTrigger, async (newValue) => {
  if (newValue.bitola && newValue.trigger > 0) {
    await handleVerTodasRotas(newValue.bitola)
  }
})

// Watch para limpar mapa
watch(() => store.limparMapaTrigger, () => {
  if (store.limparMapaTrigger > 0) {
    handleLimparMapa()
  }
})

// Watch para erros da API
watch(() => store.apiError, (error) => {
  if (error) {
    handleApiError(error)
    store.clearApiError()
  }
})

async function handleBuscarRota() {
  if (!store.origem || !store.destino) {
    mostrarToast('warning', 'Atenção', 'Por favor, preencha origem e destino')
    return
  }
  
  store.setLoading(true)
  
  try {
    const data = await apiService.buscarRota({
      origem: store.origem,
      destino: store.destino,
      bitola: store.bitola,
      algoritmo: store.algoritmo,
      profundidade: store.profundidade
    })
    
    if (data.sucesso) {
      store.setRotaAtual(data)
      
      if (mapContainerRef.value) {
        mapContainerRef.value.exibirRota(data)
      }
      
      mostrarToast('success', 'Rota Encontrada!', 'A rota foi calculada com sucesso.', 3000)
    } else {
      let titulo = 'Rota Não Encontrada'
      let mensagem = data.mensagem
      
      if (data.mensagem.toLowerCase().includes('profundidade') ||
          data.mensagem.toLowerCase().includes('depth') ||
          data.mensagem.toLowerCase().includes('limite')) {
        titulo = 'Profundidade Limitada'
        mensagem = `Não foi possível encontrar uma rota com a profundidade atual (${store.profundidade}). Tente aumentar o limite de profundidade para encontrar rotas mais longas.`
      }
      
      mostrarToast('warning', titulo, mensagem, 10000)
    }
  } catch (error) {
    console.error('Erro ao buscar rota:', error)
    
    if (error.isConnectionError || (error.message && error.message.includes('Network Error'))) {
      modalErrorVisible.value = true
    } else if (error.response) {
      mostrarToast('error', 'Erro HTTP', `Erro HTTP: ${error.response.status} - ${error.response.statusText}`, 6000)
    } else {
      mostrarToast('error', 'Erro', `Erro: ${error.message}`, 6000)
    }
  } finally {
    store.setLoading(false)
  }
}

async function handleVerTodasRotas(bitola) {
  try {
    if (mapContainerRef.value) {
      await mapContainerRef.value.verTodasRotas(bitola)
    }
  } catch (error) {
    console.error('Erro ao ver todas as rotas:', error)
    store.setApiError(error)
  }
}

function handleLimparMapa() {
  if (mapContainerRef.value) {
    mapContainerRef.value.limparMapa()
  }
}

function handleApiError(error) {
  if (error.isConnectionError || (error.message && error.message.includes('Network Error'))) {
    if (!modalErrorVisible.value) {
      modalErrorVisible.value = true
    }
  } else {
    mostrarToast('error', 'Erro de API', error.message || 'Erro desconhecido', 6000)
  }
}

onMounted(() => {
  // Inicialização adicional se necessário
})
</script>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}
</style>

