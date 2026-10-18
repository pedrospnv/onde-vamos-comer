<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, Compass, Heart, MapPin, MessageCircle, Search, SlidersHorizontal, Star, Utensils, Wallet, X } from "@lucide/vue";

const items = ref([]);
const busy = ref(false);
const hasMore = ref(false);
const error = ref("");
const query = ref("");
const interpretedQuery = ref(false);
const cuisine = ref("");
const budget = ref(60);
const mode = ref("not_configured");
const place = ref({ lat: -23.5505, lng: -46.6333, radiusKm: 45 });
const placeLabel = ref("São Paulo, SP");
const activeCuisine = ref("Todos");
const favorites = ref(new Set());
const favoriteItems = ref(new Map());
const filtersOpen = ref(false);
const detail = ref(null);
const sortBy = ref("recommended");
const favoritesOnly = ref(false);
const pageFilters = ref({ cuisine: "", maxBudget: 60, q: "" });
const pageSize = 50;
const cuisines = ["Todos", "Japonesa", "Italiana", "Brasileira", "Árabe", "Hambúrguer", "Vegetariana", "Chinesa", "Mexicana", "Indiana", "Mediterrânea", "Cafeteria", "Bar", "Não informada"];
const cuisineImages = [
  ["japonesa|sushi|ramen|izakaya|teppanyaki|sashimi", "japonesa"],
  ["italiana|pizza|pasta|pizzeria", "italiana"],
  ["brasileira|brasil|churrasco|mineira|baiana|feijoada", "brasileira"],
  ["arabe|libanesa|siria|middle eastern|falafel|shawarma|mediterranea|grega|turca", "arabe"],
  ["hamburguer|burger", "hamburguer"],
  ["vegetariana|vegana|vegan|vegetarian", "vegetariana"],
  ["chinesa|chinese", "chinesa"],
  ["mexicana|taco|burrito", "mexicana"],
  ["indiana|curry", "indiana"],
  ["cafeteria|cafe|coffee|cha", "cafeteria"]
];
function cuisineImage(cuisine) {
  const normalized = String(cuisine || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const match = cuisineImages.find(([terms]) => new RegExp(`(?:^|\\b)(?:${terms})(?:\\b|$)`, "i").test(normalized));
  return `/images/${match?.[1] || "generica"}.webp`;
}
const title = computed(() => favoritesOnly.value ? "Seus lugares salvos" : items.value.length + (items.value.length === 1 ? " lugar encontrado" : " lugares encontrados"));
const hasKnownPrice = computed(() => (favoritesOnly.value ? [...favoriteItems.value.values()] : items.value).some((item) => item.price_per_person != null));
const hasKnownRating = computed(() => (favoritesOnly.value ? [...favoriteItems.value.values()] : items.value).some((item) => item.rating != null));
const sorted = computed(() => {
  const list = favoritesOnly.value ? [...favoriteItems.value.values()] : [...items.value];
  if (sortBy.value === "price") return list.sort((a, b) => (a.price_per_person ?? Infinity) - (b.price_per_person ?? Infinity));
  if (sortBy.value === "rating") return list.sort((a, b) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity));
  if (place.value) return list.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  return list.sort((a, b) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity));
});
const money = (value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
async function loadMeta() {
  try {
    const response = await fetch("/api/meta");
    const data = await response.json();
    mode.value = data.dataMode;
  } catch {}
}

async function search(options = {}) {
  const append = Boolean(options.append);
  busy.value = true;
  error.value = "";
  if (!append) {
    hasMore.value = false;
  }
  try {
    const params = new URLSearchParams();
    const kind = options.cuisine ?? (cuisine.value || (activeCuisine.value !== "Todos" ? activeCuisine.value : ""));
    const max = options.maxBudget ?? Number(budget.value);
    const searchText = options.q ?? (query.value.trim() && !interpretedQuery.value ? query.value.trim() : "");
    if (kind) params.set("cuisine", kind);
    if (max) params.set("maxBudget", String(max));
    if (searchText) params.set("q", searchText);
    params.set("limit", String(pageSize));
    params.set("offset", String(append ? items.value.length : 0));
    if (place.value) {
      params.set("lat", String(place.value.lat));
      params.set("lng", String(place.value.lng));
      params.set("radiusKm", String(place.value.radiusKm || 45));
    }
    const response = await fetch("/api/restaurants?" + params.toString());
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível buscar lugares.");
    items.value = append ? [...items.value, ...data.items] : data.items;
    hasMore.value = data.items.length === pageSize;
    if (!append) pageFilters.value = { cuisine: kind, maxBudget: max, q: searchText };
    mode.value = data.dataMode;
  } catch (err) { error.value = err.message; }
  finally { busy.value = false; }
}

async function searchByDescription() {
  if (!query.value.trim()) return search();
  busy.value = true;
  error.value = "";
  hasMore.value = false;
  try {
    const response = await fetch("/api/recommend", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: query.value, maxBudget: Number(budget.value), ...(place.value ? { lat: place.value.lat, lng: place.value.lng, radiusKm: place.value.radiusKm || 45 } : {}) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não consegui interpretar seu pedido.");
    items.value = data.items;
    mode.value = data.dataMode;
    interpretedQuery.value = true;
    cuisine.value = data.filters.cuisine || "";
    activeCuisine.value = data.filters.cuisine || "Todos";
    if (data.filters.maxBudget != null) budget.value = data.filters.maxBudget;
    pageFilters.value = {
      cuisine: data.filters.cuisine || "",
      maxBudget: data.filters.maxBudget ?? Number(budget.value),
      q: data.filters.searchText || ""
    };
    hasMore.value = data.items.length === pageSize;
  } catch (err) { error.value = err.message; }
  finally { busy.value = false; }
}

function setCuisine(value) {
  query.value = "";
  interpretedQuery.value = false;
  activeCuisine.value = value;
  cuisine.value = value === "Todos" ? "" : value;
  search();
}

function loadMore() { search({ ...pageFilters.value, append: true }); }

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
    place.value = { lat: coords.latitude, lng: coords.longitude, radiusKm: 15 };
    placeLabel.value = "Perto de você";
    search();
  }, () => { error.value = "Não consegui acessar sua localização. Confira a permissão do navegador."; }, { timeout: 8000 });
}

function mapsUrl(item) {
  if (item.lat == null || item.lng == null) return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(item.address || item.name);
  return "https://www.google.com/maps/search/?api=1&query=" + item.lat + "," + item.lng;
}

function quickSearch(text) { query.value = text; interpretedQuery.value = false; searchByDescription(); }
function goTop() { window.scrollTo({ top: 0, behavior: "smooth" }); }
watch(favoriteItems, (next) => {
  try { localStorage.setItem("onde-vamos-favoritos", JSON.stringify([...next.values()])); } catch {}
});
onMounted(async () => {
  let stored = [];
  try {
    const parsed = JSON.parse(localStorage.getItem("onde-vamos-favoritos") || "[]");
    if (Array.isArray(parsed)) stored = parsed;
  } catch {}
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
      <div class="top-location"><MapPin :size="16" /><span>{{ placeLabel }}</span><button aria-label="Usar minha localização atual" @click="findLocation">Alterar</button></div>
      <button class="saved-button" :class="{ 'saved-active': favoritesOnly }" :aria-pressed="favoritesOnly" @click="favoritesOnly = !favoritesOnly"><Heart :size="17" /><span>{{ favoritesOnly ? "Ver todos" : "Salvos" }}</span><b v-if="favorites.size">{{ favorites.size }}</b></button>
    </header>
    <main>
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow"><MapPin :size="14" /> UM GUIA LOCAL DE SÃO PAULO</div>
          <h1>Boa comida.<br /><em>Boa escolha.</em></h1>
          <p>Descubra lugares para comer por culinária, distância e orçamento. Informações ausentes ficam claras, sem preço ou avaliação inventados.</p>
        </div>
        <div class="hero-food">
          <img src="/images/japonesa.webp" alt="Sushi e sashimi, imagem ilustrativa de culinária japonesa" fetchpriority="high" />
          <span class="hero-food-note">Imagem ilustrativa</span>
          <div class="hero-food-caption"><small>Um sabor da cidade</small><strong>Culinária japonesa</strong></div>
        </div>
      </section>

      <section class="search-panel">
        <div class="search-heading"><span class="search-heading-icon"><Search :size="17" /></span><div><strong>O que você quer comer?</strong><small>Busque por prato, culinária ou bairro</small></div></div>
        <form class="search-row" @submit.prevent="searchByDescription">
          <Search :size="19" class="search-symbol" /><input v-model="query" @input="interpretedQuery = false" placeholder="Ex.: japonês em Pinheiros até R$ 50" aria-label="Descreva o que procura" />
          <button type="button" class="filter-button" :aria-expanded="filtersOpen" aria-controls="search-filters" @click="filtersOpen = !filtersOpen"><SlidersHorizontal :size="16" /><span>Filtros</span></button>
          <button type="submit" class="submit-button" :disabled="busy"><Search :size="16" />{{ busy ? "Buscando..." : "Encontrar" }}<ArrowRight :size="15" /></button>
        </form>
        <div v-if="filtersOpen" id="search-filters" class="filter-box">
          <label><span><Wallet :size="15" /> Até quanto por pessoa?</span><div class="money-input"><b>R$</b><input v-model.number="budget" type="number" min="10" max="500" step="5" /><small>/ pessoa</small></div></label>
          <label><span><Utensils :size="15" /> Tipo de comida</span><select v-model="cuisine"><option value="">Qualquer tipo</option><option v-for="c in cuisines.slice(1)" :key="c">{{ c }}</option></select></label>
          <button class="apply-button" @click="activeCuisine = cuisine || 'Todos'; search()">Aplicar filtros <ArrowRight :size="15" /></button>
        </div>
        <div class="popular"><span>Popular agora</span><button @click="quickSearch('japonesa até R$ 60 por pessoa')">Japa até R$ 60</button><button @click="quickSearch('almoço brasileiro até R$ 35')">Almoço barato</button><button @click="quickSearch('comida vegetariana até R$ 45')">Vegetariano</button></div>
      </section>

      <section class="results" :aria-busy="busy">
        <div class="results-head"><div><div class="kicker">LUGARES PERTO E PELO SEU ESTILO</div><h2>{{ title }}</h2></div>
          <label class="sort"><span>Ordenar por</span><select v-model="sortBy"><option value="recommended">Recomendados</option><option value="price" :disabled="!hasKnownPrice">Menor preço{{ hasKnownPrice ? "" : " (indisponível)" }}</option><option value="rating" :disabled="!hasKnownRating">Melhor avaliação{{ hasKnownRating ? "" : " (indisponível)" }}</option></select><ChevronDown :size="13" /></label>
        </div>
        <div class="tabs"><button v-for="c in cuisines" :key="c" :class="{ active: activeCuisine === c }" @click="setCuisine(c)">{{ c }}</button></div>
        <div v-if="error" class="error" role="status" aria-live="polite"><span>{{ error }}</span><button aria-label="Fechar aviso" @click="error = ''"><X :size="15" /></button></div>
        <div v-if="mode === 'openstreetmap'" class="demo-label"><i></i> Locais do OpenStreetMap. Preço e avaliação não informados ficam sinalizados, sem estimativas inventadas. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></div>
        <div v-else-if="mode === 'not_configured'" class="demo-label"><i></i> A base de restaurantes reais ainda não foi conectada. Configure o Supabase e importe os locais de São Paulo.</div>
        <div v-if="query && interpretedQuery && !error" class="search-hint"><Check :size="15" /> Busca aplicada com base no que você descreveu.</div>
        <div v-if="items.some(item => item.price_per_person == null)" class="budget-note"><Wallet :size="15" /> Os locais sem preço cadastrado podem ultrapassar R$ {{ Number(budget).toLocaleString('pt-BR') }} por pessoa. Confirme o valor com o restaurante antes de ir.</div>
        <div v-if="busy" class="cards"><div v-for="n in 3" :key="n" class="skeleton"></div></div>
        <div v-else-if="sorted.length" class="cards">
          <article v-for="(item,index) in sorted" :key="item.id" class="card">
            <div class="photo" :class="'photo-'+(index%6)">
              <img :src="item.image_url || cuisineImage(item.cuisine)" :alt="item.image_url ? 'Foto de '+item.name : 'Imagem ilustrativa de culinária '+(item.cuisine || 'variada')" loading="lazy" decoding="async" />
              <span v-if="!item.image_url" class="photo-note">Imagem ilustrativa</span>
              <button class="heart" :aria-label="favorites.has(item.id)?'Remover dos salvos':'Salvar restaurante'" @click="toggleFavorite(item)"><Heart :size="18" :fill="favorites.has(item.id)?'currentColor':'none'" /></button>
              <b class="price">{{ item.price_per_person != null ? money(item.price_per_person) : "Preço não informado" }} <small v-if="item.price_per_person != null">/ pessoa</small></b>
            </div>
            <div class="card-content">
              <div class="card-title"><div><span class="cuisine">{{ item.cuisine }}</span><h3>{{ item.name }}</h3></div><span v-if="item.rating != null" class="rating"><Star :size="14" fill="currentColor" /> {{ Number(item.rating).toFixed(1) }}</span><span v-else class="rating no-rating">Sem avaliação</span></div>
              <p class="description">{{ item.description }}</p>
              <div class="meta"><span><MapPin :size="13" /> {{ item.distance_km != null ? Number(item.distance_km).toFixed(1)+' km' : item.city || 'São Paulo' }}</span><span><Clock3 :size="13" /> {{ item.rating_count ? item.rating_count+' avaliações' : 'Sem avaliações' }}</span></div>
              <div class="card-bottom"><span v-if="item.price_per_person != null"><Check :size="13" /> Preço cadastrado</span><span v-else>Confirme o preço antes de ir</span><button @click="detail=item">Ver detalhes <ArrowUpRight :size="14" /></button></div>
            </div>
          </article>
        </div>
        <button v-if="hasMore && !busy && !favoritesOnly" class="more" @click="loadMore">Carregar mais lugares <ArrowRight :size="15" /></button>
        <div v-if="!busy && !sorted.length" class="empty"><span class="empty-icon"><Heart v-if="favoritesOnly" :size="25" /><Utensils v-else :size="25" /></span><h3>{{ favoritesOnly ? "Você ainda não salvou nenhum lugar" : mode === 'not_configured' ? "A base ainda não foi configurada" : "Nenhum lugar encontrado com esses filtros" }}</h3><p>{{ favoritesOnly ? "Toque no coração de um restaurante para guardá-lo aqui." : mode === 'not_configured' ? "Conecte o projeto Supabase e carregue os dados do município de São Paulo." : "Tente aumentar o orçamento ou escolher outra culinária." }}</p><button v-if="!favoritesOnly && mode !== 'not_configured'" @click="budget=100;cuisine='';activeCuisine='Todos';query='';search()">Limpar filtros</button><button v-else-if="favoritesOnly" @click="favoritesOnly=false">Voltar aos restaurantes</button></div>
      </section>

      <section class="how">
        <div class="how-copy"><div class="kicker">COMO FUNCIONA</div><h2>Escolha com mais<br />clareza e menos dúvida.</h2><p>Combine culinária, bairro e orçamento quando essas informações estiverem cadastradas. Se faltar preço ou avaliação, a gente avisa para você confirmar antes de sair.</p><button @click="goTop">Buscar um lugar <ArrowRight :size="15" /></button></div>
        <div class="steps">
          <div><span>01</span><i><MessageCircle :size="19" /></i><section><strong>Diga o que está procurando</strong><p>Um prato, culinária ou bairro já ajuda.</p></section></div>
          <div><span>02</span><i><Wallet :size="19" /></i><section><strong>Defina seu orçamento</strong><p>Escolha um valor aproximado por pessoa.</p></section></div>
          <div><span>03</span><i><Compass :size="19" /></i><section><strong>Compare os lugares</strong><p>Veja distância e confira os detalhes.</p></section></div>
        </div>
      </section>
    </main>
    <footer><a class="brand" href="#"><span class="brand-mark"><Utensils :size="15" /></span><span>onde<span class="brand-dot">.</span>vamos?</span></a><span>Feito pra sair da dúvida e ir direto pra mesa.</span><small>Dados de mapa © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · Valores e avaliações só aparecem quando cadastrados.</small></footer>
    <div v-if="detail" class="backdrop" @click.self="detail=null" @keydown.esc="detail=null">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button class="close" aria-label="Fechar" @click="detail=null"><X :size="18" /></button><div class="modal-art"><Utensils :size="28" /></div>
        <span class="cuisine">{{ detail.cuisine }}</span><h2 id="modal-title">{{ detail.name }}</h2><p>{{ detail.description }}</p>
        <div class="modal-line"><Wallet :size="16" /><template v-if="detail.price_per_person != null"><b>{{ money(detail.price_per_person) }}</b><span>estimativa por pessoa</span></template><span v-else>Preço não informado; confirme diretamente com o restaurante.</span></div>
        <div class="modal-line"><MapPin :size="16" />{{ detail.address || detail.city }}</div>
        <div class="tag-list"><span v-for="tag in detail.tags" :key="tag">{{ tag }}</span></div>
        <p class="disclaimer">Preço, avaliações e disponibilidade podem mudar. Confirme com o restaurante antes de ir.</p>
        <a class="map-link" :href="mapsUrl(detail)" target="_blank" rel="noreferrer">Ver no mapa <ArrowUpRight :size="15" /></a>
        <a v-if="detail.source_url" class="source-link" :href="detail.source_url" target="_blank" rel="noreferrer">Ver este local no OpenStreetMap</a>
      </section>
    </div>
  </div>
</template>

