<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, Compass, Heart, MapPin, MessageCircle, Search, SlidersHorizontal, Star, Utensils, Wallet, X } from "@lucide/vue";

const items = ref([]);
const busy = ref(false);
const hasMore = ref(false);
const nextPageToken = ref(null);
const error = ref("");
const budgetNotice = ref("");
const query = ref("");
const interpretedQuery = ref(false);
const cuisine = ref("");
const budget = ref(60);
const priceLevel = ref("");
const mode = ref("not_configured");
const foursquareEnabled = ref(false);
const googlePlacesEnabled = ref(false);
const googleEnterpriseEnabled = ref(false);
const place = ref({ lat: -23.5505, lng: -46.6333, radiusKm: 45 });
const placeLabel = ref("São Paulo, SP");
const near = ref("São Paulo, SP");
const preciseLocationEnabled = ref(false);
const activeCuisine = ref("Todos");
const favorites = ref(new Set());
const favoriteItems = ref(new Map());
const filtersOpen = ref(false);
const detail = ref(null);
const sortBy = ref("recommended");
const favoritesOnly = ref(false);
const failedPhotos = ref(new Set());
const pageFilters = ref({ cuisine: "", maxBudget: 60, maxPriceLevel: "", q: "" });
const pageSize = computed(() => mode.value === "google" ? 20 : 50);
const cuisines = ["Todos", "Japonesa", "Italiana", "Brasileira", "Árabe", "Hambúrguer", "Vegetariana", "Chinesa", "Mexicana", "Indiana", "Mediterrânea", "Cafeteria", "Bar"];
const title = computed(() => favoritesOnly.value ? "Seus lugares salvos" : items.value.length + (items.value.length === 1 ? " lugar encontrado" : " lugares encontrados"));
const hasKnownPrice = computed(() => (favoritesOnly.value ? [...favoriteItems.value.values()] : items.value).some((item) => item.price_per_person != null));
const hasKnownRating = computed(() => (favoritesOnly.value ? [...favoriteItems.value.values()] : items.value).some((item) => item.rating != null));
const sorted = computed(() => {
  const list = (favoritesOnly.value ? [...favoriteItems.value.values()] : [...items.value])
    .filter((item) => hasCompleteRestaurantDetails(item) && (["foursquare", "google"].includes(item.source) || !failedPhotos.value.has(photoKey(item))));
  if (sortBy.value === "price") return list.sort((a, b) => (a.price_per_person ?? a.price_level ?? Infinity) - (b.price_per_person ?? b.price_level ?? Infinity));
  if (sortBy.value === "rating") return list.sort((a, b) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity));
  if (preciseLocationEnabled.value) return list.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  return list.sort((a, b) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity));
});
const money = (value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const verifiedDate = (value) => value ? new Date(value).toLocaleDateString("pt-BR") : "";
function hasCompleteRestaurantDetails(item) {
  if (item?.source === "foursquare") {
    return Boolean(item.fsq_place_id && item.name?.trim() && item.source_url?.startsWith("https://") && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)));
  }
  if (item?.source === "google") {
    return Boolean(item.google_place_id && item.name?.trim() && item.source_url?.startsWith("https://") && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)));
  }
  const timestamp = Date.parse(item?.verified_at || "");
  return Boolean(
    item?.image_url?.startsWith("https://")
    && item?.image_attribution?.trim()
    && item?.image_source_url?.startsWith("https://")
    && item?.description?.trim().length >= 40
    && item?.cuisine?.trim()
    && item.cuisine.trim().toLowerCase() !== "não informada"
    && item?.menu_url?.startsWith("https://")
    && item?.price_source_url?.startsWith("https://")
    && Number(item?.price_per_person) > 0
    && Number.isFinite(timestamp)
    && timestamp <= Date.now()
    && timestamp > Date.now() - 180 * 24 * 60 * 60 * 1000
  );
}
function photoKey(item) { return `${item?.id || ""}:${item?.image_url || ""}`; }
function foodIcon(value = "") {
  const text = value.toLocaleLowerCase("pt-BR");
  if (/jap|sushi|chines|asiát|asiat/.test(text)) return "🍣";
  if (/hamb|burger/.test(text)) return "🍔";
  if (/ital|pizza/.test(text)) return "🍕";
  if (/café|cafe|coffee/.test(text)) return "☕";
  if (/veget|vegan/.test(text)) return "🥗";
  if (/bar|pub/.test(text)) return "🍻";
  return "🍽️";
}
function priceDisplay(item) {
  if (item?.price_per_person != null) return `${money(item.price_per_person)} / pessoa`;
  if (item?.source === "foursquare" && item.price_level) return `${"$".repeat(item.price_level)} · ${item.price_level_label}`;
  if (item?.source === "google" && item.price_level) return `${"$".repeat(item.price_level)} · ${item.price_level_label}`;
  return "Preço não informado";
}
function markPhotoUnavailable(item) {
  const failed = new Set(failedPhotos.value);
  failed.add(photoKey(item));
  failedPhotos.value = failed;
  if (detail.value?.id === item?.id && !["foursquare", "google"].includes(item?.source)) detail.value = null;
}
async function loadMeta() {
  try {
    const response = await fetch("/api/meta");
    const data = await response.json();
    mode.value = data.dataMode;
    foursquareEnabled.value = Boolean(data.foursquareEnabled);
    googlePlacesEnabled.value = Boolean(data.googlePlacesEnabled);
    googleEnterpriseEnabled.value = Boolean(data.googleEnterpriseFieldsEnabled);
  } catch {}
}

async function search(options = {}) {
  const append = Boolean(options.append);
  busy.value = true;
  error.value = "";
  budgetNotice.value = "";
  if (!append) {
    hasMore.value = false;
    nextPageToken.value = null;
  }
  try {
    const params = new URLSearchParams();
    const kind = options.cuisine ?? (cuisine.value || (activeCuisine.value !== "Todos" ? activeCuisine.value : ""));
    const max = options.maxBudget ?? Number(budget.value);
    const level = options.maxPriceLevel ?? priceLevel.value;
    const searchText = options.q ?? (query.value.trim() && !interpretedQuery.value ? query.value.trim() : "");
    if (kind) params.set("cuisine", kind);
    if (mode.value === "foursquare" || mode.value === "google") {
      if (level) params.set("maxPriceLevel", String(level));
      if (!preciseLocationEnabled.value && near.value.trim()) params.set("near", near.value.trim());
    } else if (max) params.set("maxBudget", String(max));
    if (searchText) params.set("q", searchText);
    params.set("limit", String(pageSize.value));
    if (mode.value === "google") {
      if (append && nextPageToken.value) params.set("pageToken", nextPageToken.value);
    } else {
      params.set("offset", String(append ? items.value.length : 0));
    }
    if (preciseLocationEnabled.value && place.value) {
      params.set("lat", String(place.value.lat));
      params.set("lng", String(place.value.lng));
      params.set("radiusKm", String(place.value.radiusKm || 45));
    }
    const response = await fetch("/api/restaurants?" + params.toString());
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível buscar lugares.");
    items.value = append ? [...items.value, ...data.items] : data.items;
    hasMore.value = data.hasMore === true;
    nextPageToken.value = data.nextPageToken || null;
    if (!append) pageFilters.value = { cuisine: kind, maxBudget: max, maxPriceLevel: level, q: searchText };
    mode.value = data.dataMode;
  } catch (err) { error.value = err.message; }
  finally { busy.value = false; }
}

async function searchByDescription() {
  if (!query.value.trim()) return search();
  busy.value = true;
  error.value = "";
  budgetNotice.value = "";
  hasMore.value = false;
  try {
    const response = await fetch("/api/recommend", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: query.value, ...(["foursquare", "google"].includes(mode.value) ? { ...(priceLevel.value ? { maxPriceLevel: Number(priceLevel.value) } : {}), ...(preciseLocationEnabled.value && place.value ? {} : { near: near.value.trim() }) } : { maxBudget: Number(budget.value) }), ...(preciseLocationEnabled.value && place.value ? { lat: place.value.lat, lng: place.value.lng, radiusKm: place.value.radiusKm || 45 } : {}) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não consegui interpretar seu pedido.");
    items.value = data.items;
    mode.value = data.dataMode;
    if (data.budgetNotice) budgetNotice.value = data.budgetNotice;
    interpretedQuery.value = true;
    cuisine.value = data.filters.cuisine || "";
    activeCuisine.value = data.filters.cuisine || "Todos";
    if (data.filters.maxBudget != null) budget.value = data.filters.maxBudget;
    pageFilters.value = {
      cuisine: data.filters.cuisine || "",
      maxBudget: data.filters.maxBudget ?? Number(budget.value),
      maxPriceLevel: priceLevel.value,
      q: data.filters.searchText || ""
    };
    hasMore.value = data.hasMore === true;
    nextPageToken.value = data.nextPageToken || null;
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
  if (!hasCompleteRestaurantDetails(item)) return;
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
    preciseLocationEnabled.value = true;
    placeLabel.value = "Perto de você";
    search();
  }, () => { error.value = "Não consegui acessar sua localização. Confira a permissão do navegador."; }, { timeout: 8000 });
}

function useTypedLocation() {
  preciseLocationEnabled.value = false;
  placeLabel.value = near.value.trim() || "São Paulo, SP";
}

function mapsUrl(item) {
  const name = typeof item?.name === "string" ? item.name.trim() : "";
  const address = typeof item?.address === "string" ? item.address.trim() : "";
  const coordinates = item?.lat != null && item?.lng != null ? `${item.lat},${item.lng}` : "";
  const query = [name, address].filter(Boolean).join(", ") || coordinates || "São Paulo, SP";
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function quickSearch(text) { query.value = text; interpretedQuery.value = false; searchByDescription(); }
function goTop() { window.scrollTo({ top: 0, behavior: "smooth" }); }
watch(favoriteItems, (next) => {
  try { localStorage.setItem("onde-vamos-favoritos", JSON.stringify([...next.values()].filter((item) => !["foursquare", "google"].includes(item.source)))); } catch {}
});
onMounted(async () => {
  let stored = [];
  try {
    const parsed = JSON.parse(localStorage.getItem("onde-vamos-favoritos") || "[]");
    if (Array.isArray(parsed)) stored = parsed;
  } catch {}
  await loadMeta();
  await search({ cuisine: "", maxBudget: 60 });
  const saved = new Map(stored.filter((item) => item && typeof item === "object" && item.id && !["foursquare", "google"].includes(item.source) && hasCompleteRestaurantDetails(item)).map((item) => [item.id, item]));
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
          <p v-if="mode === 'google'">Descubra restaurantes por culinária e bairro. Confira preços, cardápios e funcionamento no perfil oficial do estabelecimento.</p><p v-else>Descubra lugares para comer por culinária, distância e orçamento. Informações ausentes ficam claras, sem preço ou avaliação inventados.</p>
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
          <label v-if="['foursquare','google'].includes(mode)"><span><MapPin :size="15" /> Cidade ou bairro</span><input v-model="near" maxlength="120" placeholder="Ex.: Pinheiros, São Paulo" aria-label="Cidade ou bairro para buscar" @input="useTypedLocation" /></label>
          <label v-if="mode === 'foursquare' || (mode === 'google' && googleEnterpriseEnabled)"><span><Wallet :size="15" /> Faixa geral de preço</span><select v-model="priceLevel"><option value="">Todas as faixas</option><option value="1">Econômico ($)</option><option value="2">Moderado ($$)</option><option value="3">Caro ($$$)</option><option value="4">Muito caro ($$$$)</option></select></label>
          <label v-else-if="mode !== 'google'"><span><Wallet :size="15" /> Até quanto por pessoa?</span><div class="money-input"><b>R$</b><input v-model.number="budget" type="number" min="10" max="500" step="5" /><small>/ pessoa</small></div></label>
          <p v-else class="filter-note">Preços em reais não estão disponíveis nesta configuração do Google.</p>
          <label><span><Utensils :size="15" /> Tipo de comida</span><select v-model="cuisine"><option value="">Qualquer tipo</option><option v-for="c in cuisines.slice(1)" :key="c">{{ c }}</option></select></label>
          <button class="apply-button" @click="activeCuisine = cuisine || 'Todos'; search()">Aplicar filtros <ArrowRight :size="15" /></button>
        </div>
        <div class="popular"><span>Popular agora</span><template v-if="['foursquare','google'].includes(mode)"><button @click="quickSearch('comida japonesa')">Comida japonesa</button><button @click="quickSearch('comida brasileira')">Comida brasileira</button><button @click="quickSearch('comida vegetariana')">Vegetariano</button></template><template v-else><button @click="quickSearch('japonesa até R$ 60 por pessoa')">Japa até R$ 60</button><button @click="quickSearch('almoço brasileiro até R$ 35')">Almoço barato</button><button @click="quickSearch('comida vegetariana até R$ 45')">Vegetariano</button></template></div>
      </section>

      <section class="results" :aria-busy="busy">
        <div class="results-head"><div><div class="kicker">LUGARES PERTO E PELO SEU ESTILO</div><h2>{{ title }}</h2></div>
          <label class="sort"><span>Ordenar por</span><select v-model="sortBy"><option value="recommended">Recomendados</option><option value="price" :disabled="!hasKnownPrice">{{ ['foursquare','google'].includes(mode) ? 'Faixa geral' : 'Menor preço' }}{{ hasKnownPrice ? "" : " (indisponível)" }}</option><option value="rating" :disabled="!hasKnownRating">Melhor avaliação{{ hasKnownRating ? "" : " (indisponível)" }}</option></select><ChevronDown :size="13" /></label>
        </div>
        <div class="tabs"><button v-for="c in cuisines" :key="c" :class="{ active: activeCuisine === c }" @click="setCuisine(c)">{{ c }}</button></div>
        <div v-if="error" class="error" role="status" aria-live="polite"><span>{{ error }}</span><button aria-label="Fechar aviso" @click="error = ''"><X :size="15" /></button></div>
        <div v-if="mode === 'google'" class="demo-label"><i></i> Resultados consultados ao vivo no Google. Endereços e fichas podem ser abertos no Google Maps; preço por pessoa, cardápio e fotos não são incluídos nesta configuração. <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" translate="no">Google Maps</a> · <a href="/termos">Termos</a></div>
        <div v-else-if="mode === 'foursquare'" class="demo-label"><i></i> Resultados consultados ao vivo no Foursquare. A faixa ($–$$$$) é geral, não representa gasto em reais por pessoa. Cardápios levam ao link fornecido pelo lugar. Favoritos desta fonte ficam somente nesta sessão. <a href="https://foursquare.com" target="_blank" rel="noreferrer">Dados: Foursquare</a></div>
        <div v-else-if="mode === 'openstreetmap'" class="demo-label"><i></i> Nesta busca aparecem apenas cadastros próprios verificados. Configure a chave do Google Places para ativar resultados ao vivo. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Créditos do mapa: OpenStreetMap</a></div>
        <div v-else-if="mode === 'not_configured' || (!foursquareEnabled && !googlePlacesEnabled)" class="demo-label"><i></i> Para buscar restaurantes ao vivo, configure GOOGLE_PLACES_API_KEY ou FOURSQUARE_API_KEY no Render. A chave fica no servidor e não deve ser enviada ao navegador.</div>
        <div v-if="query && interpretedQuery && !error" class="search-hint"><Check :size="15" /> Busca aplicada com base no que você descreveu.</div>
        <div v-if="budgetNotice || (['foursquare','google'].includes(mode) && query && /r\s?\$/i.test(query))" class="budget-note"><Wallet :size="15" /> {{ budgetNotice || (mode === 'google' ? "O Google não informa preço por pessoa em reais nesta configuração. Confirme os valores no perfil ou cardápio do restaurante." : "O Foursquare não informa preço por pessoa em reais. Use a faixa geral nos filtros e confirme valores no cardápio oficial.") }}</div>
        <div v-else-if="!['foursquare','google'].includes(mode) && items.some(item => item.price_per_person == null)" class="budget-note"><Wallet :size="15" /> Os locais sem preço cadastrado podem ultrapassar R$ {{ Number(budget).toLocaleString('pt-BR') }} por pessoa. Confirme o valor com o restaurante antes de ir.</div>
        <div v-if="busy" class="cards"><div v-for="n in 3" :key="n" class="skeleton"></div></div>
        <div v-else-if="sorted.length" class="cards">
          <article v-for="(item,index) in sorted" :key="item.id" class="card">
            <div class="photo" :class="'photo-'+(index%6)">
              <img v-if="item.image_url && !failedPhotos.has(photoKey(item))" :src="item.image_url" :alt="'Foto do local '+item.name" loading="lazy" decoding="async" @error="markPhotoUnavailable(item)" />
              <div v-else class="food" :aria-label="'Ilustração de '+item.cuisine">{{ foodIcon(item.cuisine) }}</div>
              <a v-if="item.image_url && !failedPhotos.has(photoKey(item))" class="photo-credit" :href="item.image_source_url || item.source_url" target="_blank" rel="noreferrer" :aria-label="'Crédito e fonte da imagem: '+(item.image_attribution || 'Foursquare')">Foto: {{ item.image_attribution || 'Foursquare' }}</a>
              <a v-if="item.image_license_url && !failedPhotos.has(photoKey(item))" class="photo-license" :href="item.image_license_url" target="_blank" rel="license noreferrer">{{ item.image_license_name || "Licença da foto" }}</a>
              <button class="heart" :aria-label="favorites.has(item.id)?'Remover dos salvos':'Salvar restaurante'" @click="toggleFavorite(item)"><Heart :size="18" :fill="favorites.has(item.id)?'currentColor':'none'" /></button>
              <b class="price">{{ priceDisplay(item) }}</b>
            </div>
            <div class="card-content">
              <div class="card-title"><div><span class="cuisine">{{ item.cuisine }}</span><h3>{{ item.name }}</h3></div><span v-if="item.rating != null" class="rating" :title="item.source === 'foursquare' ? 'Nota Foursquare de 0 a 10' : 'Avaliação do estabelecimento'"><Star :size="14" fill="currentColor" /> {{ Number(item.rating).toFixed(1) }}{{ item.source === 'foursquare' ? ' / 10' : '' }}</span><span v-else class="rating no-rating">Sem avaliação</span></div>
              <p class="description">{{ item.description || "Consulte o site ou o perfil do estabelecimento para mais informações." }}</p>
              <div class="meta"><span><MapPin :size="13" /> {{ item.distance_km != null ? Number(item.distance_km).toFixed(1)+' km' : item.city || 'São Paulo' }}</span><span><Clock3 :size="13" /> {{ item.open_now === true ? "Aberto agora" : item.open_now === false ? "Fechado agora" : item.rating_count ? item.rating_count+' avaliações' : "Horário não informado" }}</span></div>
              <div class="card-bottom"><span><Check :size="13" /> {{ ['foursquare','google'].includes(item.source) ? 'Resultado do provedor' : 'Dados verificados' }}</span><button @click="detail=item">{{ item.menu_url ? "Ver cardápio" : "Ver detalhes" }} <ArrowUpRight :size="14" /></button></div>
            </div>
          </article>
        </div>
        <button v-if="hasMore && !busy && !favoritesOnly" class="more" @click="loadMore">Carregar mais lugares <ArrowRight :size="15" /></button>
        <div v-if="!busy && !sorted.length" class="empty"><span class="empty-icon"><Heart v-if="favoritesOnly" :size="25" /><Utensils v-else :size="25" /></span><h3>{{ favoritesOnly ? "Você ainda não salvou nenhum lugar" : mode === 'not_configured' ? "A busca ainda não foi configurada" : ['foursquare','google'].includes(mode) ? "Nenhum lugar encontrado nesta busca" : "Nenhum restaurante verificado para exibir" }}</h3><p>{{ favoritesOnly ? "Toque no coração de um lugar para guardá-lo." : mode === 'not_configured' ? "Configure a chave do Google Places ou do Foursquare no ambiente do servidor para habilitar a busca ao vivo." : mode === 'google' ? "Tente outra culinária ou bairro. Confira preços e funcionamento no perfil oficial do estabelecimento." : mode === 'foursquare' ? "Tente outra culinária, aumente o raio ou remova o filtro de preço. Valores exatos por pessoa ainda não são fornecidos pelo Foursquare." : "Os registros do OpenStreetMap ficam ocultos até terem foto, cardápio, preço e verificação completos." }}</p><button v-if="favoritesOnly" @click="favoritesOnly=false">Voltar aos restaurantes</button></div>
      </section>

      <section class="how">
        <div class="how-copy"><div class="kicker">COMO FUNCIONA</div><h2>Escolha com mais<br />clareza e menos dúvida.</h2><p v-if="mode === 'google'">Compare os restaurantes e abra suas fichas no Google Maps. Confirme cardápios e valores diretamente com cada estabelecimento.</p><p v-else>Veja lugares e suas faixas gerais de preço. Para valores em reais por pessoa, confira o cardápio oficial do restaurante.</p><button @click="goTop">Buscar um lugar <ArrowRight :size="15" /></button></div>
        <div class="steps">
          <div><span>01</span><i><MessageCircle :size="19" /></i><section><strong>Diga o que está procurando</strong><p>Um prato, culinária ou bairro já ajuda.</p></section></div>
          <div><span>02</span><i><Wallet :size="19" /></i><section><strong>{{ mode === 'google' ? 'Confira cardápio e preços' : 'Defina seu orçamento' }}</strong><p>{{ mode === 'google' ? 'Os valores são confirmados no perfil oficial do restaurante.' : 'Escolha um valor aproximado por pessoa.' }}</p></section></div>
          <div><span>03</span><i><Compass :size="19" /></i><section><strong>Compare os lugares</strong><p>Veja distância e confira os detalhes.</p></section></div>
        </div>
      </section>
    </main>
    <footer><a class="brand" href="#"><span class="brand-mark"><Utensils :size="15" /></span><span>onde<span class="brand-dot">.</span>vamos?</span></a><span>Feito pra sair da dúvida e ir direto pra mesa.</span><small v-if="mode === 'google'">Dados de locais por <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" translate="no">Google Maps</a>. Preços em reais e fotos não estão disponíveis.</small><small v-else-if="mode === 'foursquare'"><a href="https://foursquare.com" target="_blank" rel="noreferrer">Powered by Foursquare</a> · Fotos e dados dos estabelecimentos são fornecidos pelo Foursquare. Faixas gerais de preço não representam valores em reais por pessoa.</small><small v-else>Dados de mapa © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · Fotos, cardápios e preços aparecem com origem e verificação.</small><a href="/privacidade" class="source-link">Privacidade</a><a href="/termos" class="source-link">Termos de uso</a></footer>
    <div v-if="detail" class="backdrop" @click.self="detail=null" @keydown.esc="detail=null">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button class="close" aria-label="Fechar" @click="detail=null"><X :size="18" /></button><div class="modal-art"><img v-if="detail.image_url && !failedPhotos.has(photoKey(detail))" :src="detail.image_url" :alt="'Foto do local '+detail.name" @error="markPhotoUnavailable(detail)" /><div v-else class="food">{{ foodIcon(detail.cuisine) }}</div><a v-if="detail.image_url && !failedPhotos.has(photoKey(detail))" :href="detail.image_source_url || detail.source_url" target="_blank" rel="noreferrer">Foto: {{ detail.image_attribution || 'Foursquare' }}</a><a v-if="detail.image_license_url && !failedPhotos.has(photoKey(detail))" class="license-link" :href="detail.image_license_url" target="_blank" rel="license noreferrer">{{ detail.image_license_name || "Licença da foto" }}</a></div>
        <span class="cuisine">{{ detail.cuisine }}</span><h2 id="modal-title">{{ detail.name }}</h2><p>{{ detail.description || "Consulte o site oficial ou o perfil da fonte para confirmar os detalhes do estabelecimento." }}</p>
        <a v-if="detail.description_source_url" class="source-link" :href="detail.description_source_url" target="_blank" rel="noreferrer">Fonte da descrição</a>
        <div class="modal-line"><Wallet :size="16" /><b v-if="detail.price_per_person != null">{{ money(detail.price_per_person) }}</b><b v-else>{{ priceDisplay(detail) }}</b><span>{{ detail.price_per_person != null ? "por pessoa" : detail.source === 'foursquare' ? "faixa geral; não é valor por pessoa" : "" }}</span></div>
        <div class="modal-line"><MapPin :size="16" />{{ detail.address || detail.city }}</div>
        <div class="tag-list"><span v-for="tag in detail.tags" :key="tag">{{ tag }}</span></div>
        <p class="verification-note" v-if="detail.source === 'foursquare'">Dados de descoberta fornecidos pelo Foursquare. Confirme funcionamento e preços com o restaurante.</p><p class="verification-note" v-else-if="detail.source === 'google'">Dados do Google Maps. Confirme o funcionamento e os preços diretamente com o estabelecimento.</p><p class="verification-note" v-else>Informações verificadas em {{ verifiedDate(detail.verified_at) }}. Valores e disponibilidade ainda podem mudar.</p>
        <a v-if="detail.menu_url" class="menu-link" :href="detail.menu_url" target="_blank" rel="noreferrer">Ver cardápio do estabelecimento <ArrowUpRight :size="15" /></a>
        <a v-else-if="detail.website_url" class="menu-link" :href="detail.website_url" target="_blank" rel="noreferrer">Abrir site do estabelecimento <ArrowUpRight :size="15" /></a>
        <a v-if="detail.price_source_url" class="source-link" :href="detail.price_source_url" target="_blank" rel="noreferrer">Consultar fonte do valor</a>
        <a class="map-link" :href="mapsUrl(detail)" target="_blank" rel="noreferrer">Ver no mapa <ArrowUpRight :size="15" /></a>
        <a v-if="detail.source === 'foursquare' && detail.source_url" class="source-link" :href="detail.source_url" target="_blank" rel="noreferrer">Ver ficha no Foursquare</a><a v-else-if="detail.source === 'google' && detail.source_url" class="source-link" :href="detail.source_url" target="_blank" rel="noreferrer" translate="no">Ver ficha no Google Maps</a><a v-else-if="detail.source_url" class="source-link" :href="detail.source_url" target="_blank" rel="noreferrer">Ver localização no OpenStreetMap</a>
      </section>
    </div>
  </div>
</template>

