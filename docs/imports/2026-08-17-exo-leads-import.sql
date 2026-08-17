-- ImportaciÃ³n de leads: Exo Fitness Area
-- Fuente: hoja "Leads" de Exo Gestion de programa.xlsx.
-- Se excluyen 8 filas sin nombre. Se importan 87 leads.

BEGIN;

-- Contexto temporal requerido por el trigger de aislamiento por gimnasio.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"ec66f33d-b43d-4d91-a00a-cc260dffc970","role":"authenticated","email":"exofitness.uy@gmail.com","user_metadata":{"gym_id":"exo_gym"}}',
  true
);

CREATE TEMP TABLE exo_lead_import (
  row_no integer PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL,
  contact_date date NOT NULL,
  notes text NOT NULL,
  priority_level text NOT NULL,
  scheduled_date date
) ON COMMIT DROP;

INSERT INTO exo_lead_import (
  row_no, name, phone, status, contact_date, notes, priority_level, scheduled_date
) VALUES
  (1, 'Bianca Machado', '092779836', 'trial_scheduled', '2026-08-05'::date, 'Viene con una amiga a sala de musculacion no tie', 'green', '2026-08-05'),
  (2, 'Agustina Miraballes', '', 'trial_scheduled', '2026-07-29'::date, 'Amiga de Belen Rivero', 'green', '2026-07-29'),
  (3, 'Sylvia Rivero', '099133025', 'trial_scheduled', '2026-08-07'::date, '', 'green', '2026-08-07'),
  (4, 'Guillermo Silva', '097307928', 'trial_scheduled', '2026-08-17'::date, '', 'green', '2026-08-17'),
  (5, 'Lucia Ocampo', '099706946', 'trial_scheduled', '2026-08-14'::date, '', 'green', '2026-08-14'),
  (6, 'Emiliano Cabrera', '094982394', 'trial_scheduled', '2026-08-17'::date, '', 'green', '2026-08-17'),
  (7, 'Mariangel', '098157539', 'trial_scheduled', '2026-08-14'::date, '', 'green', '2026-08-14'),
  (8, 'Martina Vera', '098734817', 'trial_completed', '2023-01-09'::date, 'Ver wsp. Vuelve el año que viene
Cierre anterior: Doc', 'yellow', NULL),
  (9, 'Sandra Nuñez', '098537730', 'trial_completed', '2023-01-23'::date, 'Esta de vacaciones
Cierre anterior: Lea', 'yellow', NULL),
  (10, 'Florencia Paz', '092060554', 'trial_completed', '2023-08-14'::date, 'Buenaass, como andas? Jaja no son pesados no, en
Cierre anterior: Doc', 'green', NULL),
  (11, 'Mara', '092416723', 'trial_completed', '2023-09-07'::date, 'Hola buenas tardes, al respecto de la propuesta
Cierre anterior: Doc', 'green', NULL),
  (12, 'Luzmila Techera', '098567433', 'trial_completed', '2023-09-06'::date, 'Agendó por WSP sabe los planes
Cierre anterior: Doc', 'green', NULL),
  (13, 'Belen Hernandez', '098924334', 'trial_completed', '2023-10-11'::date, 'Cierre anterior: Doc', 'green', NULL),
  (14, 'Luciana Martinez', '099428919', 'trial_completed', '2024-03-11'::date, 'Les parecio muy traqnui la clase
Cierre anterior: Lea', 'yellow', NULL),
  (15, 'Gabriela Hernandez', '', 'new', '2026-05-01'::date, 'Viene con una ex socia Laura Gerolmini. Vienen c', 'yellow', NULL),
  (16, 'Rafaella Lupini', '096720232', 'not_interested', '2026-05-01'::date, 'No vino a su clase le mande msj', 'yellow', NULL),
  (17, 'Sinitia Freire', '', 'not_interested', '2022-09-19'::date, 'Esta con infeccion respiratoria. Semana que vien', 'yellow', NULL),
  (18, 'Federico Pereira', '098717727', 'not_interested', '2022-10-11'::date, 'Hola como están? Les iba a escribir ayer pero me', 'yellow', NULL),
  (19, 'Rocio', '098674033', 'not_interested', '2022-10-18'::date, 'Aviso que no venia!', 'yellow', NULL),
  (20, 'Daniela Echenique', '091412324', 'not_interested', '2023-05-23'::date, '', 'yellow', NULL),
  (21, 'Francisco Anda', '099455532', 'not_interested', '2023-07-10'::date, '', 'yellow', NULL),
  (22, 'Sabrina Acosta', '098298545', 'not_interested', '2023-07-13'::date, '', 'yellow', NULL),
  (23, 'Estefany Macchi', '098854994', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (24, 'Agustina Orlando', '098839920', 'not_interested', '2023-09-04'::date, 'Hola!!! Tuve a empezar una materia nueva en la f', 'yellow', NULL),
  (25, 'Marzio Pintos', '092480798', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (26, 'Mariel', '099869501', 'not_interested', '2024-01-25'::date, '', 'yellow', NULL),
  (27, 'Paula Guerra', '099202924', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (28, 'Gustavo', '099274483', 'not_interested', '2024-01-29'::date, 'No viene esta enfermo', 'yellow', NULL),
  (29, 'Juan Pereyra', '097544480', 'not_interested', '2024-01-26'::date, '', 'yellow', NULL),
  (30, 'Guillermos Jakerle', '097437051', 'not_interested', '2026-05-01'::date, 'Cuando se recupere viene o escribe', 'yellow', NULL),
  (31, 'Natalia Guillermo', '091613824', 'not_interested', '2026-05-01'::date, 'Cuando se recupere viene o escribe', 'yellow', NULL),
  (32, 'Diana Correge', '099637180', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (33, 'Priscilla Severgnini', '099238490', 'not_interested', '2026-05-01'::date, 'Esta mal del hombro', 'yellow', NULL),
  (34, 'Micaela Fernandez', '092478214', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (35, 'Valentina Libonatti', '098226749', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (36, 'Mariana Sauane', '099213928', 'not_interested', '2024-03-18'::date, '', 'yellow', NULL),
  (37, 'Angela', '094062673', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (38, 'Adriana Del Carmen', '091880090', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (39, 'Agustina Segade', '095755745', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (40, 'Bruna Casanovas', '099640471', 'not_interested', '2024-06-24'::date, '', 'yellow', NULL),
  (41, 'Juan Gularte', '099548542', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (42, 'Sergio Vilche', '097509460', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (43, 'Martin Odriozola', '098042458', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (44, 'Debora Ramos', '', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (45, 'Siomara', '097090281', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (46, 'Lucia Gallese', '095560723', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (47, 'Lucas Ferreira', '098949620', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (48, 'Yamila Gatica', '091975418', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (49, 'Cecilia', '092471598', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (50, 'Yus', '099457154', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (51, 'Darwin', '091961663', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (52, 'Julian G', '093363872', 'not_interested', '2025-03-25'::date, 'Escribiò por wap', 'yellow', NULL),
  (53, 'Paola Hernandez', '', 'not_interested', '2026-05-01'::date, 'Escribió por IG', 'yellow', NULL),
  (54, 'Gustavo Guira', '', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (55, 'Gaston Echeverria', '091262695', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (56, 'Camila Martinez', '099391399', 'not_interested', '2025-06-16'::date, 'Vuelve el 15 de junio de viaje.volver a contacta', 'yellow', NULL),
  (57, 'Laura Da Silva', '094990921', 'not_interested', '2026-05-01'::date, 'Ex socia', 'yellow', NULL),
  (58, 'Sthefi', '099339422', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (59, 'Lourdes Duarte', '099289433', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (60, 'Laura Palladino', '099227752', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (61, 'Guidaix', '091991966', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (62, 'Patricia', '094930608', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (63, 'Jimena Esteves', '', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (64, 'Carolina Darin', '', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (65, 'Paula', '092686208', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (66, 'Nataly', '', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (67, 'Morena', '', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (68, 'Matilde Rufo', '098370985', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (69, 'Diana', '092770302', 'not_interested', '2026-01-16'::date, '', 'yellow', NULL),
  (70, 'Laura Correa', '094952110', 'not_interested', '2026-01-20'::date, '', 'yellow', NULL),
  (71, 'Katherine', '098585996', 'not_interested', '2026-03-05'::date, '', 'yellow', NULL),
  (72, 'Micaela Siran', '099954802', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (73, 'Elsa Rodriguez', '095530522', 'not_interested', '2026-02-15'::date, 'El que va a venir es el hijo pero en febreor', 'yellow', NULL),
  (74, 'Chiari', '099813823', 'not_interested', '2026-03-18'::date, '', 'yellow', NULL),
  (75, 'Sabrina Silvera', '098015112', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (76, 'Lucia Leguizamon', '092056413', 'not_interested', '2026-04-24'::date, '', 'yellow', NULL),
  (77, 'Yobana', '095006932', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (78, 'Fermina', '091935337', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (79, 'Gabriela Rodriguez', '099303954', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (80, 'Estefania', '099669980', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (81, 'Savannah Ozonas', '099239309', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (82, 'Giovanna Medina', '098244681', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (83, 'Belen', '092455411', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (84, 'Cecilia Gonzalez', '099474339', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (85, 'Christian Portela', '099839256', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (86, 'Enzo Fabbricatore', '091936275', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL),
  (87, 'Leticia', '098845645', 'not_interested', '2026-05-01'::date, '', 'yellow', NULL);

DO $$
BEGIN
  IF (SELECT count(*) FROM exo_lead_import) <> 87 THEN
    RAISE EXCEPTION 'La importaciÃ³n debe contener 87 leads.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM exo_lead_import
    WHERE status NOT IN ('new', 'trial_scheduled', 'trial_completed', 'not_interested')
  ) THEN
    RAISE EXCEPTION 'Hay un estado de lead invÃ¡lido.';
  END IF;
END
$$;

INSERT INTO prospects (
  id, gym_id, name, email, phone, contact_date, interest, status, notes,
  priority_level, scheduled_date, next_contact_date
)
SELECT
  format('exo_gym_prospect_import_%s', source.row_no),
  'exo_gym',
  source.name,
  '',
  source.phone,
  source.contact_date,
  '',
  source.status,
  source.notes,
  source.priority_level,
  source.scheduled_date,
  NULL
FROM exo_lead_import source
ON CONFLICT (id) DO NOTHING;

COMMIT;

SELECT
  (SELECT count(*) FROM prospects WHERE gym_id = 'exo_gym' AND id LIKE 'exo_gym_prospect_import_%') AS leads_importados,
  (SELECT count(*) FROM prospects WHERE gym_id = 'exo_gym' AND id LIKE 'exo_gym_prospect_import_%' AND priority_level = 'green') AS prioridad_verde,
  (SELECT count(*) FROM prospects WHERE gym_id = 'exo_gym' AND id LIKE 'exo_gym_prospect_import_%' AND priority_level = 'yellow') AS prioridad_amarilla;