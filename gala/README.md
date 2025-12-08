Gala de Premios - Votaciones

Descripción

Página local para votar en varias categorías (ejemplos: "MIEMBRO MAS ANTIGUO", "CLIP DEL DISCORD", etc.). Los votos se guardan en localStorage del navegador, por lo que cada navegador puede votar una vez por categoría.

Nueva funcionalidad: Visor de clips y edición local

- Cada nominado tiene un botón "Ver clips" que abre un modal con clips relacionados (pueden ser enlaces de YouTube embebidos o videos locales).
- Añadida UI de edición local: pulsa "Editar nominados" en cualquier categoría para abrir un modal donde puedes:
  - Añadir un nominado (nombre) y hasta 3 clips (título + URL).
  - Ver y eliminar nominados existentes.
- Los nominados y sus clips se guardan en `localStorage` bajo la llave `gala_nominees_v1`.

Cómo usar

1. Abrir `index.html` en un navegador moderno (Chrome, Edge, Firefox).
2. Navegar entre categorías (cada categoría ocupa la pantalla). Haz click en "Votar (provisional)" para votar; tras votar se desplazará a la siguiente categoría.
3. Para añadir nominados y clips: pulsa "Editar nominados" en la categoría deseada, rellena el formulario y guarda. Los datos se guardarán localmente.
4. Para ver clips: pulsa "Ver clips" en el nominado o en uno de los apartados.
5. Para pruebas, utiliza "Restablecer votos (local)" para borrar los votos guardados en este navegador; los nominados en `localStorage` no se borran con ese botón.

Notas técnicas

- Esta implementación es solo frontend y guarda datos en `localStorage`. Para producción necesitas un backend que maneje votos y archivos multimedia.
- Los enlaces a YouTube se convierten automáticamente a su versión embebida cuando es posible.
- Si quieres, puedo añadir export/import de nominados a un JSON para facilitar migración o editar múltiples nominados fuera del navegador.

Lista de categorías (orden actual)

1. MIEMBRO MAS ANTIGUO
2. MAYOR CANTIDAD DE MENSAJES ENVIADOS
3. MAYOR CANTIDAD DE INSULTOS DICHOS
4. EL MÁS LLORÓN
5. EL QUE ESTÁ PERO NO ESTÁ
6. EL DESAPARECIDO
7. EL DEL MICRO PREHISTORICO
8. EL TIESO
9. EL DEL SPOTIFY
10. EL ANTICAMPAÑAS
11. EL MÁS COJO
12. EL TRYHARD QUE NADIE PIDIÓ
13. RAGEBAITER PROFESIONAL
14. EL MÁS MARICÓN
15. EL QUE SIEMPRE PIDE ROLES
16. EL DORMILÓN DEL AÑO
17. MASCOTA DEL AÑO
18. MEJOR SUSTO
19. MAYOR FAIL
20. CLIP DEL DISCORD

Archivos

- `index.html` - Estructura de la página y categorías.
- `styles.css` - Estilos.
- `script.js` - Lógica de votación, almacenamiento local, visor de clips y UI de edición de nominados.

Siguientes pasos

- Añadir export/import JSON para nominados.
- Implementar backend para centralizar votos y clips.
- Añadir validaciones y límite por dispositivo/usuario si se requiere control más fuerte de votos.