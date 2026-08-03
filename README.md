# License Exam System

Mi propuesta

No le vamos a pedir a Lovable que haga "un formulario".

Le vamos a pedir que construya un Sistema Integral de Evaluación para Licencias de Conducir.

Ese cambio de enfoque hace una diferencia enorme.

Fase 1 (la que vamos a hacer)

La IA debe crear:

✅ Login

✅ Base de datos

✅ Panel Administrador

✅ Panel Inspector

✅ Panel Aspirante

✅ Banco de preguntas

✅ Corrección automática

✅ Historial

✅ Estadísticas

El Administrador podrá

 Crear inspectores.

 Crear administradores.

 Agregar preguntas.

 Editar preguntas.

 Eliminar preguntas.

 Marcar preguntas eliminatorias.

 Cambiar el puntaje de cada pregunta.

 Configurar cantidad de preguntas.

 Configurar tiempo del examen.

 Configurar máximo de errores.

 Ver estadísticas.

 Exportar resultados en PDF y Excel.

El Inspector podrá

Buscar al aspirante por:

 DNI

 Correo

 Apellido

Y verá algo como:

Juan Pérez

Clase B

Estado

○ Esperando

○ Habilitado

○ Rindiendo

○ Finalizado

○ Aprobado

○ Desaprobado

Botones:

 Habilitar examen

 Cancelar examen

 Reiniciar intento (si corresponde)

 Ver historial

Esta función me parece fundamental

Vos dijiste algo muy importante:

"Quiero decidir yo cuándo puede volver a rendir."

Entonces la lógica sería:

Si el alumno desaprueba

↓

Queda bloqueado

↓

Solo un inspector puede habilitar otro intento.

O sea que el sistema no desbloquea automáticamente al día siguiente.

Queda a criterio de la Dirección de Tránsito.

Eso te da mucho más control.

Banco de preguntas

Cada pregunta tendrá información como:

Pregunta

Clase

Tema

Respuesta correcta

Tres respuestas incorrectas

Nivel

Peso

Eliminatoria

Activa

Ejemplo:

Clase

B

Tema

Prioridades

Nivel

Fácil

Eliminatoria

NO

Otra:

Clase

A

Tema

Casco

Nivel

Difícil

Eliminatoria

SI

Examen aleatorio

Supongamos que para Clase B tenés:

320 preguntas.

El examen elegirá automáticamente:

 8 Prioridades

 6 Señales

 5 Velocidades

 5 Documentación

 4 Seguridad

 2 Primeros Auxilios

Y todas diferentes.

Además mezclará:

 el orden de las preguntas;

 el orden de las respuestas.

Dos personas sentadas juntas prácticamente nunca tendrán el mismo examen.

Preguntas eliminatorias

Esta es una de las mejores ideas del proyecto.

Por ejemplo:

No respetar una prioridad de paso.

Conducir alcoholizado.

Cruzar un semáforo rojo.

Uso del casco.

Esas preguntas pueden estar marcadas como:

ELIMINATORIA = TRUE

Entonces:

Si responde mal

↓

Desaprobado

↓

Finaliza examen.

Sin importar el resto del puntaje.

Medidas para evitar trampas

Como hablamos antes, en un celular personal no existe un bloqueo absoluto, pero sí podemos dificultarlo mucho.

El sistema puede:

 registrar cuándo el navegador pierde el foco;

 guardar cuántas veces el usuario salió de la pantalla del examen;

 mostrar advertencias;

 permitir que el inspector anule un examen si detecta un comportamiento irregular.

Y, sobre todo, combinar eso con la habilitación presencial del examen.

Base de datos

Imagino algo así:

Usuarios

↓

Inspectores

↓

Aspirantes

↓

Licencias

↓

Preguntas

↓

Opciones

↓

Exámenes

↓

Respuestas

↓

Resultados

↓

Auditoría

Todo relacionado.

Algo que agregaría

Un módulo de estadísticas.

Por ejemplo:

Clase B

Aprobados

81%

Desaprobados

19%

También:

Pregunta 125

Incorrecta

87%


Eso te muestra cuáles son las preguntas que más dificultades generan y puede ayudarte a mejorar tus clases.

Lo que yo haría

En lugar de escribir un único prompt para Lovable, prepararía un proyecto en tres etapas:

Documento 1

Especificación funcional (como si la hubiera redactado un analista de sistemas).

Documento 2

Prompt maestro para Lovable, optimizado para que genere la aplicación siguiendo esa especificación.

Documento 3

Prompts de continuación, porque un proyecto de este tamaño normalmente requiere varias iteraciones. Cada prompt agregará módulos específicos (administración, banco de preguntas, estadísticas, importación de cuestionarios, etc.) sin romper lo que ya esté construido.

Creo que este puede ser un proyecto muy interesante

No solo resolvería la toma de exámenes de la Dirección de Tránsito, sino que podría convertirse en una plataforma completa para gestionar aspirantes, controlar evaluaciones, mantener un historial de resultados y generar estadísticas útiles para la capacitación.

Y te hago una propuesta adicional: no carguemos las preguntas una por una. Los cuestionarios que subiste ya contienen gran parte del contenido. Podemos convertirlos en un formato estructurado (por ejemplo, una planilla o un archivo JSON con clase, tema, pregunta, opciones, respuesta correcta y si es eliminatoria) para que Lovable los importe automáticamente. Eso te va a ahorrar muchas horas de trabajo.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://siedtransitosanjodeentrerios.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/78cc2724-8e59-4363-99e2-f3eb8a4295c6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
