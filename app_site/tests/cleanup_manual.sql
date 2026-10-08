-- cleanup_manual.sql: only needed if a test run was killed before it could restore the
-- database itself (the pytest suite and the click-through restore automatically).
-- All test rows are tagged: guest names and emails start with "ZZ" / "zz." and use
-- the example.test domain, and the bookings are dated in 2031 or later.
USE hotel_pbl;

DELETE p FROM payment p
  JOIN invoice i ON i.invoice_id = p.invoice_id
  JOIN stay s ON s.stay_id = i.stay_id
  JOIN reservation r ON r.reservation_id = s.reservation_id
  JOIN guest g ON g.guest_id = r.guest_id WHERE g.email LIKE '%@example.test';
DELETE i FROM invoice i
  JOIN stay s ON s.stay_id = i.stay_id
  JOIN reservation r ON r.reservation_id = s.reservation_id
  JOIN guest g ON g.guest_id = r.guest_id WHERE g.email LIKE '%@example.test';
DELETE sc FROM service_charge sc
  JOIN stay s ON s.stay_id = sc.stay_id
  JOIN reservation r ON r.reservation_id = s.reservation_id
  JOIN guest g ON g.guest_id = r.guest_id WHERE g.email LIKE '%@example.test';
DELETE sr FROM service_request sr
  JOIN stay s ON s.stay_id = sr.stay_id
  JOIN reservation r ON r.reservation_id = s.reservation_id
  JOIN guest g ON g.guest_id = r.guest_id WHERE g.email LIKE '%@example.test';
DELETE ht FROM housekeeping_task ht
  JOIN stay s ON s.stay_id = ht.stay_id
  JOIN reservation r ON r.reservation_id = s.reservation_id
  JOIN guest g ON g.guest_id = r.guest_id WHERE g.email LIKE '%@example.test';
-- tasks the tests added without a stay (post-checkout cleaning set today for room 102)
DELETE FROM housekeeping_task WHERE task_id > 3;
DELETE s FROM stay s
  JOIN reservation r ON r.reservation_id = s.reservation_id
  JOIN guest g ON g.guest_id = r.guest_id WHERE g.email LIKE '%@example.test';
DELETE r FROM reservation r JOIN guest g ON g.guest_id = r.guest_id WHERE g.email LIKE '%@example.test';
DELETE FROM guest WHERE email LIKE '%@example.test';

-- put room statuses back to the sample-data values if a test left one changed
UPDATE room SET status = 'available'   WHERE room_number IN ('101','102','201','301');
UPDATE room SET status = 'occupied'    WHERE room_number IN ('103','202');
UPDATE room SET status = 'maintenance' WHERE room_number = '302';
