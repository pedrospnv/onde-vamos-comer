// Links e resumos editoriais verificados em páginas públicas dos próprios locais.
// Esta camada complementa o resultado ao vivo do Foursquare sem guardar dados dele.
const CURATED_PLACES = {
  "padaria santa branca": {
    cuisine: "Padaria e confeitaria",
    description: "Panificadora tradicional da Mooca, com pães, confeitaria e refeições.",
    website_url: "https://padariasantabranca.com.br/",
    menu_url: "https://padariasantabranca.com.br/links/"
  },
  cepam: {
    cuisine: "Padaria e confeitaria",
    description: "Padaria e centro gastronômico na Vila Prudente, com opções de refeições e produtos de panificação.",
    website_url: "https://www.cepam.com.br/padaria/"
  },
  "outback steakhouse": {
    cuisine: "Steakhouse australiana",
    description: "Rede de casual dining com carnes, ribs, burgers e pratos para compartilhar. Consulte o menu da unidade.",
    website_url: "https://www.outback.com.br/",
    menu_url: "https://www.outback.com.br/nossosprodutos"
  },
  "estado luso paes e doces": {
    cuisine: "Padaria e confeitaria",
    description: "Padaria paulistana com pães, cafés, salgados, lanches e encomendas.",
    website_url: "https://estadoluso.com.br/",
    menu_url: "https://estadoluso.com.br/cardapio.pdf"
  },
  "estadao bar e lanches": {
    cuisine: "Brasileira",
    description: "Bar e lanchonete tradicional do Centro, conhecido pelo sanduíche de pernil e pratos feitos.",
    website_url: "https://www.estadaolanches.com.br/",
    menu_url: "https://www.estadaolanches.com.br/cardapio-portugues.pdf"
  },
  "le ble casa de paes": {
    cuisine: "Padaria e confeitaria",
    description: "Casa de pães de inspiração francesa em Higienópolis, com viennoiserie, confeitaria e pratos de café e brunch.",
    website_url: "https://leblecasadepaes.com.br/",
    description_source_url: "https://vejasp.abril.com.br/estabelecimento/le-ble-casa-de-paes/"
  },
  "primicia dos paes": {
    cuisine: "Padaria e confeitaria",
    description: "Padaria com unidade no Jardim Prudência e variedade de pães, doces e encomendas.",
    website_url: "https://primiciadospaes.com.br/"
  },
  spot: {
    cuisine: "Contemporânea",
    description: "Restaurante de cozinha contemporânea com cardápio de pratos, saladas e opções para compartilhar.",
    website_url: "https://www.restaurantespot.com.br/",
    menu_url: "https://www.restaurantespot.com.br/cardapio/"
  },
  ritz: {
    cuisine: "Contemporânea",
    description: "Restaurante paulistano de cozinha contemporânea; este link mostra o cardápio da unidade Iguatemi.",
    website_url: "https://restauranteritz.com.br/",
    menu_url: "https://cardapio.restauranteritz.com.br/iguatemi/"
  },
  "le jazz brasserie": {
    cuisine: "Francesa",
    description: "Brasserie inspirada nos bistrôs parisienses, com clássicos franceses e pães feitos pela casa.",
    website_url: "https://www.lejazz.com.br/",
    menu_url: "https://www.lejazz.com.br/CardapioBrasserieLeJazz/CARDAPIO%20COMIDA%20DIGITAL.pdf"
  },
  rascal: {
    cuisine: "Italiana",
    description: "Restaurante com buffet, massas, grelhados, pizzas e sobremesas; o cardápio varia por unidade.",
    website_url: "https://www.rascal.com.br/",
    menu_url: "https://www.rascal.com.br/restaurante/cardapio-e-bebidas-rascal-sao-paulo/"
  },
  "ceci panificadora": {
    cuisine: "Padaria e confeitaria",
    description: "Padaria de bairro com pães, doces, bolos, cafés e lanches.",
    website_url: "https://linktr.ee/panificadoraceci",
    menu_url: "https://epadoca.com/ceci"
  },
  "seen": {
    cuisine: "Contemporânea",
    description: "Restaurante e bar no hotel Tivoli Mofarrej, com pratos para compartilhar e opções vegetarianas.",
    website_url: "https://seensp.com/",
    menu_url: "https://seensp.com/menu/"
  },
  "pobre juan": {
    cuisine: "Argentina",
    description: "Casa de carnes inspirada nas parrillas argentinas, com cortes grelhados e acompanhamentos.",
    website_url: "https://www.pobrejuan.com.br/",
    menu_url: "https://www.pobrejuan.com.br/cardapio"
  },
  "esfiha imigrantes": {
    cuisine: "Árabe",
    description: "Restaurante de culinária árabe com esfihas, quibes, pratos e opções para compartilhar.",
    website_url: "https://esfihaimigrantes.com.br/",
    menu_url: "https://esfihaimigrantes.com.br/cardapio.html"
  },
  "z deli sandwiches": {
    cuisine: "Hambúrguer e sanduíches",
    description: "Deli paulistana com sanduíches, hambúrgueres, entradas e itens de inspiração judaica.",
    website_url: "https://www.zdeli.com.br/",
    menu_url: "https://www.zdeli.com.br/cardapios/centro/CARDAPIO%20DIGITAL%20Z%20DELI%20COMIDA.pdf"
  },
  "z deli": {
    cuisine: "Hambúrguer e sanduíches",
    description: "Deli paulistana com sanduíches, hambúrgueres, entradas e itens de inspiração judaica.",
    website_url: "https://www.zdeli.com.br/",
    menu_url: "https://www.zdeli.com.br/"
  },
  "ripa na brasa": {
    cuisine: "Brasileira",
    description: "Restaurante de almoço por quilo com churrasco no Tatuapé.",
    website_url: "https://www.ripanabrasa.com.br/"
  },
  "panificadora requinte": {
    cuisine: "Padaria e confeitaria",
    description: "Padaria na Penha com buffet de café da manhã, pães, confeitaria e opções de refeição.",
    website_url: "https://www.requinte.com.br/",
    menu_url: "https://delivery.requinte.com.br/requinte"
  },
  "brioche brasil": {
    cuisine: "Padaria e confeitaria",
    description: "Padaria e café na Barra Funda, com viennoiserie e lanches.",
    description_source_url: "https://vejasp.abril.com.br/estabelecimento/brioche-brasil/"
  },
  "soul cafe": {
    cuisine: "Cafeteria",
    description: "Cafeteria na Rua Augusta dedicada a cafés especiais e acompanhamentos.",
    website_url: "https://soulcafe.com.br/"
  },
  "osteria generale": {
    cuisine: "Italiana",
    description: "Cantina paulistana de cozinha italiana, com massas artesanais, antepastos e pratos fartos.",
    website_url: "https://generale.com.br/",
    menu_url: "https://generale.com.br/wp-content/uploads/2024/02/CARDAPIO-PAMPLONA.pdf"
  },
  "fazemos pao": {
    cuisine: "Padaria artesanal",
    description: "Padaria artesanal de Pinheiros com pães de fermentação natural e viennoiserie.",
    website_url: "https://linktr.ee/fazemospao"
  },
  "sapporo japanese food": {
    cuisine: "Japonesa",
    description: "Restaurante japonês em Moema com pratos tradicionais e festivais de comida japonesa.",
    website_url: "https://www.restaurantesapporo.com.br/"
  },
  "a figueira rubaiyat": {
    cuisine: "Brasileira e carnes",
    description: "Restaurante do Grupo Rubaiyat com carnes, peixes e pratos servidos em um salão ao redor de uma figueira.",
    website_url: "https://gruporubaiyat.com/pt/restaurantes/sao-paulo/a-figueira-rubaiyat"
  },
  "jardim de napoli": {
    cuisine: "Italiana",
    description: "Cantina italiana tradicional de Higienópolis, famosa pelo polpettone à parmegiana.",
    website_url: "https://iguatemi.com.br/patiohigienopolis/lojas-e-alimentacao/jardim-de-napoli"
  },
  "lellis trattoria": {
    cuisine: "Italiana",
    description: "Trattoria italiana com massas, carnes e pratos clássicos; consulte o menu da unidade.",
    website_url: "https://www.lellis.com.br/"
  },
  "veridiana pizzaria": {
    cuisine: "Pizzaria",
    description: "Pizzaria paulistana com pizzas clássicas e autorais; consulte o cardápio e as unidades no site.",
    website_url: "https://www.veridiana.com.br/"
  },
  "urbe cafe bar": {
    cuisine: "Cafeteria e bar",
    description: "Café e bar na Consolação com bebidas, pratos leves e opções para diferentes horários.",
    website_url: "https://www.urbecafe.com.br/",
    menu_url: "https://www.urbecafe.com.br/pages/cardapio"
  },
  "jojo ramen": {
    cuisine: "Japonesa",
    description: "Casa especializada em ramen, com caldos e macarrão preparados na própria cozinha.",
    website_url: "https://jojoramen.com.br/"
  },
  kitchin: {
    cuisine: "Japonesa",
    description: "Restaurante japonês contemporâneo com sushis, pratos quentes e unidades em São Paulo.",
    website_url: "https://kitchin.com.br/"
  },
  "rong he": {
    cuisine: "Chinesa",
    description: "Restaurante chinês com cardápio de pratos quentes, massas e opções para compartilhar.",
    website_url: "https://ronghe.com.br/",
    menu_url: "https://ronghe.com.br/cardapio/"
  },
  insalata: {
    cuisine: "Contemporânea",
    description: "Restaurante com saladas, carnes, peixes, massas e pratos executivos.",
    website_url: "https://insalata.com.br/",
    menu_url: "https://insalata.com.br/"
  },
  "fuego celeste": {
    cuisine: "Uruguaia e parrilla",
    description: "Parrilla com cortes de carne, acompanhamentos e pratos de inspiração uruguaia.",
    website_url: "https://fuegoceleste.com.br/fuegoceleste/"
  },
  ikkousha: {
    cuisine: "Japonesa",
    description: "Casa especializada em ramen tonkotsu, no bairro da Liberdade.",
    website_url: "https://ikkousha.com.br/"
  },
  "banzeiro cozinha amazonica": {
    cuisine: "Brasileira amazônica",
    description: "Cozinha amazônica com ingredientes e preparos regionais, sob o comando do chef Felipe Schaedler.",
    website_url: "https://grupobanzeiro.com.br/banzeiro-sao-paulo/"
  }
};

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function enrichRestaurant(place, mapped) {
  const name = normalizeName(place?.name);
  const curated = CURATED_PLACES[name]
    || (/^outback(?: steakhouse)?(?: |$)/.test(name) ? CURATED_PLACES["outback steakhouse"] : null)
    || (/^rascal(?: |$)/.test(name) ? CURATED_PLACES.rascal : null)
    || (/^z deli(?: |$)/.test(name) ? CURATED_PLACES["z deli"] : null)
    || (/^le jazz(?: |$)/.test(name) ? CURATED_PLACES["le jazz brasserie"] : null)
    || (/^estado luso(?: |$)/.test(name) ? CURATED_PLACES["estado luso paes e doces"] : null)
    || (/^sapporo(?: |$)/.test(name) ? CURATED_PLACES["sapporo japanese food"] : null)
    || (/^ritz(?: |$)/.test(name) ? CURATED_PLACES.ritz : null)
    || (/^le ble(?: |$)/.test(name) ? CURATED_PLACES["le ble casa de paes"] : null)
    || (/^ceci(?: |$)/.test(name) ? CURATED_PLACES["ceci panificadora"] : null)
    || (/^requinte(?: |$)/.test(name) ? CURATED_PLACES["panificadora requinte"] : null)
    || (/^primicia(?: |$)/.test(name) ? CURATED_PLACES["primicia dos paes"] : null)
    || (/^estadao(?: |$)/.test(name) ? CURATED_PLACES["estadao bar e lanches"] : null)
    || (/^lellis(?: |$)/.test(name) ? CURATED_PLACES["lellis trattoria"] : null)
    || (/^veridiana(?: |$)/.test(name) ? CURATED_PLACES["veridiana pizzaria"] : null)
    || (/^urbe cafe(?: |$)/.test(name) ? CURATED_PLACES["urbe cafe bar"] : null)
    || (/^banzeiro(?: |$)/.test(name) ? CURATED_PLACES["banzeiro cozinha amazonica"] : null);
  if (!curated) return mapped;

  return {
    ...mapped,
    cuisine: curated.cuisine || mapped.cuisine,
    description: curated.description || mapped.description || "",
    website_url: curated.website_url || mapped.website_url || null,
    menu_url: curated.menu_url || mapped.menu_url || null,
    description_source_url: curated.description_source_url || curated.website_url || null
  };
}
