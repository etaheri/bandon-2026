-- The Wednesday warm-up (r1) was removed in 0003, so the six counting rounds
-- are renumbered Round 1..6 to match the board's R1..R6 numbering (the round ids
-- stay r2..r7 for stability). This keeps every screen's round number consistent.
UPDATE rounds SET label = 'Round 1' WHERE id = 'r2';
UPDATE rounds SET label = 'Round 2' WHERE id = 'r3';
UPDATE rounds SET label = 'Round 3' WHERE id = 'r4';
UPDATE rounds SET label = 'Round 4' WHERE id = 'r5';
UPDATE rounds SET label = 'Round 5' WHERE id = 'r6';
UPDATE rounds SET label = 'Round 6' WHERE id = 'r7';
