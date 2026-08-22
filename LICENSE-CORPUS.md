# Procedencia y términos del corpus

`LICENSE` (MIT) cubre **el código y los artefactos derivados de este proyecto**. No cubre —ni
podría— el texto de Leonardo da Vinci ni la traducción de J.P. Richter, que no son míos. Este
archivo dice qué es cada cosa, para que nadie tenga que adivinarlo.

Todo lo que sigue lo verifica `npm run procedencia`.

## La obra

**The Notebooks of Leonardo Da Vinci**, traducidos y editados por **Jean Paul Richter**, 1888.
Distribuida por Project Gutenberg como el eBook **#5000**.

La traducción de Richter es de 1888: **está en dominio público por antigüedad**. Lo que la licencia
de Project Gutenberg protege no es la obra sino **su marca**.

## Los archivos, y bajo qué términos está cada uno

| ruta | qué es | términos |
|---|---|---|
| `pipeline/raw/pg5000.txt`<br>`pipeline/raw/pg5000-images.html` | Copias **literales y sin modificar** del eBook de Project Gutenberg, con su cabecera, sus delimitadores y el texto completo de su licencia | **Project Gutenberg License**, incluida dentro de los propios archivos |
| `artifacts/chunks.json` y demás artefactos derivados en inglés | Texto de Richter parseado, segmentado y anotado. **Sin cabecera, sin marca y sin el aparato legal de Gutenberg** | El texto subyacente es **dominio público**. La estructura, el parseo y las anotaciones, MIT |
| `artifacts/chunks_es.json` | Traducción al castellano hecha por este proyecto (ver `docs/09-decisiones.md`, D-079 y D-125) | MIT, junto con el resto de este repositorio |
| `src/`, `app/`, `tools/`, `evals/`, `pipeline/*.py` | El código | **MIT** (`LICENSE`) |

**Por qué los archivos crudos conservan la marca y los derivados no.** Son las dos caras de la
misma licencia: para redistribuir la obra *marcada* tal cual hay que conservar su cabecera y sus
términos, y eso es exactamente lo que hacen los archivos de `pipeline/raw/`. Para el texto derivado
no hace falta, porque lo que queda es la obra de dominio público sin la marca — y de hecho
**no debe** llevar el aparato legal adentro: ese texto no es de Leonardo ni de Richter, y este
sistema lo recuperaría y lo citaría como si lo fuera.

`npm run procedencia` comprueba las dos cosas: que los crudos conserven cabecera y licencia, y que
haya **cero boilerplate de Gutenberg dentro del corpus servido** (medido: 0 de 2.062 chunks, en los
dos idiomas).

## Atribución

1.492 chunks llevan un campo `url` que apunta al pasaje correspondiente en `gutenberg.org`. Es
**atribución de la fuente**, no uso de la marca: cualquiera puede ir al original y comprobar que el
pasaje dice lo que este sistema afirma que dice. Es el mecanismo central del proyecto, no un
formalismo.

## El volumen de contexto de la biblioteca, que NO es corpus

`public/biblioteca/wikipedia.json` lo genera `npm run wikipedia` a partir del artículo **«Leonardo
da Vinci»** de Wikipedia en castellano y en inglés. Es el quinto tomo de la estantería (D-155).

| | |
|---|---|
| **Términos** | **CC BY-SA 4.0** — <https://creativecommons.org/licenses/by-sa/4.0/> |
| **Autor** | Los colaboradores de Wikipedia |
| **Atribución** | Viaja **dentro del JSON**: título, autor colectivo, número de revisión, fecha de consulta y enlace al artículo. No hay forma de servir el texto sin ella. En pantalla se imprime en el **colofón**, la última hoja del tomo, que es donde un libro pone quién lo hizo (D-157) |

**No es MIT y no puede serlo**: CC BY-SA es una licencia recíproca. El resto del repositorio sigue
siendo MIT; lo que está bajo CC BY-SA es ese archivo y nada más.

**Y no es corpus.** No se indexa, no se recupera, `responder()` no lo ve y ninguna cita sale de
ahí. El «0% de citas inventadas» se mide contra Richter y sólo contra Richter (D-018, D-026): este
tomo es material que se mira en la biblioteca, como las 27 láminas. El propio volumen lo dice en su
portadilla, antes de la primera línea de texto.

## El modelo 3D del museo, que tampoco es corpus

`public/museo/visitante.glb` es el único modelo 3D del proyecto y **no lo hicimos nosotros**: es el
personaje que uno maneja en la sala (D-166).

| | |
|---|---|
| **Qué es** | «Business Man», del *Ultimate Modular Men Pack* |
| **Autor** | **Quaternius** — <https://quaternius.com> |
| **De dónde** | <https://poly.pizza/m/JFrLIKqvCH> |
| **Términos** | **CC0 1.0 Universal** (dominio público) — <https://creativecommons.org/publicdomain/zero/1.0/> |
| **Atribución** | **No la exige.** CC0 es una renuncia: se puede usar, modificar y redistribuir, comercialmente, sin pedir permiso ni acreditar. Queda anotado igual, que es lo mínimo que se le debe a alguien que regala su trabajo |

**No hay conflicto con MIT.** CC0 no es recíproca: a diferencia del tomo de Wikipedia, más arriba,
este archivo no arrastra ninguna condición sobre el resto del repositorio.

**Ningún byte se descarga si no se entra a la sala.** Mismo criterio que las nueve obras y que el
propio motor 3D: el `import()` dinámico vive adentro del botón «Entrar al museo» (D-162).

Hubo además un sombrero y un sillón, que ya no están (D-167 a D-171). El sombrero era la única pieza
no-CC0 que llegó a entrar al repositorio; se fue con él.

## La cadena de traducción, declarada

El italiano de Leonardo → el inglés de Richter (1888) → el castellano de este proyecto. **Son tres
eslabones** y el castellano está a dos traducciones del original. Se declara en vez de disimularse.

---

Esto describe la procedencia con la precisión que el proyecto puede sostener; no es asesoramiento
legal. Si vas a reutilizar el corpus, la fuente autorizada sobre los términos de Project Gutenberg
es <https://www.gutenberg.org/policy/license.html>.
