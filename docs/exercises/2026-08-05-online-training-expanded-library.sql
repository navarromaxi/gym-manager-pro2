-- BIBLIOTECA AMPLIADA PARA ENTRENAMIENTO ONLINE
--
-- Ejecutar después de 2026-08-05-online-training-video-library.sql.
-- Agrega 104 ejercicios adicionales al espacio entrenamiento_online.
-- Es seguro ejecutarlo más de una vez: no duplica ejercicios existentes.

with items(name, category, instructions, video_url) as (
  values
    -- Fuerza: tren inferior
    ('Prensa de piernas', 'Fuerza', 'Bajá con control sin despegar la espalda de la máquina.', 'https://www.youtube.com/results?search_query=prensa+de+piernas+tecnica+short'),
    ('Sentadilla sumo', 'Fuerza', 'Abrí los pies cómodo, rodillas siguen la dirección de las puntas.', 'https://www.youtube.com/results?search_query=sentadilla+sumo+tecnica+short'),
    ('Sentadilla frontal con barra', 'Fuerza', 'Mantené el torso alto y los codos elevados.', 'https://www.youtube.com/results?search_query=sentadilla+frontal+barra+tecnica+short'),
    ('Sentadilla trasera con barra', 'Fuerza', 'Braceá el abdomen y bajá de manera controlada.', 'https://www.youtube.com/results?search_query=sentadilla+trasera+barra+tecnica+short'),
    ('Peso muerto convencional', 'Fuerza', 'Acercá la barra al cuerpo y empujá el piso con las piernas.', 'https://www.youtube.com/results?search_query=peso+muerto+convencional+tecnica+short'),
    ('Peso muerto sumo', 'Fuerza', 'Abrí las rodillas, pecho arriba y mantené la barra cerca.', 'https://www.youtube.com/results?search_query=peso+muerto+sumo+tecnica+short'),
    ('Buenos días con barra', 'Fuerza', 'Llevá cadera atrás con poco peso y espalda neutra.', 'https://www.youtube.com/results?search_query=buenos+dias+barra+tecnica+short'),
    ('Curl femoral acostado', 'Fuerza', 'Flexioná las rodillas sin despegar la cadera del banco.', 'https://www.youtube.com/results?search_query=curl+femoral+acostado+tecnica+short'),
    ('Curl femoral sentado', 'Fuerza', 'Controlá la vuelta y no levantés la cadera.', 'https://www.youtube.com/results?search_query=curl+femoral+sentado+tecnica+short'),
    ('Extensión de cuádriceps', 'Fuerza', 'Subí sin rebotes y bajá lentamente.', 'https://www.youtube.com/results?search_query=extension+cuadriceps+maquina+tecnica+short'),
    ('Abducción de cadera en máquina', 'Fuerza', 'Abrí las piernas con control y sin impulsar el torso.', 'https://www.youtube.com/results?search_query=abduccion+cadera+maquina+tecnica+short'),
    ('Aducción de cadera en máquina', 'Fuerza', 'Cerrá las piernas lento sin golpear las placas.', 'https://www.youtube.com/results?search_query=aduccion+cadera+maquina+tecnica+short'),
    ('Patada de glúteo en polea', 'Fuerza', 'Mové la pierna desde la cadera sin girar el tronco.', 'https://www.youtube.com/results?search_query=patada+gluteo+polea+tecnica+short'),
    ('Pull through en polea', 'Fuerza', 'Hacé bisagra de cadera y apretá glúteos al final.', 'https://www.youtube.com/results?search_query=pull+through+polea+tecnica+short'),
    ('Elevación de talones sentado', 'Fuerza', 'Recorré todo el rango y pausá un instante arriba.', 'https://www.youtube.com/results?search_query=elevacion+talones+sentado+tecnica+short'),
    ('Desplante caminando', 'Fuerza', 'Dá pasos estables y mantené la rodilla delantera alineada.', 'https://www.youtube.com/results?search_query=desplantes+caminando+tecnica+short'),
    ('Sentadilla a caja', 'Fuerza', 'Tocá la caja suavemente y volvé a subir con control.', 'https://www.youtube.com/results?search_query=sentadilla+a+caja+tecnica+short'),
    ('Peso muerto a una pierna', 'Fuerza', 'Mantené la cadera cuadrada y usá una carga moderada.', 'https://www.youtube.com/results?search_query=peso+muerto+una+pierna+tecnica+short'),

    -- Fuerza: tren superior
    ('Press inclinado con mancuernas', 'Fuerza', 'Escápulas apoyadas y muñecas sobre los codos.', 'https://www.youtube.com/results?search_query=press+inclinado+mancuernas+tecnica+short'),
    ('Press inclinado con barra', 'Fuerza', 'Bajá la barra con control hacia la parte alta del pecho.', 'https://www.youtube.com/results?search_query=press+inclinado+barra+tecnica+short'),
    ('Aperturas con mancuernas', 'Fuerza', 'Usá poco peso y mantené una leve flexión de codos.', 'https://www.youtube.com/results?search_query=aperturas+mancuernas+tecnica+short'),
    ('Cruce de poleas', 'Fuerza', 'Juntá las manos al frente sin elevar los hombros.', 'https://www.youtube.com/results?search_query=cruce+de+poleas+tecnica+short'),
    ('Press de pecho en máquina', 'Fuerza', 'Ajustá el asiento y empujá sin despegar la espalda.', 'https://www.youtube.com/results?search_query=press+pecho+maquina+tecnica+short'),
    ('Dominadas asistidas', 'Fuerza', 'Llevá los codos hacia abajo y evitá encoger hombros.', 'https://www.youtube.com/results?search_query=dominadas+asistidas+tecnica+short'),
    ('Dominadas pronas', 'Fuerza', 'Subí con control sin balancear el cuerpo.', 'https://www.youtube.com/results?search_query=dominadas+pronas+tecnica+short'),
    ('Remo con barra', 'Fuerza', 'Mantené la espalda firme y llevá la barra al abdomen.', 'https://www.youtube.com/results?search_query=remo+con+barra+tecnica+short'),
    ('Remo pecho apoyado', 'Fuerza', 'Apoyá el pecho y llevá los codos hacia atrás.', 'https://www.youtube.com/results?search_query=remo+pecho+apoyado+tecnica+short'),
    ('Pullover en polea', 'Fuerza', 'Mové los brazos sin perder la estabilidad del torso.', 'https://www.youtube.com/results?search_query=pullover+polea+tecnica+short'),
    ('Face pull', 'Fuerza', 'Llevá la cuerda hacia la cara con codos altos.', 'https://www.youtube.com/results?search_query=face+pull+tecnica+short'),
    ('Press Arnold', 'Fuerza', 'Rotá las mancuernas con control y mantené el abdomen firme.', 'https://www.youtube.com/results?search_query=press+arnold+tecnica+short'),
    ('Elevación frontal con mancuernas', 'Fuerza', 'Levantá hasta la altura de los hombros sin balancearte.', 'https://www.youtube.com/results?search_query=elevacion+frontal+mancuernas+tecnica+short'),
    ('Pájaros con mancuernas', 'Fuerza', 'Abrí los brazos con control manteniendo el cuello relajado.', 'https://www.youtube.com/results?search_query=pajaros+mancuernas+tecnica+short'),
    ('Encogimiento de trapecio', 'Fuerza', 'Subí los hombros recto arriba y bajá lentamente.', 'https://www.youtube.com/results?search_query=encogimiento+trapecio+tecnica+short'),
    ('Curl con barra EZ', 'Fuerza', 'Mantené los codos cerca del cuerpo y no uses impulso.', 'https://www.youtube.com/results?search_query=curl+barra+ez+tecnica+short'),
    ('Curl martillo', 'Fuerza', 'Mantené las palmas enfrentadas y el torso quieto.', 'https://www.youtube.com/results?search_query=curl+martillo+tecnica+short'),
    ('Curl en banco inclinado', 'Fuerza', 'Mantené los brazos atrás y subí sin mover hombros.', 'https://www.youtube.com/results?search_query=curl+banco+inclinado+tecnica+short'),
    ('Fondos asistidos', 'Fuerza', 'Bajá hasta un rango cómodo, sin colapsar los hombros.', 'https://www.youtube.com/results?search_query=fondos+asistidos+tecnica+short'),
    ('Press francés', 'Fuerza', 'Fijá los codos y extendé de manera controlada.', 'https://www.youtube.com/results?search_query=press+frances+triceps+tecnica+short'),
    ('Extensión de tríceps con mancuerna', 'Fuerza', 'Mantené el codo apuntando al techo y no arquees la espalda.', 'https://www.youtube.com/results?search_query=extension+triceps+mancuerna+tecnica+short'),

    -- Zona media
    ('Hollow hold', 'Zona media', 'Pegá la zona lumbar al suelo y sostené sin dolor.', 'https://www.youtube.com/results?search_query=hollow+hold+tecnica+short'),
    ('Russian twist', 'Zona media', 'Rotá el tronco con control, sin tirar de los hombros.', 'https://www.youtube.com/results?search_query=russian+twist+tecnica+short'),
    ('Elevación de rodillas colgado', 'Zona media', 'Evitá el balanceo y elevá con el abdomen.', 'https://www.youtube.com/results?search_query=elevacion+rodillas+colgado+tecnica+short'),
    ('Elevación de piernas en suelo', 'Zona media', 'Mantené la zona lumbar apoyada durante el movimiento.', 'https://www.youtube.com/results?search_query=elevacion+piernas+suelo+tecnica+short'),
    ('Mountain climbers', 'Zona media', 'Mantené hombros sobre manos y cadera estable.', 'https://www.youtube.com/results?search_query=mountain+climbers+tecnica+short'),
    ('Rueda abdominal', 'Zona media', 'Avanzá sólo hasta mantener la espalda neutra.', 'https://www.youtube.com/results?search_query=rueda+abdominal+tecnica+short'),
    ('Crunch en polea', 'Zona media', 'Flexioná el tronco sin tirar con los brazos.', 'https://www.youtube.com/results?search_query=crunch+polea+tecnica+short'),
    ('Crunch inverso', 'Zona media', 'Elevá la pelvis suavemente sin tomar impulso.', 'https://www.youtube.com/results?search_query=crunch+inverso+tecnica+short'),
    ('Plancha lateral con rotación', 'Zona media', 'Rotá de forma controlada manteniendo la cadera elevada.', 'https://www.youtube.com/results?search_query=plancha+lateral+rotacion+tecnica+short'),
    ('Plancha con toques de hombro', 'Zona media', 'Evitá que la cadera rote al tocar cada hombro.', 'https://www.youtube.com/results?search_query=plancha+toques+hombro+tecnica+short'),
    ('Bear plank', 'Zona media', 'Rodillas cerca del suelo, espalda firme y respiración controlada.', 'https://www.youtube.com/results?search_query=bear+plank+tecnica+short'),
    ('Bear crawl', 'Zona media', 'Desplazate corto con rodillas cerca del suelo y torso estable.', 'https://www.youtube.com/results?search_query=bear+crawl+tecnica+short'),
    ('Paseo del granjero', 'Zona media', 'Caminá erguido con las cargas cerca del cuerpo.', 'https://www.youtube.com/results?search_query=farmer+carry+tecnica+short'),
    ('Paseo de maleta', 'Zona media', 'Llevá una carga a un lado sin inclinar el tronco.', 'https://www.youtube.com/results?search_query=suitcase+carry+tecnica+short'),
    ('Superman', 'Zona media', 'Elevá brazos y piernas suave, sin forzar la zona lumbar.', 'https://www.youtube.com/results?search_query=superman+ejercicio+tecnica+short'),
    ('Extensión lumbar en banco', 'Zona media', 'Subí hasta quedar alineado, sin hiperextender.', 'https://www.youtube.com/results?search_query=extension+lumbar+banco+tecnica+short'),

    -- Movilidad
    ('Movilidad de tobillo a pared', 'Movilidad', 'Llevá la rodilla hacia adelante sin despegar el talón.', 'https://www.youtube.com/results?search_query=movilidad+tobillo+pared+short'),
    ('Rockback de aductores', 'Movilidad', 'Llevá la cadera hacia atrás y mantené la espalda larga.', 'https://www.youtube.com/results?search_query=rockback+aductores+movilidad+short'),
    ('Estocada del mundo', 'Movilidad', 'Avanzá con control y rotá el torso sin dolor.', 'https://www.youtube.com/results?search_query=worlds+greatest+stretch+short'),
    ('Sentadilla profunda sostenida', 'Movilidad', 'Buscá una posición cómoda y mantené talones apoyados.', 'https://www.youtube.com/results?search_query=deep+squat+hold+mobility+short'),
    ('Sentadilla cosaca de movilidad', 'Movilidad', 'Desplazá el peso lateral sin colapsar la rodilla.', 'https://www.youtube.com/results?search_query=cossack+squat+mobility+short'),
    ('CAR de cadera', 'Movilidad', 'Mové la cadera lento y con el rango que toleres.', 'https://www.youtube.com/results?search_query=hip+car+mobility+short'),
    ('CAR de hombro', 'Movilidad', 'Hacé círculos lentos de hombro sin compensar el torso.', 'https://www.youtube.com/results?search_query=shoulder+car+mobility+short'),
    ('Deslizamientos en pared', 'Movilidad', 'Mantené costillas abajo mientras suben los brazos.', 'https://www.youtube.com/results?search_query=wall+slides+shoulder+mobility+short'),
    ('Flexiones escapulares', 'Movilidad', 'Mové sólo las escápulas sin doblar los codos.', 'https://www.youtube.com/results?search_query=flexiones+escapulares+tecnica+short'),
    ('Movilidad de muñecas', 'Movilidad', 'Desplazá el peso gradualmente y sin dolor.', 'https://www.youtube.com/results?search_query=movilidad+munecas+short'),
    ('Movilidad cervical suave', 'Movilidad', 'Mové el cuello despacio, sin rebotes ni dolor.', 'https://www.youtube.com/results?search_query=movilidad+cervical+suave+short'),
    ('Deslizamiento neural posterior', 'Movilidad', 'Hacé el recorrido suave, sin buscar dolor ni hormigueo intenso.', 'https://www.youtube.com/results?search_query=hamstring+nerve+floss+short'),
    ('Rotación torácica en cuadrupedia', 'Movilidad', 'Rotá desde el pecho manteniendo la cadera estable.', 'https://www.youtube.com/results?search_query=rotacion+toracica+cuadrupedia+short'),
    ('Círculos de tobillo', 'Movilidad', 'Recorré círculos lentos y amplios en ambos sentidos.', 'https://www.youtube.com/results?search_query=circulos+tobillo+movilidad+short'),
    ('Balanceo de piernas', 'Movilidad', 'Hacé balanceos progresivos manteniendo el tronco estable.', 'https://www.youtube.com/results?search_query=balanceo+piernas+movilidad+short'),
    ('Rotación de cadera de pie', 'Movilidad', 'Elevá la rodilla y abrí la cadera de forma controlada.', 'https://www.youtube.com/results?search_query=rotacion+cadera+de+pie+short'),

    -- Estiramiento
    ('Estiramiento de pantorrilla', 'Estiramiento', 'Mantené el talón apoyado y buscá tensión suave.', 'https://www.youtube.com/results?search_query=estiramiento+pantorrilla+short'),
    ('Estiramiento de glúteo piriforme', 'Estiramiento', 'Acercá la pierna con suavidad sin dolor en la rodilla.', 'https://www.youtube.com/results?search_query=estiramiento+piriforme+gluteo+short'),
    ('Estiramiento de dorsal ancho', 'Estiramiento', 'Llevá el pecho hacia abajo manteniendo la respiración fluida.', 'https://www.youtube.com/results?search_query=estiramiento+dorsal+ancho+short'),
    ('Estiramiento de tríceps', 'Estiramiento', 'Llevá el codo arriba sin arquear la espalda.', 'https://www.youtube.com/results?search_query=estiramiento+triceps+short'),
    ('Estiramiento de cuello lateral', 'Estiramiento', 'Inclina la cabeza suave sin tirar fuerte con la mano.', 'https://www.youtube.com/results?search_query=estiramiento+cuello+lateral+short'),
    ('Estiramiento de aductores', 'Estiramiento', 'Abrí las piernas dentro de un rango cómodo.', 'https://www.youtube.com/results?search_query=estiramiento+aductores+short'),
    ('Estiramiento de gemelo sóleo', 'Estiramiento', 'Flexioná ligeramente la rodilla y mantené el talón abajo.', 'https://www.youtube.com/results?search_query=estiramiento+soleo+short'),
    ('Estiramiento de hombro posterior', 'Estiramiento', 'Llevá el brazo al frente sin elevar el hombro.', 'https://www.youtube.com/results?search_query=estiramiento+hombro+posterior+short'),
    ('Estiramiento de bíceps', 'Estiramiento', 'Abrí el brazo de forma gradual sin dolor en el hombro.', 'https://www.youtube.com/results?search_query=estiramiento+biceps+short'),
    ('Postura del niño', 'Estiramiento', 'Llevá la cadera hacia talones y respiración lenta.', 'https://www.youtube.com/results?search_query=postura+del+nino+estiramiento+short'),
    ('Cobra suave', 'Estiramiento', 'Extendé el tronco sólo hasta donde resulte cómodo.', 'https://www.youtube.com/results?search_query=estiramiento+cobra+short'),
    ('Estiramiento mariposa', 'Estiramiento', 'Acercá plantas de pies y dejá caer rodillas suavemente.', 'https://www.youtube.com/results?search_query=estiramiento+mariposa+short'),
    ('Estiramiento de antebrazo', 'Estiramiento', 'Extendé el brazo y aplicá una tensión muy suave.', 'https://www.youtube.com/results?search_query=estiramiento+antebrazo+short'),
    ('Respiración diafragmática', 'Estiramiento', 'Respirá lento expandiendo abdomen y costillas bajas.', 'https://www.youtube.com/results?search_query=respiracion+diafragmatica+ejercicio+short'),

    -- Cardio
    ('Jumping jacks', 'Cardio', 'Aterrizá suave y mantené un ritmo que puedas controlar.', 'https://www.youtube.com/results?search_query=jumping+jacks+tecnica+short'),
    ('Burpee adaptado', 'Cardio', 'Usá una versión acorde al nivel, cuidando la técnica.', 'https://www.youtube.com/results?search_query=burpee+adaptado+tecnica+short'),
    ('Rodillas arriba', 'Cardio', 'Mantené el tronco erguido y caé suave sobre el pie.', 'https://www.youtube.com/results?search_query=rodillas+arriba+tecnica+short'),
    ('Talones al glúteo', 'Cardio', 'Movete ágil sin inclinar demasiado el tronco.', 'https://www.youtube.com/results?search_query=talones+al+gluteo+tecnica+short'),
    ('Cinta de correr', 'Cardio', 'Empezá suave y ajustá velocidad o pendiente gradualmente.', 'https://www.youtube.com/results?search_query=cinta+correr+tecnica+short'),
    ('Elíptica', 'Cardio', 'Mantené postura alta y una resistencia acorde al nivel.', 'https://www.youtube.com/results?search_query=eliptica+tecnica+short'),
    ('Subida a escalón aeróbica', 'Cardio', 'Alterná piernas y mantené el paso controlado.', 'https://www.youtube.com/results?search_query=subida+escalon+aerobica+short'),
    ('Bicicleta de aire', 'Cardio', 'Ajustá la intensidad de forma progresiva.', 'https://www.youtube.com/results?search_query=air+bike+tecnica+short'),
    ('Remo por intervalos', 'Cardio', 'Priorizá una técnica fluida antes de subir intensidad.', 'https://www.youtube.com/results?search_query=remo+ergometro+intervalos+short'),
    ('Sombra de boxeo', 'Cardio', 'Mantené guardia relajada y golpes controlados.', 'https://www.youtube.com/results?search_query=sombra+boxeo+tecnica+short'),

    -- Funcional y potencia
    ('Kettlebell swing', 'Funcional', 'Hacé bisagra de cadera; no levantes la pesa sólo con brazos.', 'https://www.youtube.com/results?search_query=kettlebell+swing+tecnica+short'),
    ('Golpe de balón medicinal', 'Funcional', 'Elevá el balón con control y usá todo el cuerpo al bajarlo.', 'https://www.youtube.com/results?search_query=medicine+ball+slam+tecnica+short'),
    ('Battle ropes', 'Funcional', 'Mantené rodillas suaves y mové las cuerdas desde los hombros.', 'https://www.youtube.com/results?search_query=battle+ropes+tecnica+short'),
    ('Salto a caja', 'Funcional', 'Elegí una altura segura y aterrizá suave con rodillas alineadas.', 'https://www.youtube.com/results?search_query=box+jump+tecnica+short'),
    ('Salto lateral de patinador', 'Funcional', 'Aterrizá estable antes de impulsar hacia el otro lado.', 'https://www.youtube.com/results?search_query=skater+jump+tecnica+short'),
    ('Empuje de trineo', 'Funcional', 'Mantené el cuerpo inclinado y pasos cortos fuertes.', 'https://www.youtube.com/results?search_query=sled+push+tecnica+short'),
    ('Arrastre de trineo', 'Funcional', 'Caminá hacia atrás con postura firme y pasos controlados.', 'https://www.youtube.com/results?search_query=sled+drag+tecnica+short'),
    ('Turkish get up', 'Funcional', 'Aprendelo por partes y usá una carga baja al inicio.', 'https://www.youtube.com/results?search_query=turkish+get+up+tecnica+short'),
    ('Caminata del oso lateral', 'Funcional', 'Desplazate lateral manteniendo rodillas cerca del suelo.', 'https://www.youtube.com/results?search_query=bear+crawl+lateral+short'),
    ('Lanzamiento de balón al pecho', 'Funcional', 'Empujá el balón desde el pecho con control y recuperalo estable.', 'https://www.youtube.com/results?search_query=medicine+ball+chest+pass+short')
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

-- Comprobación: ver total por categoría después de la carga.
select category, count(*) as ejercicios
from public.exercise_library
where gym_id = 'entrenamiento_online' and is_active = true
group by category
order by category;
