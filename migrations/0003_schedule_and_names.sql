ALTER TABLE rounds ADD COLUMN date TEXT;

UPDATE players SET name = 'Erik Taheri'     WHERE id = 'taheri';
UPDATE players SET name = 'Pete DeSabio'    WHERE id = 'desabio';
UPDATE players SET name = 'Matt LaFlair'    WHERE id = 'laflair';
UPDATE players SET name = 'Bruce Stenzel'   WHERE id = 'stenzel';
UPDATE players SET name = 'Ryan Meissner'   WHERE id = 'meissner';
UPDATE players SET name = 'Jeff Grattan'    WHERE id = 'grattan';
UPDATE players SET name = 'Gavin Sloan'     WHERE id = 'sloan';
UPDATE players SET name = 'Anthony Johnson' WHERE id = 'johnson';

UPDATE rounds SET date = '2026-06-04' WHERE id IN ('r2','r3');
UPDATE rounds SET date = '2026-06-05' WHERE id IN ('r4','r5');
UPDATE rounds SET date = '2026-06-06' WHERE id IN ('r6','r7');

DELETE FROM scores WHERE round_id = 'r1';
DELETE FROM tee_assignments WHERE round_id = 'r1';
DELETE FROM rounds WHERE id = 'r1';
