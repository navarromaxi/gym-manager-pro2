-- BIBLIOTECA DE EJERCICIOS CON VIDEOS PARA ENTRENAMIENTO ONLINE
--
-- Ejecutar en Supabase > SQL Editor una sola vez.
-- Es idempotente: agrega los ejercicios que falten y completa los enlaces de
-- ejercicios existentes, sin tocar las bibliotecas de los gimnasios clientes.
--
-- Los enlaces de YouTube abren demostraciones o búsquedas cortas del movimiento.
-- El profesor puede editar cualquier enlace desde Ejercicios cuando prefiera
-- usar un video propio o de otro canal.

with items(name, category, instructions, video_url) as (
  values
    ('Sentadilla con peso corporal', 'Fuerza', 'Apoyá el peso en todo el pie, llevá la cadera atrás y controlá la bajada.', 'https://www.youtube.com/results?search_query=sentadilla+con+peso+corporal+tecnica+short'),
    ('Sentadilla goblet', 'Fuerza', 'Mantené el pecho alto, rodillas alineadas y bajá con control.', 'https://www.youtube.com/watch?v=AYJ8VDCS1mU'),
    ('Sentadilla búlgara', 'Fuerza', 'Mantené el torso estable y bajá en línea con la pierna delantera.', 'https://www.youtube.com/results?search_query=sentadilla+bulgara+tecnica+short'),
    ('Zancada hacia atrás', 'Fuerza', 'Dá un paso atrás largo, mantené el torso estable y la rodilla alineada.', 'https://www.youtube.com/results?search_query=zancada+hacia+atras+tecnica+short'),
    ('Step up', 'Fuerza', 'Subí controlando la rodilla y bajá sin dejarte caer.', 'https://www.youtube.com/results?search_query=step+up+ejercicio+tecnica+short'),
    ('Peso muerto rumano', 'Fuerza', 'Llevá la cadera hacia atrás y mantené la espalda neutra.', 'https://www.youtube.com/watch?v=sxMZ4Z98wYw'),
    ('Hip thrust', 'Fuerza', 'Empujá desde los talones y terminá con la pelvis neutra, sin hiperextender.', 'https://www.youtube.com/results?search_query=hip+thrust+tecnica+short'),
    ('Puente de glúteos', 'Fuerza', 'Empujá desde los talones y evitá arquear la zona lumbar.', 'https://www.youtube.com/results?search_query=puente+de+gluteos+tecnica+short'),
    ('Elevación de talones', 'Fuerza', 'Subí y bajá lento, manteniendo el apoyo estable.', 'https://www.youtube.com/results?search_query=elevacion+de+talones+tecnica+short'),
    ('Press de pecho con mancuernas', 'Fuerza', 'Escápulas apoyadas y muñecas alineadas con los antebrazos.', 'https://www.youtube.com/watch?v=yORv6hLsYhE'),
    ('Flexiones', 'Fuerza', 'Mantené el cuerpo en bloque y no dejes caer la cintura.', 'https://www.youtube.com/results?search_query=flexiones+tecnica+short'),
    ('Remo con mancuerna', 'Fuerza', 'Llevá el codo hacia la cadera sin girar el torso.', 'https://www.youtube.com/watch?v=cJBURBEwJMA'),
    ('Jalón al pecho', 'Fuerza', 'Bajá la barra hacia la parte alta del pecho sin llevar el cuello adelante.', 'https://www.youtube.com/watch?v=AOpi-p0cJkc'),
    ('Remo sentado en polea', 'Fuerza', 'Iniciá el movimiento con la espalda y llevá los codos hacia atrás.', 'https://www.youtube.com/results?search_query=remo+sentado+polea+tecnica+short'),
    ('Press militar con mancuernas', 'Fuerza', 'Activá el abdomen y subí sin arquear la espalda.', 'https://www.youtube.com/results?search_query=press+militar+mancuernas+tecnica+short'),
    ('Elevaciones laterales', 'Fuerza', 'Subí los brazos con control y sin encoger los hombros.', 'https://www.youtube.com/results?search_query=elevaciones+laterales+tecnica+short'),
    ('Curl de bíceps con mancuerna', 'Fuerza', 'Mantené los codos cerca del cuerpo y evitá balancearte.', 'https://www.youtube.com/results?search_query=curl+biceps+mancuerna+tecnica+short'),
    ('Extensión de tríceps en polea', 'Fuerza', 'Fijá los codos y extendé sin mover los hombros.', 'https://www.youtube.com/results?search_query=extension+triceps+polea+tecnica+short'),

    ('Plancha frontal', 'Zona media', 'Mantené una línea recta de hombros a talones y respiración controlada.', 'https://www.youtube.com/results?search_query=plancha+frontal+tecnica+short'),
    ('Plancha lateral', 'Zona media', 'Elevá la cadera y sostené el cuerpo alineado.', 'https://www.youtube.com/results?search_query=plancha+lateral+tecnica+short'),
    ('Dead bug', 'Zona media', 'Mantené la zona lumbar pegada al suelo mientras alternás brazos y piernas.', 'https://www.youtube.com/results?search_query=dead+bug+tecnica+short'),
    ('Bird dog', 'Zona media', 'Extendé brazo y pierna contraria sin mover la cadera.', 'https://www.youtube.com/results?search_query=bird+dog+tecnica+short'),
    ('Pallof press', 'Zona media', 'Resistí la rotación manteniendo el tronco estable.', 'https://www.youtube.com/results?search_query=pallof+press+tecnica+short'),
    ('Crunch corto', 'Zona media', 'Mové el tronco corto sin tirar del cuello.', 'https://www.youtube.com/results?search_query=crunch+abdominal+tecnica+short'),

    ('Movilidad de cadera 90/90', 'Movilidad', 'Mové ambas caderas lento y sin dolor.', 'https://www.youtube.com/results?search_query=movilidad+cadera+90+90+short'),
    ('Movilidad torácica', 'Movilidad', 'Rotá desde la parte media de la espalda, no desde la zona lumbar.', 'https://www.youtube.com/results?search_query=movilidad+toracica+short'),
    ('Círculos de hombros', 'Movilidad', 'Hacé círculos amplios y controlados en ambos sentidos.', 'https://www.youtube.com/results?search_query=circulos+hombros+movilidad+short'),
    ('Rotación externa con banda', 'Movilidad', 'Mantené el codo pegado al cuerpo y mové el antebrazo con control.', 'https://www.youtube.com/results?search_query=rotacion+externa+banda+tecnica+short'),
    ('Gato camello', 'Movilidad', 'Mové la columna de forma suave siguiendo la respiración.', 'https://www.youtube.com/results?search_query=gato+camello+movilidad+short'),

    ('Estiramiento posterior de pierna', 'Estiramiento', 'Buscá tensión suave, sin rebotes ni dolor.', 'https://www.youtube.com/results?search_query=estiramiento+isquiotibiales+short'),
    ('Estiramiento de cuádriceps', 'Estiramiento', 'Llevá el talón hacia el glúteo manteniendo la pelvis neutra.', 'https://www.youtube.com/results?search_query=estiramiento+cuadriceps+short'),
    ('Estiramiento de flexores de cadera', 'Estiramiento', 'Avanzá la pelvis suave sin arquear la espalda.', 'https://www.youtube.com/results?search_query=estiramiento+flexores+cadera+short'),
    ('Estiramiento de pectoral', 'Estiramiento', 'Abrí el pecho de forma gradual sin dolor en el hombro.', 'https://www.youtube.com/results?search_query=estiramiento+pectoral+pared+short'),

    ('Caminata', 'Cardio', 'Usá un ritmo continuo que permita hablar con algo de esfuerzo.', 'https://www.youtube.com/results?search_query=caminata+cardio+tecnica+short'),
    ('Bicicleta estática', 'Cardio', 'Ajustá asiento y resistencia según el objetivo indicado.', 'https://www.youtube.com/results?search_query=bicicleta+estatica+ajuste+short'),
    ('Remo ergómetro', 'Cardio', 'Empujá primero con las piernas, luego tronco y por último brazos.', 'https://www.youtube.com/results?search_query=remo+ergometro+tecnica+short'),
    ('Saltar la cuerda', 'Cardio', 'Mantené saltos bajos y muñecas relajadas.', 'https://www.youtube.com/results?search_query=saltar+cuerda+tecnica+short')
), updated as (
  update public.exercise_library existing
  set
    category = item.category,
    instructions = coalesce(nullif(existing.instructions, ''), item.instructions),
    video_url = coalesce(nullif(existing.video_url, ''), item.video_url),
    is_active = true,
    updated_at = now()
  from items item
  where existing.gym_id = 'entrenamiento_online'
    and lower(existing.name) = lower(item.name)
  returning existing.id
)
insert into public.exercise_library (gym_id, name, category, instructions, video_url)
select 'entrenamiento_online', item.name, item.category, item.instructions, item.video_url
from items item
where not exists (
  select 1
  from public.exercise_library existing
  where existing.gym_id = 'entrenamiento_online'
    and lower(existing.name) = lower(item.name)
);

-- Comprobación esperada: 36 ejercicios activos o más.
select category, count(*) as ejercicios
from public.exercise_library
where gym_id = 'entrenamiento_online' and is_active = true
group by category
order by category;
