<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, Compass, Heart, MapPin, MessageCircle, Search, SlidersHorizontal, Sparkles, Star, Utensils, Wallet, X } from "@lucide/vue";

const items = ref([]);
const busy = ref(false);
const error = ref("");
const query = ref("");
const interpretedQuery = ref(false);
const cuisine = ref("");
const budget = ref(60);
const mode = ref("demo");
const aiUsed = ref(false);
const aiFallback = ref(false);
const place = ref(null);
const placeLabel = ref("São José dos Campos, SP");
const activeCuisine = ref("Todos");
const favorites = ref(new Set());
const favoriteItems = ref(new Map());
const filtersOpen = ref(false);
const detail = ref(null);
const sortBy = ref("recommended");
const favoritesOnly = ref(false);
const cuisines = ["Todos", "Japonesa", "Italiana", "Brasileira", "Árabe", "Hambúrguer", "Havaiana", "Vegetariana"];
const title = computed(() => favoritesOnly.value ? "Seus lugares salvos" : items.value.length + (items.value.length === 1 ? " lugar que combina com você" : " lugares que combinam com você"));
const sorted = computed(() => {
  const list = favoritesOnly.value ? [...favoriteItems.value.values()] : [...items.value];
  if (sortBy.value === "price") return list.sort((a, b) => a.price_per_person - b.price_per_person);
  if (sortBy.value === "rating") return list.sort((a, b) => b.rating - a.rating);
  if (place.value) return list.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  return list.sort((a, b) => b.rating - a.rating);
});
const money = (value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const foodIcon = (kind) => ({ Japonesa: "🍣", Italiana: "🍝", Brasileira: "🍛", "Árabe": "🥙", "Hambúrguer": "🍔", Havaiana: "🥗", Vegetariana: "🥗" })[kind] || "🍽️";

async function loadMeta() {
  try {
    const response = await fetch("/api/meta");
    const data = await response.json();
    mode.value = data.dataMode;
  } catch {}
}

async function search(options = {}) {
  busy.value = true;
  error.value = "";
  aiUsed.value = false;
  aiFallback.value = false;
  try {
    const params = new URLSearchParams();
    const kind = options.cuisine ?? (cuisine.value || (activeCuisine.value !== "Todos" ? activeCuisine.value : ""));
    const max = options.maxBudget ?? Number(budget.value);
    if (kind) params.set("cuisine", kind);
    if (max) params.set("maxBudget", String(max));
    if (query.value.trim() && !interpretedQuery.value) params.set("q", query.value.trim());
    if (place.value) {
      params.set("lat", String(place.value.lat));
      params.set("lng", String(place.value.lng));
      params.set("radiusKm", "15");
    }
    const response = await fetch("/api/restaurants?" + params.toString());
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível buscar lugares.");
    items.value = data.items;
    mode.value = data.dataMode;
  } catch (err) { error.value = err.message; }
  finally { busy.value = false; }
}

async function askAi() {
  if (!query.value.trim()) return search();
  busy.value = true;
  error.value = "";
  try {
    const response = await fetch("/api/recommend", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: query.value, maxBudget: Number(budget.value), ...(place.value ? { lat: place.value.lat, lng: place.value.lng, radiusKm: 15 } : {}) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não consegui interpretar seu pedido.");
    items.value = data.items;
    mode.value = data.dataMode;
    aiUsed.value = data.filters.aiEnabled;
    aiFallback.value = !data.filters.aiEnabled;
    interpretedQuery.value = true;
    if (data.filters.cuisine) { cuisine.value = data.filters.cuisine; activeCuisine.value = data.filters.cuisine; }
    if (data.filters.maxBudget) budget.value = data.filters.maxBudget;
  } catch (err) { error.value = err.message; }
  finally { busy.value = false; }
}

function setCuisine(value) {
  activeCuisine.value = value;
  cuisine.value = value === "Todos" ? "" : value;
  search();
}

function toggleFavorite(item) {
  const next = new Set(favorites.value);
  const saved = new Map(favoriteItems.value);
  if (next.has(item.id)) { next.delete(item.id); saved.delete(item.id); }
  else { next.add(item.id); saved.set(item.id, item); }
  favorites.value = next;
  favoriteItems.value = saved;
}

function findLocation() {
  if (!navigator.geolocation) { error.value = "Seu navegador não disponibilizou a localização."; return; }
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    place.value = { lat: coords.latitude, lng: coords.longitude };
    placeLabel.value = "Perto de você";
    search();
  }, () => { error.value = "Não consegui acessar sua localização. Confira a permissão do navegador."; }, { timeout: 8000 });
}

function mapsUrl(item) {
  if (item.lat == null || item.lng == null) return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(item.address || item.name);
  return "https://www.google.com/maps/search/?api=1&query=" + item.lat + "," + item.lng;
}

function quickSearch(text) { query.value = text; interpretedQuery.value = false; aiFallback.value = false; askAi(); }
function goTop() { window.scrollTo({ top: 0, behavior: "smooth" }); }
watch(favoriteItems, (next) => {
  try { localStorage.setItem("onde-vamos-favoritos", JSON.stringify([...next.values()])); } catch {}
});
onMounted(async () => {
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem("onde-vamos-favoritos") || "[]"); } catch {}
  await loadMeta();
  await search({ cuisine: "", maxBudget: 60 });
  const saved = new Map(stored.filter((item) => item && typeof item === "object" && item.id).map((item) => [item.id, item]));
  const oldIds = new Set(stored.filter((item) => typeof item === "string"));
  for (const item of items.value) if (oldIds.has(item.id)) saved.set(item.id, item);
  favoriteItems.value = saved;
  favorites.value = new Set(saved.keys());
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#"><span class="brand-mark"><Utensils :size="18" /></span><span>onde<span class="brand-dot">.</span>vamos?</span></a>
      <div class="top-location"><MapPin :size="16" /><span>{{ placeLabel }}</span><button @click="findLocation">Alterar</button></div>
      <button class="saved-button" :class="{ 'saved-active': favoritesOnly }" @click="favoritesOnly = !favoritesOnly"><Heart :size="17" /><span>{{ favoritesOnly ? "Ver todos" : "Salvos" }}</span><b v-if="favorites.size">{{ favorites.size }}</b></button>
    </header>
    <main>
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow"><i></i> SAIA PRA COMER BEM</div>
          <h1>Seu próximo<br />prato favorito,<br /><em>sem estourar o bolso.</em></h1>
          <p>Conta pra gente o que deu vontade. A gente encontra um lugar que cabe no seu dia e no seu orçamento.</p>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="art-sun"></div><div class="plate"><div>🍜</div></div>
          <div class="art-note note-back"><span>R$</span><strong>bom e barato</strong><small>achado do dia</small></div>
          <div class="art-note note-front"><span>★★★★★</span><strong>Na medida certa</strong><small>comida boa, preço justo</small></div>
          <b class="sparkle">✳</b><b class="sparkle second">✳</b>
        </div>
      </section>

      <section class="search-panel">
        <div class="search-heading"><span class="spark-icon"><Sparkles :size="17" /></span><div><strong>O que você está a fim de comer?</strong><small>Escreva do seu jeito ou escolha os filtros</small></div></div>
        <form class="search-row" @submit.prevent="askAi">
          <Search :size="19" class="search-symbol" /><input v-model="query" @input="interpretedQuery = false; aiFallback = false; aiUsed = false" placeholder="Ex.: comida japonesa até R$ 50 por pessoa" aria-label="Descreva o que procura" />
          <button type="button" class="filter-button" @click="filtersOpen = !filtersOpen"><SlidersHorizontal :size="16" /><span>Filtros</span></button>
          <button type="submit" class="submit-button" :disabled="busy"><Sparkles :size="16" />{{ busy ? "Buscando..." : "Encontrar" }}<ArrowRight :size="15" /></button>
        </form>
        <div v-if="filtersOpen" class="filter-box">
          <label><span><Wallet :size="15" /> Até quanto por pessoa?</span><div class="money-input"><b>R$</b><input v-model.number="budget" type="number" min="10" max="500" step="5" /><small>/ pessoa</small></div></label>
          <label><span><Utensils :size="15" /> Tipo de comida</span><select v-model="cuisine"><option value="">Qualquer tipo</option><option v-for="c in cuisines.slice(1)" :key="c">{{ c }}</option></select></label>
          <button class="apply-button" @click="activeCuisine = cuisine || 'Todos'; search()">Aplicar filtros <ArrowRight :size="15" /></button>
        </div>
        <div class="popular"><span>Popular agora</span><button @click="quickSearch('japonesa até R$ 60 por pessoa')">Japa até R$ 60</button><button @click="quickSearch('almoço brasileiro até R$ 35')">Almoço barato</button><button @click="quickSearch('comida vegetariana até R$ 45')">Vegetariano</button></div>
      </section>

      <section class="results">
        <div class="results-head"><div><div class="kicker">SELECIONADOS PRA VOCÊ</div><h2>{{ title }}</h2></div>
          <label class="sort"><span>Ordenar por</span><select v-model="sortBy"><option value="recommended">Recomendados</option><option value="price">Menor preço</option><option value="rating">Melhor avaliação</option></select><ChevronDown :size="13" /></label>
        </div>
        <div class="tabs"><button v-for="c in cuisines" :key="c" :class="{ active: activeCuisine === c }" @click="setCuisine(c)">{{ c }}</button></div>
        <div v-if="error" class="error"><span>{{ error }}</span><button @click="error = ''"><X :size="15" /></button></div>
        <div v-if="mode === 'demo'" class="demo-label"><i></i> Demonstração com restaurantes e preços fictícios. Confirme os dados antes de sair.</div>
        <div v-if="query && aiUsed" class="ai-hint"><Sparkles :size="15" /> Entendi seu pedido e encontrei opções com esses filtros.</div>
        <div v-else-if="query && aiFallback" class="ai-hint fallback"><Sparkles :size="15" /> A IA avançada não ficou disponível nesta busca. Use os filtros ou tente novamente.</div>
        <div v-if="busy" class="cards"><div v-for="n in 3" :key="n" class="skeleton"></div></div>
        <div v-else-if="sorted.length" class="cards">
          <article v-for="(item,index) in sorted" :key="item.id" class="card">
            <div class="photo" :class="'photo-'+(index%6)">
              <img v-if="item.image_url" :src="item.image_url" :alt="'Prato de '+item.name" loading="lazy" />
              <div v-else class="food">{{ foodIcon(item.cuisine) }}</div>
              <span v-if="index===0" class="match"><Sparkles :size="12" /> Combina com você</span>
              <button class="heart" :aria-label="favorites.has(item.id)?'Remover dos salvos':'Salvar restaurante'" @click="toggleFavorite(item)"><Heart :size="18" :fill="favorites.has(item.id)?'currentColor':'none'" /></button>
              <b class="price">{{ money(item.price_per_person) }} <small>/ pessoa</small></b>
            </div>
            <div class="card-content">
              <div class="card-title"><div><span class="cuisine">{{ item.cuisine }}</span><h3>{{ item.name }}</h3></div><span class="rating"><Star :size="14" fill="currentColor" /> {{ Number(item.rating).toFixed(1) }}</span></div>
              <p class="description">{{ item.description }}</p>
              <div class="meta"><span><MapPin :size="13" /> {{ item.distance_km != null ? Number(item.distance_km).toFixed(1)+' km' : item.city || 'São José dos Campos' }}</span><span><Clock3 :size="13" /> {{ item.rating_count || 0 }} avaliações</span></div>
              <div class="card-bottom"><span><Check :size="13" /> Cabe no seu orçamento</span><button @click="detail=item">Ver detalhes <ArrowUpRight :size="14" /></button></div>
            </div>
          </article>
        </div>
        <div v-else-if="!busy" class="empty"><span>{{ favoritesOnly ? "♡" : "🍽️" }}</span><h3>{{ favoritesOnly ? "Você ainda não salvou nenhum lugar" : "Nenhum lugar encontrado com esses filtros" }}</h3><p>{{ favoritesOnly ? "Toque no coração de um restaurante para guardá-lo aqui." : "Tente aumentar o orçamento ou escolher outra culinária." }}</p><button v-if="!favoritesOnly" @click="budget=100;cuisine='';activeCuisine='Todos';query='';search()">Limpar filtros</button><button v-else @click="favoritesOnly=false">Voltar aos restaurantes</button></div>
      </section>

      <section class="how">
        <div class="how-copy"><div class="kicker">A CONTA FECHA</div><h2>Comer bem não<br />precisa ser caro.</h2><p>A gente cruza o que você quer comer com o que cabe no bolso. Sem rolar listas que não têm nada a ver com você.</p><button @click="goTop">Encontrar meu próximo lugar <ArrowRight :size="15" /></button></div>
        <div class="steps">
          <div><span>01</span><i><MessageCircle :size="19" /></i><section><strong>Conta o que deu vontade</strong><p>Digite um prato, culinária ou descreva seu rolê.</p></section></div>
          <div><span>02</span><i><Wallet :size="19" /></i><section><strong>Escolhe seu limite</strong><p>Defina quanto quer gastar por pessoa.</p></section></div>
          <div><span>03</span><i><Compass :size="19" /></i><section><strong>Descubra seu próximo lugar</strong><p>Veja opções perto e compare antes de sair.</p></section></div>
        </div>
      </section>
    </main>
    <footer><a class="brand" href="#"><span class="brand-mark"><Utensils :size="15" /></span><span>onde<span class="brand-dot">.</span>vamos?</span></a><span>Feito pra sair da dúvida e ir direto pra mesa.</span><small>Projeto demonstrativo · Dados ilustrativos</small></footer>
    <div v-if="detail" class="backdrop" @click.self="detail=null">
      <section class="modal" role="dialog" aria-modal="true">
        <button class="close" aria-label="Fechar" @click="detail=null"><X :size="18" /></button><div class="modal-art">🍽️</div>
        <span class="cuisine">{{ detail.cuisine }}</span><h2>{{ detail.name }}</h2><p>{{ detail.description }}</p>
        <div class="modal-line"><Wallet :size="16" /><b>{{ money(detail.price_per_person) }}</b><span>estimativa por pessoa</span></div>
        <div class="modal-line"><MapPin :size="16" />{{ detail.address || detail.city }}</div>
        <div class="tag-list"><span v-for="tag in detail.tags" :key="tag">{{ tag }}</span></div>
        <p class="disclaimer">Preço e disponibilidade podem mudar. Confirme com o restaurante antes de ir.</p>
        <a class="map-link" :href="mapsUrl(detail)" target="_blank" rel="noreferrer">Ver no mapa <ArrowUpRight :size="15" /></a>
      </section>
    </div>
  </div>
</template>
