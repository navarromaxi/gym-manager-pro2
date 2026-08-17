-- ImportaciÃ³n inicial: Exo Fitness Area
-- Fuente: hoja "Socios" de Exo Gestion de programa.xlsx (121 filas).
-- Ejecutar completo en el SQL Editor de Supabase. No modifica otros gimnasios.

BEGIN;

-- El SQL Editor no incluye el JWT de la sesión de la app. Este contexto solo
-- existe dentro de esta transacción y satisface el trigger de aislamiento por gimnasio.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"ec66f33d-b43d-4d91-a00a-cc260dffc970","role":"authenticated","email":"exofitness.uy@gmail.com","user_metadata":{"gym_id":"exo_gym"}}',
  true
);

CREATE TEMP TABLE exo_member_import (
  row_no integer PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  cedula text,
  plan_name text NOT NULL,
  payment_date date NOT NULL,
  plan_start_date date NOT NULL,
  plan_end_date date NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  card_brand text
) ON COMMIT DROP;

INSERT INTO exo_member_import (
  row_no, name, email, phone, cedula, plan_name, payment_date,
  plan_start_date, plan_end_date, amount, payment_method, card_brand
) VALUES
  (1, 'Sofia Rivero', '', '092225022', '5.535.039-1', 'Pase Libre', '2026-07-19'::date, '2026-07-19'::date, '2026-10-17'::date, 0, 'Transferencia', NULL),
  (2, 'Santiago Ramos', '', '094787391', NULL, 'Mensual', '2026-08-15'::date, '2026-08-15'::date, '2026-09-14'::date, 2100, 'Transferencia', NULL),
  (3, 'Diego Lozza', '4zetas@gmail.com', '094130628', '3.801.407-3', 'Anual', '2026-05-19'::date, '2026-05-19'::date, '2027-05-14'::date, 20400, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (4, 'Rafael Garcia', 'rgrevetria21@hotmail.com', '', '4.649.487-7', 'Anual', '2026-03-16'::date, '2026-03-16'::date, '2027-03-11'::date, 20400, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (5, 'Ariel Rios', 'arielriosduarte@gmail.com', '092715591', '4.677.656-8', 'Anual', '2026-03-10'::date, '2026-03-10'::date, '2027-03-05'::date, 20400, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (6, 'Isabel Geymonat', 'isageymonatch@gmail.com', '099798934', '4.541.013-3', 'Anual', '2026-03-02'::date, '2026-03-02'::date, '2027-02-25'::date, 20400, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (7, 'Raquel Ramirez', 'raquelramirez2022@gmail.com', '091863834', '4.729.649-6', 'Anual', '2026-03-01'::date, '2026-03-01'::date, '2027-02-24'::date, 20400, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (8, 'Melisa Piastra', 'melisapiastra@gmail.com', '094282978', '5.064.665-0', 'Semestral', '2026-08-02'::date, '2026-08-02'::date, '2027-01-29'::date, 12000, 'Transferencia', NULL),
  (9, 'Valentina Rodriguez', '', '096144161', '5.228.714-9', 'Semestral', '2026-07-31'::date, '2026-07-31'::date, '2027-01-27'::date, 12000, 'Transferencia', NULL),
  (10, 'Lucia Cabillon', 'lucabillon@gmail.com', '098857300', '4.436.674-7', 'Semestral', '2026-07-16'::date, '2026-07-16'::date, '2027-01-12'::date, 12000, 'Transferencia', NULL),
  (11, 'Estefani Almada', '', '097435462', '5.172.554-0', 'Semestral', '2026-07-12'::date, '2026-07-12'::date, '2027-01-08'::date, 12600, 'Tarjeta de Crédito', 'MASTER'),
  (12, 'Stella Maris Garré', '', '099390570', '3.495.404-1', 'Semestral', '2026-07-07'::date, '2026-07-07'::date, '2027-01-03'::date, 12000, 'Transferencia', NULL),
  (13, 'Veronica Peña', 'veronicapd2015@gmail.com', '091260375', '3.632.420-2', 'Semestral', '2026-07-06'::date, '2026-07-06'::date, '2027-01-02'::date, 12600, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (14, 'Viviana Fontan', '', '099171769', '4.506.843-3', 'Semestral', '2026-07-05'::date, '2026-07-05'::date, '2027-01-01'::date, 12000, 'Transferencia', NULL),
  (15, 'Mauricio Mazondo', '', '092060627', '4.562.905-1', 'Semestral', '2026-06-19'::date, '2026-06-19'::date, '2026-12-16'::date, 12600, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (16, 'Mauro Dangelo', '', '099199572', '4.141.656-9', 'Semestral', '2026-06-04'::date, '2026-06-04'::date, '2026-12-01'::date, 11300, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (17, 'Constanza Hitta', 'constanzahitta.docs@gmail.com', '091265405', '5.275.170-4', 'Semestral', '2026-06-02'::date, '2026-06-02'::date, '2026-11-29'::date, 12600, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (18, 'Gabriela Sasén', 'sasengabriela@gmail.com', '098801754', '4.322.862-1', 'Semestral', '2026-05-31'::date, '2026-05-31'::date, '2026-11-27'::date, 12600, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (19, 'Jorge Silvero', 'corchosilvero@gmail.com', '094627024', '4.889.672-8', 'Semestral', '2026-05-28'::date, '2026-05-28'::date, '2026-11-24'::date, 12600, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (20, 'Florencia Souto', 'florencia.sou@gmail.com', '091674007', '4.924.556-8', 'Semestral', '2026-05-25'::date, '2026-05-25'::date, '2026-11-21'::date, 12600, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (21, 'Natalia Barbieri', 'nbarbieri5@msn.com', '094446817', '4.138.512-2', 'Anual', '2026-05-14'::date, '2026-05-14'::date, '2027-05-14'::date, 20400, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (22, 'Jimena Cedres', 'jimecedres19@gmail.com', '091469259', '5.628.715-9', 'Trimestral', '2026-08-16'::date, '2026-08-16'::date, '2026-11-14'::date, 6500, 'Transferencia', NULL),
  (23, 'Ana Ferreira', 'delfina11_7@hotmail.com', '095935965', '4.337.123-8', 'Semestral', '2026-05-16'::date, '2026-05-16'::date, '2026-11-12'::date, 12000, 'Transferencia', NULL),
  (24, 'Belen Rivero', 'belenrivero11@gmail.com', '095606600', '4.994.424-5', 'Trimestral', '2026-08-14'::date, '2026-08-14'::date, '2026-11-12'::date, 6800, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (25, 'Patricia Cal', 'patricia.cal@live.com', '094111223', '3.581.027-4', 'Semestral', '2026-05-15'::date, '2026-05-15'::date, '2026-11-11'::date, 12600, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (26, 'Virginia Sagasti', 'vsagasti1@gmail.com', '099456335', '3.338.742-5', 'Trimestral', '2026-08-12'::date, '2026-08-12'::date, '2026-11-10'::date, 6800, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (27, 'Andrea Paolino', 'andreapaolino065@gmail.com', '099388231', '3.315.516-7', 'Trimestral', '2026-08-12'::date, '2026-08-12'::date, '2026-11-10'::date, 6500, 'Tarjeta de Crédito', 'VISA'),
  (28, 'Magdalena Cabrera', 'magdalena.cb.26@gmail.com', '099084265', '4.496.921-8', 'Trimestral', '2026-08-12'::date, '2026-08-12'::date, '2026-11-10'::date, 6500, 'Transferencia', NULL),
  (29, 'Flavia Quinta', 'flaviaquintaalzubides@gmail.com', '094763334', '5.018.230-5', 'Trimestral', '2026-08-08'::date, '2026-08-08'::date, '2026-11-06'::date, 6500, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (30, 'Andres Lay', 'andres.lay.correa@gmail.com', '099151474', '4.775.844-2', 'Semestral', '2026-05-10'::date, '2026-05-10'::date, '2026-11-06'::date, 12000, 'Transferencia', NULL),
  (31, 'Sabrina Elizondo', 'msabrina.elizondo@gmail.com', '092484102', '5.002.458-5', 'Trimestral', '2026-08-08'::date, '2026-08-08'::date, '2026-11-06'::date, 6500, 'Transferencia', NULL),
  (32, 'Paola Folgar', 'pfolgar13@gmail.com', '098071289', '4.891.207-1', 'Trimestral', '2026-08-07'::date, '2026-08-07'::date, '2026-11-05'::date, 6500, 'Efectivo', NULL),
  (33, 'Virginia Bordad', 'bordadvirginia@gmail.com', '093786448', '4.602.276-7', 'Trimestral', '2026-08-06'::date, '2026-08-06'::date, '2026-11-04'::date, 6500, 'Transferencia', NULL),
  (34, 'Rodrigo De Leon', 'ro_dl@hotmail.es', '098425386', '4.659.666-7', 'Trimestral', '2026-08-06'::date, '2026-08-06'::date, '2026-11-04'::date, 6500, 'Transferencia', NULL),
  (35, 'Alan Lazarga', '', '', '5.595.979-7', 'Trimestral', '2026-08-06'::date, '2026-08-06'::date, '2026-11-04'::date, 5400, 'Transferencia', NULL),
  (36, 'Cesar Altamirano', 'cesaro2508@gmail.com', '098338498', '4.350.712-2', 'Trimestral', '2026-08-04'::date, '2026-08-04'::date, '2026-11-02'::date, 6500, 'Transferencia', NULL),
  (37, 'Debora Silva', 'deborasilvacamano@gmail.com', '095183854', '5.208.460-4', 'Pase Libre', '2026-08-01'::date, '2026-08-01'::date, '2026-10-30'::date, 0, 'Efectivo', NULL),
  (38, 'Natalia Rios', 'riosn5870@gmail.com', '091515507', '5.126.534-8', 'Semestral', '2026-05-02'::date, '2026-05-02'::date, '2026-10-29'::date, 11200, 'Tarjeta de Crédito', 'VISA'),
  (39, 'Rodrigo Yarzabal', 'rodrigo.yarzabal.fisio@gmail.com', '092270040', '4.118.977-6', 'Semestral', '2026-05-02'::date, '2026-05-02'::date, '2026-10-29'::date, 12600, 'Tarjeta de Crédito', 'VISA'),
  (40, 'Victoria Tabarez', '', '099947313', '4.643.156-0', 'Trimestral', '2026-07-24'::date, '2026-07-24'::date, '2026-10-22'::date, 6800, 'Tarjeta de Crédito', 'VISA'),
  (41, 'Tanya Lazarga', 'tanyalazarga505@gmail.com', '091231687', '5.187.584-8', 'Trimestral', '2026-07-23'::date, '2026-07-23'::date, '2026-10-21'::date, 5400, 'Transferencia', NULL),
  (42, 'Camila Rodriguez', '', '098882269', '4.619.232-8', 'Pase Libre', '2026-07-22'::date, '2026-07-22'::date, '2026-10-20'::date, 0, 'Efectivo', NULL),
  (43, 'Helen Machado', '', '092214902', '4.985.426-8', 'Pase Libre', '2026-07-19'::date, '2026-07-19'::date, '2026-10-17'::date, 0, 'Efectivo', NULL),
  (44, 'Valentina De los Santos', '', '092872527', '5.180.979-6', 'Pase Libre', '2026-07-19'::date, '2026-07-19'::date, '2026-10-17'::date, 0, 'Efectivo', NULL),
  (45, 'Brayan Nuñez', 'brayanayl0619@gmail.com', '09o2093937', '5.144.779-2', 'Semestral', '2026-04-20'::date, '2026-04-20'::date, '2026-10-17'::date, 12600, 'Tarjeta de Crédito', 'VISA'),
  (46, 'Emilia Barrero', 'emiliabarrerosoria@gmail.com', '092676852', '5.341.488-4', 'Trimestral', '2026-07-19'::date, '2026-07-19'::date, '2026-10-17'::date, 6800, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (47, 'Romina Rivas', 'rominarivas2005@gmail.com', '098503931', '5.555.309-6', 'Trimestral', '2026-07-19'::date, '2026-07-19'::date, '2026-10-17'::date, 5400, 'Transferencia', NULL),
  (48, 'Emilio Baraibar', 'emiliobaraibar1995@gmail.com', '092570330', '4.751.963-8', 'Trimestral', '2026-07-18'::date, '2026-07-18'::date, '2026-10-16'::date, 6800, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (49, 'Carolina Sosa', '', '091293629', '5.507.787-2', 'Trimestral', '2026-07-10'::date, '2026-07-10'::date, '2026-10-08'::date, 6500, 'Transferencia', NULL),
  (50, 'Adriana Rodriguez', 'adri_ro04@hotmail.com', '099381831', '3.697.868-1', 'Semestral', '2026-04-10'::date, '2026-04-10'::date, '2026-10-07'::date, 10800, 'Transferencia', NULL),
  (51, 'Alejandro Ramos', 'ale.ramos2015@hotmail.com', '091048028', '5.060.002-4', 'Pase Libre', '2026-07-08'::date, '2026-07-08'::date, '2026-10-06'::date, 0, 'Efectivo', NULL),
  (52, 'Antonio Bracco', 'antoniobracco0@gmail.com', '098732723', '4.769.384-0', 'Pase Libre', '2026-07-08'::date, '2026-07-08'::date, '2026-10-06'::date, 0, 'Efectivo', NULL),
  (53, 'Tomas Silva', '', '092275557', '5.290.517-8', 'Trimestral', '2026-07-02'::date, '2026-07-02'::date, '2026-09-30'::date, 6500, 'Transferencia', NULL),
  (54, 'Nelson Fernandez', 'nelsonfernandez111@gmail.com', '098381809', '4.907.894-1', 'Pase Libre', '2026-06-21'::date, '2026-06-21'::date, '2026-09-19'::date, 0, 'Efectivo', NULL),
  (55, 'Valentina Villamonte', 'villamontevalentina@gmail.com', '094613501', '4.479.702-7', 'Pase Libre', '2026-06-21'::date, '2026-06-21'::date, '2026-09-19'::date, 0, 'Efectivo', NULL),
  (56, 'Alejandra Clivio', 'macli37@gmail.com', '091801522', '4.810.773-7', 'Tu Pase', '2026-06-21'::date, '2026-06-21'::date, '2026-09-19'::date, 0, 'Efectivo', NULL),
  (57, 'Florencia Urtiaga', 'florencia.urt@gmail.com', '093351776', '4 .537.167-2', 'Trimestral', '2026-06-21'::date, '2026-06-21'::date, '2026-09-19'::date, 6500, 'Transferencia', NULL),
  (58, 'Lucia Santana', 'lucissantana68@gmail.com', '094734454', '4.878.829-8', 'Trimestral', '2026-05-07'::date, '2026-05-17'::date, '2026-09-17'::date, 8600, 'Transferencia', NULL),
  (59, 'Daniela Gonzalez', 'mauriciomazondo@gmail.com', '091057657', '4.792.791-0', 'Semestral', '2026-03-20'::date, '2026-03-20'::date, '2026-09-16'::date, 12600, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (60, 'Mariano Quiroga', 'borjafranq@gmail.com', '092020816', '1.823.364-7', 'Mensual', '2026-08-15'::date, '2026-08-15'::date, '2026-09-14'::date, 2500, 'Transferencia', NULL),
  (61, 'Luz Inchauspe', 'luzinchauspe2004@gmail.com', '098755540', '6.011.745-9', 'Mensual', '2026-08-14'::date, '2026-08-14'::date, '2026-09-13'::date, 2500, 'Transferencia', NULL),
  (62, 'Celeste Giraudo', 'celestegiraudo04@gmail.com', '099416003', '5.733.279-3', 'Promo Estudiante', '2026-08-13'::date, '2026-08-13'::date, '2026-09-12'::date, 1800, 'Transferencia', NULL),
  (63, 'Elisa Fossemale', '', '094343776', '4.345.653-1', 'Promo Estudiante', '2026-08-12'::date, '2026-08-12'::date, '2026-09-11'::date, 1800, 'Transferencia', NULL),
  (64, 'Evelyn Rivera', 'evelynriveramier@gmail.com', '094487616', '4.499.734-4', 'Mensual', '2026-08-12'::date, '2026-08-12'::date, '2026-09-11'::date, 2500, 'Transferencia', NULL),
  (65, 'Joaquin Escudero', 'escuderojoaquin2007@gmail.com', '092187412', '5.671.565-5', 'Mensual', '2026-08-12'::date, '2026-08-12'::date, '2026-09-11'::date, 2500, 'Transferencia', NULL),
  (66, 'Maria Noel Bergero', '', '099912578', '4.861.970-0', 'Trimestral', '2026-06-12'::date, '2026-06-12'::date, '2026-09-10'::date, 6800, 'Tarjeta de Crédito', 'VISA'),
  (67, 'Guadalupe Arbelo', 'lupearbe@hotmail.com', '096116028', '5.563.308-6', 'Promo Estudiante', '2026-08-11'::date, '2026-08-11'::date, '2026-09-10'::date, 1800, 'Transferencia', NULL),
  (68, 'Mariana Melo', 'melodesouzamariana@gmail.com', '099941315', '5.346.260-9', 'Mensual', '2026-08-11'::date, '2026-08-11'::date, '2026-09-10'::date, 2500, 'Transferencia', NULL),
  (69, 'Mnauela Bentura', 'manuelabentura@gmail.com', '099160948', '5.077.960-3', 'Promo Estudiante', '2026-08-11'::date, '2026-08-11'::date, '2026-09-10'::date, 2100, 'Tarjeta de Crédito', 'VISA'),
  (70, 'Mariana Sambran', '', '094881149', '4.608.188-0', 'Trimestral', '2026-06-10'::date, '2026-06-10'::date, '2026-09-08'::date, 6800, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (71, 'Sofia Nuñez', '', '098492061', '4.817.573-0', 'Trimestral', '2026-06-10'::date, '2026-06-10'::date, '2026-09-08'::date, 6500, 'Transferencia', NULL),
  (72, 'Aylen Guevara', '', '091673229', '4.988.488-1', 'Mensual', '2026-08-08'::date, '2026-08-08'::date, '2026-09-07'::date, 2500, 'Transferencia', NULL),
  (73, 'Maximilano Nuñez', 'maxinb17@gmail.com', '093784204', '5.132.829-3', 'Mensual', '2026-08-08'::date, '2026-08-08'::date, '2026-09-07'::date, 1800, 'Transferencia', NULL),
  (74, 'Belen Duran', 'mabeduran2@gmail.com', '098103063', '5.310.397-2', 'Mensual', '2026-08-08'::date, '2026-08-08'::date, '2026-09-07'::date, 2500, 'Transferencia', NULL),
  (75, 'Marcelo Verdun', 'mverdums@gmail.com', '099864403', '2.539.884-6', 'Promo Estudiante', '2026-08-07'::date, '2026-08-07'::date, '2026-09-06'::date, 1800, 'Transferencia', NULL),
  (76, 'Lucia Celecia', '', '091046904', '5.469.006-9', 'Mensual', '2026-08-07'::date, '2026-08-07'::date, '2026-09-06'::date, 2500, 'Transferencia', NULL),
  (77, 'Joaquin Davyt', '', '098173378', '4.613.441-9', 'Mensual', '2026-08-07'::date, '2026-08-07'::date, '2026-09-06'::date, 2500, 'Transferencia', NULL),
  (78, 'Melany Plada', 'melyplada3@gmail.com', '091683274', '5.716.099-4', 'Promo Estudiante', '2026-08-07'::date, '2026-08-07'::date, '2026-09-06'::date, 1800, 'Transferencia', NULL),
  (79, 'Evelyn Brun', 'evelynbrun1718@gmail.com', '092797375', '5.406.294-7', 'Promo Estudiante', '2026-08-07'::date, '2026-08-07'::date, '2026-09-06'::date, 1800, 'Transferencia', NULL),
  (80, 'Rodrigo Perez', 'rodrigo1767@hotmail.com', '099925977', '3.732.686-9', 'Mensual', '2026-08-07'::date, '2026-08-07'::date, '2026-09-06'::date, 2500, 'Transferencia', NULL),
  (81, 'Jimena Bentos', '', '099906670', '4.487.355-0', 'Mensual', '2026-08-07'::date, '2026-08-07'::date, '2026-09-06'::date, 2000, 'Transferencia', NULL),
  (82, 'Sibo Gonzalez', 'sibo.ari@gmail.com', '096212324', '3.449.224-9', 'Mensual', '2026-08-07'::date, '2026-08-07'::date, '2026-09-06'::date, 2500, 'Transferencia', NULL),
  (83, 'Ezequiel Cortez', '', '091675213', '5.340.454-6', 'Mensual', '2026-08-07'::date, '2026-08-07'::date, '2026-09-06'::date, 2100, 'Transferencia', NULL),
  (84, 'Nahuel Vignolo', 'nahuelvignolo_8@outlook.com', '098304414', '4.807.705-9', 'Promo Estudiante', '2026-08-06'::date, '2026-08-06'::date, '2026-09-05'::date, 1800, 'Transferencia', NULL),
  (85, 'Camila Mendez', 'camendezmartinez@gmail.com', '099314635', '4.567.177-5', 'Trimestral', '2026-06-07'::date, '2026-06-07'::date, '2026-09-05'::date, 6500, 'Transferencia', NULL),
  (86, 'Patricia Botti', 'patoboti@vera.com.uy', '099119967', '3.311.942-8', 'Trimestral', '2026-06-07'::date, '2026-06-07'::date, '2026-09-05'::date, 6800, 'Tarjeta de Crédito', 'MASTER'),
  (87, 'Leticia Casales', 'casalet1972@yahoo.com.ar', '098311671', '2.895.854-8', 'Trimestral', '2026-06-07'::date, '2026-06-07'::date, '2026-09-05'::date, 6800, 'Tarjeta de Crédito', 'MASTER'),
  (88, 'Silvana Spagnuolo', '', '099388348', '2.559.819-1', 'Trimestral', '2026-06-07'::date, '2026-06-07'::date, '2026-09-05'::date, 6800, 'Tarjeta de Crédito', 'VISA'),
  (89, 'Ernesto Bona', '', '099611684', '6.472.926-4', 'Mensual', '2026-08-06'::date, '2026-08-06'::date, '2026-09-05'::date, 2500, 'Efectivo', NULL),
  (90, 'Lilian Mayolas', '', '099635287', '1.975.804-2', 'Semestral', '2026-03-08'::date, '2026-03-08'::date, '2026-09-04'::date, 12600, 'Tarjeta de Crédito', 'VISA'),
  (91, 'Enzo Castellini', 'beaa.fontan@gmail.com', '098701810', '4.687.540-3', 'Semestral', '2026-03-08'::date, '2026-03-08'::date, '2026-09-04'::date, 12600, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (92, 'Adriana Dpalleja', '', '099664939', '1.531.057-9', 'Mensual', '2026-08-05'::date, '2026-08-05'::date, '2026-09-04'::date, 2500, 'Transferencia', NULL),
  (93, 'Eugenia Hernandez', '', '092984541', '5.701.873-9', 'Promo Estudiante', '2026-08-04'::date, '2026-08-04'::date, '2026-09-03'::date, 1800, 'Transferencia', NULL),
  (94, 'Cecilia Bentancor', '', '091030334', '5.276.159-7', 'Mensual', '2026-08-04'::date, '2026-08-04'::date, '2026-09-03'::date, 2500, 'Transferencia', NULL),
  (95, 'Lucia Diaz', '', '098112712', '4 65.4 8.39 -7', 'Mensual', '2026-08-04'::date, '2026-08-04'::date, '2026-09-03'::date, 2500, 'Transferencia', NULL),
  (96, 'Tamara Linfa', 'tamaralinfa@gmail.com', '098822926', '5.183.725-8', 'Trimestral', '2026-06-03'::date, '2026-06-03'::date, '2026-09-01'::date, 6800, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (97, 'Gerardo Larrosa', 'ger108_4@hotmail.com', '097544406', '4.707.903-4', 'Mensual', '2026-08-02'::date, '2026-08-02'::date, '2026-09-01'::date, 2500, 'Transferencia', NULL),
  (98, 'Nicole Oxoby', '', '091690394', '5.380.067-3', 'Promo Estudiante', '2026-07-31'::date, '2026-07-31'::date, '2026-08-30'::date, 1800, 'Transferencia', NULL),
  (99, 'Victoria Silva', 'mariavictoriasilvauroz@gmail.com', '099787755', '5.681.242-3', 'Mensual', '2026-07-31'::date, '2026-07-31'::date, '2026-08-30'::date, 2500, 'Transferencia', NULL),
  (100, 'Juan Martin Riccetto', '', '091028443', '5.324.939-0', 'Promo Estudiante', '2026-07-29'::date, '2026-07-29'::date, '2026-08-28'::date, 1800, 'Transferencia', NULL),
  (101, 'Lucia Fernandez', 'lucianafmendy@gmail.com', '095217999', '4.933.145-8', 'Mensual', '2026-07-29'::date, '2026-07-29'::date, '2026-08-28'::date, 2500, 'Transferencia', NULL),
  (102, 'Andrea Marquez', 'eamarquezgarcia@gmail.com', '098460725', '2.631.375-2', 'Mensual', '2026-07-29'::date, '2026-07-29'::date, '2026-08-28'::date, 2500, 'Transferencia', NULL),
  (103, 'Gerardo Trujillo', 'gerardotrujillo2305@gmail.com', '', '4.813.549-3', 'Mensual', '2026-07-28'::date, '2026-07-28'::date, '2026-08-27'::date, 2000, 'Transferencia', NULL),
  (104, 'Florencia Almeida', 'floralmecur@gmail.com', '098079517', '5.089.558-6', 'Promo Estudiante', '2026-07-28'::date, '2026-07-28'::date, '2026-08-27'::date, 1800, 'Transferencia', NULL),
  (105, 'Silvia Roberto', '', '097570399', '2.933.015-7', 'Mensual', '2026-07-28'::date, '2026-07-28'::date, '2026-08-27'::date, 2500, 'Transferencia', NULL),
  (106, 'Jhaliany Herrera', '', '092126664', '6.047.630-2', 'Trimestral', '2026-05-29'::date, '2026-05-29'::date, '2026-08-27'::date, 6500, 'Transferencia', NULL),
  (107, 'Gabriel Sirota', '', '091481708', '3.072.866-4', 'Mensual', '2026-07-22'::date, '2026-07-22'::date, '2026-08-21'::date, 2500, 'Transferencia', NULL),
  (108, 'Viviana Bula', 'vivicaro07@hotmail.com', '095173275', '4.265.291-8', 'Semestral', '2025-08-23'::date, '2025-08-23'::date, '2026-08-18'::date, 10200, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (109, 'Martin Puime', 'puimemartin@gmail.com', '094936856', '3.979.547-4', 'Promo Estudiante', '2026-07-19'::date, '2026-07-19'::date, '2026-08-18'::date, 1800, 'Transferencia', NULL),
  (110, 'Mikaela Cedres', 'mikaelacedres1802@gmail.com', '096249263', '5.380.555-4', 'Trimestral', '2026-05-18'::date, '2026-05-18'::date, '2026-08-16'::date, 3600, 'Transferencia', NULL),
  (111, 'Rocio Domini', 'rociodomini34@gmail.com', '098700499', '5.719.805-8', 'Mensual', '2026-05-18'::date, '2026-05-18'::date, '2026-08-16'::date, 2700, 'Transferencia', NULL),
  (112, 'Romina Plada', '', '098783486', '5.497.131-4', 'Promo Estudiante', '2026-07-16'::date, '2026-07-16'::date, '2026-08-15'::date, 1800, 'Transferencia', NULL),
  (113, 'Alejandro Gamallo', '', '096572659', '4.841.048-7', 'Mensual', '2026-07-16'::date, '2026-07-16'::date, '2026-08-15'::date, 2500, 'Transferencia', NULL),
  (114, 'Luciana Marin', 'lucianamarin1212@gmail.com', '096952946', '4.849.367-1', 'Mensual', '2026-07-16'::date, '2026-07-16'::date, '2026-08-15'::date, 2500, 'Transferencia', NULL),
  (115, 'Jessica Silva', 'jessica.silva@vera.com.uy', '098264939', '3.464.673-3', 'Mensual', '2026-07-15'::date, '2026-07-15'::date, '2026-08-14'::date, 2500, 'Transferencia', NULL),
  (116, 'Katya Correa', 'katyarcorrea@gmai.com', '099148892', '4.373.383-4', 'Mensual', '2026-07-14'::date, '2026-07-14'::date, '2026-08-13'::date, 2500, 'Transferencia', NULL),
  (117, 'Deborah Migorena', 'debvargas21@hotmail.com', '099480811', '5.114.526-5', 'Mensual', '2026-07-09'::date, '2026-07-09'::date, '2026-08-08'::date, 2500, 'Transferencia', NULL),
  (118, 'Alejandra Lambert', 'alelambert10@gmail.com', '093774589', '5.350.048-9', 'Mensual', '2026-07-07'::date, '2026-07-07'::date, '2026-08-06'::date, 2500, 'Transferencia', NULL),
  (119, 'Clementina German', 'clementinagerman@gmail.com', '098328775', '4.826.969-4', 'Mensual', '2026-07-02'::date, '2026-07-02'::date, '2026-08-01'::date, 2500, 'Tarjeta de Crédito', 'MERCADO PAGO'),
  (120, 'Pamela Pereiradasneves', 'pamela.-09@hotmail.com', '', '5.035.023-3', 'Mensual', '2026-06-30'::date, '2026-06-30'::date, '2026-07-30'::date, 2500, 'Transferencia', NULL),
  (121, 'Franco Ramirez', 'framir2496@gmail.com', '099363231', '4.969.019-1', 'Promo Estudiante', '2026-06-17'::date, '2026-06-17'::date, '2026-07-17'::date, 1800, 'Transferencia', NULL);

-- Validaciones antes de realizar cambios.
DO $$
BEGIN
  IF (SELECT count(*) FROM exo_member_import) <> 121 THEN
    RAISE EXCEPTION 'La importaciÃ³n debe contener 121 filas.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM exo_member_import source
    WHERE (
      SELECT count(*)
      FROM plans plan
      WHERE plan.gym_id = 'exo_gym'
        AND plan.is_active = true
        AND btrim(plan.name) = btrim(source.plan_name)
    ) <> 1
  ) THEN
    RAISE EXCEPTION 'Hay un plan inexistente, inactivo o duplicado para Exo.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM exo_member_import
    WHERE payment_method <> 'Efectivo'
      AND payment_method <> 'Transferencia'
      AND payment_method NOT LIKE 'Tarjeta de Cr%'
  ) THEN
    RAISE EXCEPTION 'Hay un mÃ©todo de pago no permitido.';
  END IF;
END
$$;

INSERT INTO members (
  id, gym_id, name, email, phone, cedula, referral_source, join_date,
  plan, plan_price, last_payment, next_payment, status, balance_due,
  inactive_level, followed_up, expiring_soon_contacted
)
SELECT
  format('exo_gym_member_import_%s', source.row_no),
  'exo_gym',
  source.name,
  source.email,
  source.phone,
  source.cedula,
  'Otro',
  source.payment_date,
  source.plan_name,
  source.amount,
  source.plan_start_date,
  source.plan_end_date,
  CASE
    WHEN source.plan_end_date >= CURRENT_DATE THEN 'active'
    WHEN source.plan_end_date >= CURRENT_DATE - 30 THEN 'expired'
    ELSE 'inactive'
  END,
  0,
  CASE WHEN source.plan_end_date < CURRENT_DATE - 30 THEN 'yellow' ELSE NULL END,
  false,
  false
FROM exo_member_import source
ON CONFLICT (id) DO NOTHING;

INSERT INTO payments (
  id, gym_id, member_id, member_name, amount, date, start_date, plan,
  method, card_brand, card_installments, type, description, plan_id
)
SELECT
  format('exo_gym_payment_import_%s', source.row_no),
  'exo_gym',
  format('exo_gym_member_import_%s', source.row_no),
  source.name,
  source.amount,
  source.payment_date,
  source.plan_start_date,
  source.plan_name,
  source.payment_method,
  source.card_brand,
  CASE WHEN source.payment_method LIKE 'Tarjeta de Cr%' THEN 1 ELSE NULL END,
  'plan',
  'Pago de plan ' || source.plan_name,
  plan.id
FROM exo_member_import source
JOIN plans plan
  ON plan.gym_id = 'exo_gym'
 AND plan.is_active = true
 AND btrim(plan.name) = btrim(source.plan_name)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Control posterior: debe devolver 121 socios y 121 pagos de esta importaciÃ³n.
SELECT
  (SELECT count(*) FROM members WHERE gym_id = 'exo_gym' AND id LIKE 'exo_gym_member_import_%') AS socios_importados,
  (SELECT count(*) FROM payments WHERE gym_id = 'exo_gym' AND id LIKE 'exo_gym_payment_import_%') AS pagos_importados;
