// Traslapes confirmados por el negocio (2026-08-10):
// - Galvanizada: ancho nominal 0.82m, traslape lateral 10cm -> ancho util 0.72m.
// - Plastiteja: ancho nominal 1.05m, traslape lateral 15cm -> ancho util 0.90m.
// - Traslape de punta (unir dos piezas en el largo): normalmente NO aplica, el cliente
//   elige el largo comercial que cubre su pendiente. En el caso raro que se necesite, 15cm.
//
// Solo se calculan piezas para productos con traslape/desperdicio confirmado
// por el negocio. Zintro Alum ya tiene precio y medida real (2026-08-13,
// proveedor Hermosillo) pero el traslape lateral para cubrir m2 no esta
// confirmado todavia (es parecido a galvanizada pero no se asume igual sin
// que el negocio lo diga) - por eso sigue sin calculo de piezas, aunque ya
// se le puede dar precio por pieza normal.
const TRASLAPE_PUNTA_M = 0.15;
const BARRA_ESTRUCTURAL_M = 6;

const LAMINA_SPECS = {
  galvanizada: {
    label: "Lamina galvanizada",
    anchoNominalM: 0.82,
    anchoUtilM: 0.72,
    largosM: [6.10, 5.50, 4.88, 4.27, 3.66, 3.05, 2.44],
  },
  plastiteja: {
    label: "Plastiteja",
    // Actualizado 2026-08-13: cambio de proveedor (Hermosillo), ancho nominal
    // 1.00m (antes 1.05m). Se mantiene el traslape lateral de 15cm confirmado
    // por el negocio para esta familia de producto -> util 0.85m.
    anchoNominalM: 1.00,
    anchoUtilM: 0.85,
    largosM: [7.15, 6.15, 5.00, 4.60, 4.00, 3.66, 3.05, 2.50, 1.50, 1.10],
  },
};

// Reconocidos pero sin ficha de medidas/precio confirmada todavia.
const SIN_DATOS_CONFIRMADOS = new Set(["zintro_alum"]);

const PRODUCTO_ALIASES = {
  galvanizada: "galvanizada",
  lamina: "galvanizada",
  "lamina galvanizada": "galvanizada",
  zintro: "zintro_alum",
  "zintro alum": "zintro_alum",
  "zintro-alum": "zintro_alum",
  plastiteja: "plastiteja",
  teja: "plastiteja",
};

function normalizeKey(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function resolveSpec(producto) {
  const key = normalizeKey(producto);
  const specKey = PRODUCTO_ALIASES[key] || key;
  if (SIN_DATOS_CONFIRMADOS.has(specKey)) {
    return { specKey, spec: null, sinDatos: true };
  }
  if (!LAMINA_SPECS[specKey]) return null;
  return { specKey, spec: LAMINA_SPECS[specKey] };
}

// Numero de piezas para cubrir `largoObjetivoM` en el sentido del largo,
// usando piezas de `largoPiezaM` con traslape de punta `traslapeM` entre ellas.
function piezasParaLargo(largoObjetivoM, largoPiezaM, traslapeM) {
  const avanceporPieza = largoPiezaM - traslapeM;
  if (largoObjetivoM <= largoPiezaM) return 1;
  return 1 + Math.ceil((largoObjetivoM - largoPiezaM) / avanceporPieza);
}

function calcLaminaPieces({ producto, anchoCubrirM, largoPendienteM }) {
  const resolved = resolveSpec(producto);
  if (!resolved) {
    return { error: `Producto "${producto}" no reconocido. Usa galvanizada o plastiteja.` };
  }
  if (resolved.sinDatos) {
    return {
      producto,
      sinDatosConfirmados: true,
      nota: "Este producto tiene precio por pieza, pero el traslape para calcular cuantas piezas cubren un area todavia no esta confirmado. No calcules piezas ni asumas que es igual a otro producto: dile al cliente que la cantidad exacta se confirma con el asesor.",
    };
  }
  const { specKey, spec } = resolved;
  const ancho = Number(anchoCubrirM);
  const largo = Number(largoPendienteM);
  if (!(ancho > 0) || !(largo > 0)) {
    return { error: "Se necesita ancho a cubrir y largo de pendiente, ambos en metros y mayores a 0." };
  }

  const piezasAncho = Math.ceil(ancho / spec.anchoUtilM);
  const largoMax = Math.max(...spec.largosM);
  const casoEspecial = largo > largoMax;

  let largoPiezaElegido;
  let piezasLargo;
  if (casoEspecial) {
    largoPiezaElegido = largoMax;
    piezasLargo = piezasParaLargo(largo, largoMax, TRASLAPE_PUNTA_M);
  } else {
    largoPiezaElegido = spec.largosM
      .filter((l) => l >= largo)
      .sort((a, b) => a - b)[0];
    piezasLargo = 1;
  }

  const piezasPorColumna = piezasLargo;
  const totalPiezas = piezasAncho * piezasPorColumna;

  return {
    producto: spec.label,
    anchoUtilPorPiezaM: spec.anchoUtilM,
    largoPiezaRecomendadoM: largoPiezaElegido,
    piezasAncho,
    piezasLargo: piezasPorColumna,
    piezasNecesarias: totalPiezas,
    casoEspecialTraslapeDePunta: casoEspecial,
    nota: casoEspecial
      ? `La pendiente (${largo}m) excede el largo comercial maximo (${largoMax}m): se necesita unir piezas con traslape de punta de ${TRASLAPE_PUNTA_M}m. Esto es un caso raro, confirmarlo con el asesor.`
      : "Estimado de piezas. Se confirma con pendiente real, remates y desperdicio en sitio.",
  };
}

function calcLaminaPiecesFromArea({ producto, areaM2 }) {
  const resolved = resolveSpec(producto);
  if (!resolved) {
    return { error: `Producto "${producto}" no reconocido. Usa galvanizada o plastiteja.` };
  }
  if (resolved.sinDatos) {
    return {
      producto,
      sinDatosConfirmados: true,
      nota: "Este producto tiene precio por pieza, pero el traslape para calcular cuantas piezas cubren un area todavia no esta confirmado. No calcules piezas ni asumas que es igual a otro producto: dile al cliente que la cantidad exacta se confirma con el asesor.",
    };
  }
  const { spec } = resolved;
  const area = Number(areaM2);
  if (!(area > 0)) {
    return { error: "Se necesita un area en m2 mayor a 0." };
  }

  const largoRef = spec.largosM.slice().sort((a, b) => a - b)[Math.floor(spec.largosM.length / 2)];
  const coberturaPorPieza = spec.anchoUtilM * largoRef;
  const piezasAprox = Math.ceil(area / coberturaPorPieza);

  return {
    producto: spec.label,
    approx: true,
    piezasNecesarias: piezasAprox,
    largoPiezaUsadoParaEstimarM: largoRef,
    nota: "Estimado solo con area total (asume un largo de pieza tipico). Para un numero exacto de piezas pide ancho a cubrir y largo de pendiente por separado.",
  };
}

function calcBarrasEstructurales({ metrosLinealesM }) {
  const metros = Number(metrosLinealesM);
  if (!(metros > 0)) {
    return { error: "Se necesitan los metros lineales requeridos, mayor a 0." };
  }
  const piezas = Math.ceil(metros / BARRA_ESTRUCTURAL_M);
  return {
    barraComercialM: BARRA_ESTRUCTURAL_M,
    piezasNecesarias: piezas,
    metrosCubiertos: piezas * BARRA_ESTRUCTURAL_M,
    sobranteM: Number((piezas * BARRA_ESTRUCTURAL_M - metros).toFixed(2)),
    nota: "Convierte metros lineales ya definidos a numero de piezas de 6m. No define separacion ni diseno estructural: eso lo valida el asesor por seguridad.",
  };
}

module.exports = {
  LAMINA_SPECS,
  TRASLAPE_PUNTA_M,
  BARRA_ESTRUCTURAL_M,
  calcLaminaPieces,
  calcLaminaPiecesFromArea,
  calcBarrasEstructurales,
};
