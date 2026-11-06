// Productos inventados para probar la app. Hay una fila por código de barras: cada producto
// tiene uno para la caja contenedora y otro para la unidad de venta (U.V), que es la cajita o
// la bolsa de adentro. Como en las etiquetas reales, son de 14 cifras: la contenedora empieza
// con 2 y la U.V con 1, y el resto es igual. Después del primer dígito viene 200, un rango
// reservado para uso interno, así que no pueden coincidir con un producto real. El último
// dígito es el verificador. cajasPorPallet: cuántas contenedoras llenan un pallet.
export const productosDePrueba = [
  { codigoBarras: '22000000003249', codigoInterno: 'KD0324', descripcion: 'Ficha K3', envase: 'contenedora', unidadesPorCaja: 600, cajasPorPallet: 30 },
  { codigoBarras: '12000000003242', codigoInterno: 'KD0324', descripcion: 'Ficha K3', envase: 'uv', unidadesPorCaja: 150 },
  { codigoBarras: '22000000005007', codigoInterno: 'KD0500', descripcion: 'Caja para tomacorriente', envase: 'contenedora', unidadesPorCaja: 80, cajasPorPallet: 40 },
  { codigoBarras: '12000000005000', codigoInterno: 'KD0500', descripcion: 'Caja para tomacorriente', envase: 'uv', unidadesPorCaja: 10 },
  { codigoBarras: '22000000001108', codigoInterno: 'TC0110', descripcion: 'Tomacorriente doble', envase: 'contenedora', unidadesPorCaja: 120, cajasPorPallet: 36 },
  { codigoBarras: '12000000001101', codigoInterno: 'TC0110', descripcion: 'Tomacorriente doble', envase: 'uv', unidadesPorCaja: 12 },
  { codigoBarras: '22000000015051', codigoInterno: 'PR1505', descripcion: 'Prolongador 5 m', envase: 'contenedora', unidadesPorCaja: 24, cajasPorPallet: 18 },
  { codigoBarras: '12000000015054', codigoInterno: 'PR1505', descripcion: 'Prolongador 5 m', envase: 'uv', unidadesPorCaja: 6 },
];

// COOIS inventada: las órdenes de producción, como las exportaría SAP. Los nombres de las
// columnas no son los de la app, a propósito: así se prueba que al importar se elige qué columna
// es cada dato. Hay productos con varias órdenes abiertas, una orden ya completa que no se
// importa y un código que no está en Productos.
export const columnasCooisDePrueba = [
  'Orden', 'Material', 'Texto breve de material', 'Cantidad orden', 'Cantidad entregada',
  'Cantidad pendiente', 'Fecha inicio', 'Centro',
];

export const cooisDePrueba = [
  [1000440, 'KD0324', 'Ficha K3', 6000, 6000, 0, '2026-10-10', '1000'],
  [1000449, 'PR1505', 'Prolongador 5 m', 480, 432, 48, '2026-10-18', '1000'],
  [1000451, 'KD0324', 'Ficha K3', 6000, 4800, 1200, '2026-10-20', '1000'],
  [1000455, 'KD0500', 'Caja para tomacorriente', 1600, 1440, 160, '2026-10-22', '1000'],
  [1000460, 'TC0110', 'Tomacorriente doble', 2400, 1200, 1200, '2026-10-25', '1000'],
  [1000467, 'KD0324', 'Ficha K3', 12000, 0, 12000, '2026-10-28', '1000'],
  [1000470, 'KD0999', 'Ficha K5', 3000, 0, 3000, '2026-10-30', '1000'],
  [1000478, 'KD0500', 'Caja para tomacorriente', 3200, 0, 3200, '2026-11-02', '1000'],
  [1000482, 'KD0324', 'Ficha K3', 6000, 0, 6000, '2026-11-03', '1000'],
  [1000485, 'PR1505', 'Prolongador 5 m', 960, 0, 960, '2026-11-04', '1000'],
];
