// Cobertura real del proveedor de Hermosillo (dato del negocio, 2026-08-11):
// sur de Sonora, limite superior Hermosillo. Es una lista fija de municipios,
// no un radio ni una formula - por eso NO se calcula por coordenadas/CP/colonia,
// se compara contra esta lista. El proveedor la define a nivel municipio, asi
// que checar por codigo postal o colonia seria una precision falsa que la
// propia fuente de datos no tiene.
const COVERED_MUNICIPIOS = [
  "Hermosillo",
  "La Colorada",
  "Guaymas",
  "Empalme",
  "San Javier",
  "Suaqui Grande",
  "Onavas",
  "Soyopa",
  "Cajeme",
  "Bácum",
  "Rosario",
  "Quiriego",
  "San Ignacio Río Muerto",
  "Benito Juárez",
  "Etchojoa",
  "Navojoa",
  "Huatabampo",
  "Álamos",
  "Mazatán",
];

// Nombres alternos / localidades conocidas que caen dentro de un municipio
// cubierto (ej. San Carlos y Bahia de Kino no son municipios, son localidades
// de Guaymas y Hermosillo respectivamente).
const ALIASES = {
  "ciudad obregon": "Cajeme",
  "cd obregon": "Cajeme",
  obregon: "Cajeme",
  cocorit: "Cajeme",
  esperanza: "Cajeme",
  "pueblo yaqui": "Bácum",
  bacum: "Bácum",
  "san carlos": "Guaymas",
  "nuevo guaymas": "Guaymas",
  "bahia de kino": "Hermosillo",
  kino: "Hermosillo",
  alamos: "Álamos",
  mazatan: "Mazatán",
  "san ignacio rio muerto": "San Ignacio Río Muerto",
  "san ignacio": "San Ignacio Río Muerto",
  "benito juarez": "Benito Juárez",
  "rosario de tesopaco": "Rosario",
};

// Lugares que NO estan en la lista del proveedor pero es facil que pregunten -
// se incluyen para responder "no" con seguridad en vez de "no te reconozco".
const KNOWN_NOT_COVERED = [
  "Los Mochis",
  "Guasave",
  "El Fuerte",
  "Ahome",
  "Nogales",
  "Caborca",
  "Santa Ana",
  "Magdalena de Kino",
  "Puerto Peñasco",
  "San Luis Río Colorado",
  "Ures",
  "San Miguel de Horcasitas",
  "Opodepe",
  "Carbó",
];

// Excluidos ademas por regla de negocio (Baja California / cruce a EUA): ni
// siquiera aplica preguntar, no hay ferry ni tramite de frontera.
const EXCLUDED_STATES = ["Mexicali", "Tijuana", "Ensenada", "San Felipe"];

function stripDiacritics(str) {
  return str
    .split("")
    .filter((ch) => {
      const code = ch.codePointAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
}

function normalize(str) {
  return stripDiacritics(String(str || "").toLowerCase().normalize("NFD"))
    .replace(/\s+/g, " ")
    .trim();
}

function matchInList(query, list) {
  return list.find((name) => {
    const n = normalize(name);
    return n === query || query.includes(n) || n.includes(query);
  });
}

function checkCoverage(cityRaw) {
  const query = normalize(cityRaw);

  if (!query) {
    return {
      status: "unknown",
      covered: null,
      city: cityRaw,
      message: "No se dio una ciudad. Pidele al cliente su ciudad o municipio de entrega.",
    };
  }

  const excludedMatch = matchInList(query, EXCLUDED_STATES);
  if (excludedMatch) {
    return {
      status: "excluded",
      covered: false,
      city: excludedMatch,
      message: `${excludedMatch} esta fuera de cobertura (Baja California / cruce a EUA), no manejamos ferry ni tramite de frontera. No se entrega ahi.`,
    };
  }

  const aliasKey = Object.keys(ALIASES).find((key) => {
    const n = normalize(key);
    return n === query || query.includes(n) || n.includes(query);
  });
  const covered = aliasKey ? ALIASES[aliasKey] : matchInList(query, COVERED_MUNICIPIOS);

  if (covered) {
    return {
      status: "covered",
      covered: true,
      city: covered,
      deliveryEta: "mismo dia o dia siguiente",
      shippingCost: "sin costo",
      message: `${covered} si tiene cobertura (proveedor de Hermosillo, sur de Sonora), entrega mismo dia o dia siguiente, sin costo de envio.`,
    };
  }

  const knownOut = matchInList(query, KNOWN_NOT_COVERED);
  if (knownOut) {
    return {
      status: "out_of_range",
      covered: false,
      city: knownOut,
      message: `${knownOut} esta fuera del area de cobertura del proveedor (sur de Sonora, limite Hermosillo). No se entrega ahi, dile al cliente que lo confirme el asesor por si hay otra opcion.`,
    };
  }

  return {
    status: "unknown",
    covered: null,
    city: cityRaw,
    message: `No reconozco "${cityRaw}" en la zona de cobertura. No confirmes entrega ahi, dile al cliente que lo valida el asesor.`,
  };
}

module.exports = { checkCoverage, COVERED_MUNICIPIOS };
