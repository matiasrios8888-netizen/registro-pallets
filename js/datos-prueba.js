// Productos inventados para probar la app. Hay una fila por código de barras: cada producto
// tiene uno para la caja contenedora y otro para la unidad de venta (U.V), que es la cajita o
// la bolsa de adentro. Como en las etiquetas reales, son de 14 cifras: la contenedora empieza
// con 2 y la U.V con 1, y el resto es igual. Después del primer dígito viene 200, un rango
// reservado para uso interno, así que no pueden coincidir con un producto real. El último
// dígito es el verificador.
export const productosDePrueba = [
  { codigoBarras: '22000000003249', codigoInterno: 'KD0324', descripcion: 'Ficha K3', envase: 'contenedora', unidadesPorCaja: 600 },
  { codigoBarras: '12000000003242', codigoInterno: 'KD0324', descripcion: 'Ficha K3', envase: 'uv', unidadesPorCaja: 150 },
  { codigoBarras: '22000000005007', codigoInterno: 'KD0500', descripcion: 'Caja para tomacorriente', envase: 'contenedora', unidadesPorCaja: 80 },
  { codigoBarras: '12000000005000', codigoInterno: 'KD0500', descripcion: 'Caja para tomacorriente', envase: 'uv', unidadesPorCaja: 10 },
  { codigoBarras: '22000000001108', codigoInterno: 'TC0110', descripcion: 'Tomacorriente doble', envase: 'contenedora', unidadesPorCaja: 120 },
  { codigoBarras: '12000000001101', codigoInterno: 'TC0110', descripcion: 'Tomacorriente doble', envase: 'uv', unidadesPorCaja: 12 },
  { codigoBarras: '22000000015051', codigoInterno: 'PR1505', descripcion: 'Prolongador 5 m', envase: 'contenedora', unidadesPorCaja: 24 },
  { codigoBarras: '12000000015054', codigoInterno: 'PR1505', descripcion: 'Prolongador 5 m', envase: 'uv', unidadesPorCaja: 6 },
];
