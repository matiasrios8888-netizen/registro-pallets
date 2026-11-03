// Arranque de la app y navegación entre las tres pantallas.
import { modoPrueba } from './datos.js';
import { alMostrarEscaneo, alOcultarEscaneo, iniciarPantallaEscaneo } from './pantalla-escaneo.js';
import { alMostrarHistorial, iniciarPantallaHistorial } from './pantalla-historial.js';
import { iniciarProductos } from './productos.js';
import { iniciarSesion } from './sesion.js';

const botonesNavegacion = document.querySelectorAll('[data-pantalla]');

// Muestra una pantalla ("escaneo", "historial" o "productos"), oculta las otras, marca su
// botón en la barra y le avisa a cada pantalla para que se actualice.
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

// Con Firebase, las pantallas arrancan recién cuando alguien entró: sin sesión, la base no deja
// leer nada.
await iniciarSesion();
iniciarProductos();
iniciarPantallaEscaneo();
iniciarPantallaHistorial();
