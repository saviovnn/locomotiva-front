import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor para tratamento de erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || error.message.includes('Network Error')) {
      error.isConnectionError = true
    }
    return Promise.reject(error)
  }
)

export const apiService = {
  // Buscar rota
  async buscarRota(data) {
    const response = await api.post('/mapa-rota', data)
    return response.data
  },
  
  // Listar cidades por bitola
  async getCidades(bitola) {
    const response = await api.get(`/cidades/${bitola}`)
    return response.data.cidades
  },
  
  // Obter coordenadas de uma cidade
  async getCoordenadasCidade(cidade) {
    const response = await api.get(`/coordenadas-cidade/${encodeURIComponent(cidade)}`)
    return response.data
  },
  
  // Obter todas as rotas de uma bitola
  async getRotas(bitola) {
    const response = await api.get(`/rotas/${bitola}`)
    return response.data
  },
  
  // Obter linhas ferroviárias (GeoJSON)
  async getLinhasFerroviarias() {
    const response = await api.get('/dados/linhas_ferroviarias.geojson')
    return response.data
  }
}

export default api

