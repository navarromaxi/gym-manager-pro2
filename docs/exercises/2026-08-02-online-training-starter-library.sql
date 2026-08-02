-- BIBLIOTECA INICIAL PARA ENTRENAMIENTO ONLINE
-- Ejecutar una sola vez. Crea una base de ejercicios reutilizables para el
-- profesor; puede editar indicaciones o cambiar cualquier video luego.
-- No toca las bibliotecas de los gimnasios existentes.

insert into public.exercise_library (gym_id, name, category, instructions, video_url)
select 'entrenamiento_online', item.name, item.category, item.instructions, item.video_url
from (values
  ('Sentadilla goblet', 'Fuerza', 'Mantené pecho alto, rodillas alineadas y bajá con control.', 'https://www.youtube.com/watch?v=AYJ8VDCS1mU'),
  ('Sentadilla con peso corporal', 'Fuerza', 'Apoyá el peso en todo el pie y controlá la bajada.', null),
  ('Peso muerto rumano', 'Fuerza', 'Llevá la cadera hacia atrás manteniendo la espalda neutra.', null),
  ('Puente de glúteos', 'Fuerza', 'Empujá desde los talones y evitá hiperextender la zona lumbar.', null),
  ('Zancada hacia atrás', 'Fuerza', 'Mantené el torso estable y la rodilla delantera alineada.', null),
  ('Step up', 'Fuerza', 'Subí controlando la rodilla y bajá sin dejarte caer.', null),
  ('Press de pecho con mancuernas', 'Fuerza', 'Escápulas apoyadas y muñecas alineadas con los antebrazos.', null),
  ('Flexiones', 'Fuerza', 'Cuerpo en bloque y codos a un ángulo cómodo, sin colapsar la cintura.', null),
  ('Remo con mancuerna', 'Fuerza', 'Llevá el codo hacia la cadera sin girar el torso.', 'https://www.youtube.com/watch?v=cJBURBEwJMA'),
  ('Jalón al pecho', 'Fuerza', 'Bajá la barra hacia la parte alta del pecho, sin tirar el cuello hacia adelante.', null),
  ('Press militar con mancuernas', 'Fuerza', 'Activá abdomen y subí sin arquear la espalda.', null),
  ('Plancha frontal', 'Zona media', 'Mantené una línea recta de hombros a talones; respiración controlada.', null),
  ('Plancha lateral', 'Zona media', 'Elevá la cadera y sostené el cuerpo alineado.', null),
  ('Dead bug', 'Zona media', 'Pegá la zona lumbar al suelo mientras alternás brazos y piernas.', null),
  ('Bird dog', 'Zona media', 'Extendé brazo y pierna contraria sin mover la cadera.', null),
  ('Movilidad de cadera 90/90', 'Movilidad', 'Mové ambas caderas de forma lenta y sin dolor.', null),
  ('Movilidad torácica', 'Movilidad', 'Rotá desde la parte media de la espalda, no desde la zona lumbar.', null),
  ('Estiramiento posterior de pierna', 'Estiramiento', 'Buscá tensión suave, sin rebotes ni dolor.', null),
  ('Caminata', 'Cardio', 'Ritmo continuo que permita hablar con algo de esfuerzo.', null),
  ('Bicicleta estática', 'Cardio', 'Ajustá asiento y resistencia según el objetivo indicado.', null)
) as item(name, category, instructions, video_url)
where not exists (
  select 1 from public.exercise_library existing
  where existing.gym_id = 'entrenamiento_online' and lower(existing.name) = lower(item.name)
);
