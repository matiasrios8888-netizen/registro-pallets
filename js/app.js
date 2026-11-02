// Arranque de la app y navegación entre las tres pantallas.
import { modoPrueba } from './datos.js';
import { alMostrarEscaneo, alOcultarEscaneo, iniciarPantallaEscaneo } from './pantalla-escaneo.js';
import { alMostrarHistorial, iniciarPantallaHistorial } from './pantalla-historial.js';
import { iniciarProductos } from './productos.js';

const botonesNavegacion = document.querySelectorAll('[data-pantalla]');

function irA(pantalla) {
  document.querySelectorAll('.pantalla').forEach((seccion) => {
    seccion.hidden = seccion.id !== `pantalla-${pantalla}`;
  });
  botonesNavegacion.forEach((boton) => {
    if (boton.dataset.pantalla === pantalla) boton.setAttribute('aria-current', 'page');
    else boton.removeAttribute('aria-current');
  });

  if (pantalla === 'escaneo') alMostrarEscaneo();
  else alOcultarEscaneo();
  if (pantalla === 'historial') alMostrarHistorial();
}

botonesNavegacion.forEach((boton) => {
  boton.addEventListener('click', () => irA(boton.dataset.pantalla));
});

document.getElementById('banner-modo-prueba').hidden = !modoPrueba;

iniciarProductos();
iniciarPantallaEscaneo();
iniciarPantallaHistorial();
