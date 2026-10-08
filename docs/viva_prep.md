# Viva preparation — Hotel Reservation and Guest Services Management System

Answers are written from what was actually built and tested. Where the honest answer is "this is a limitation", it says so — examiners respect that more than a bluff.

## The project

**1. Describe the project in one minute.**
A MySQL database plus a Python menu application for a hotel. The database has 12 tables, 8 reporting views and 10 triggers. The app covers availability search, reservations, check-in and check-out, service charges, housekeeping, billing, payments, cancellations, guest management and reports.

**2. The ER diagram showed 11 entities. Why are there 12 tables?**
`staff`. The diagram stored `assigned_to` as a plain field on housekeeping tasks. Repeating staff names and roles on every task invites update anomalies, so I made it a foreign key to a separate `staff` table.

**3. Why is `stay` separate from `reservation`?**
A reservation exists before the guest arrives and can be cancelled or a no-show. A stay holds the *actual* check-in and check-out and exists only if the guest turns up (1 to 0..1). Merging them would leave many empty columns.

## Normalization

**4. Which normal form is the design in?**
Ten of the twelve tables are in BCNF, which also means 3NF, because every determinant is a candidate key. Two tables, `service_charge` and `housekeeping_task`, are a deliberate exception.

**5. What is the exception, and why?**
`service_request_id` on a charge is optional, so `stay_id` must also be stored on the charge. When a request is present, `stay_id` is derivable from it, which is a transitive dependency. The same applies to `housekeeping_task.room_id` and `stay_id`. Making the links mandatory would force fake requests or stays, so I kept the redundancy and added triggers that reject any row where the two values disagree.

**6. Give an example of a functional dependency.**
`room_id → room_number, type_id, status`. And `type_id → type_name, capacity, description` in `room_type`. Because `room` stores only `type_id`, capacity is never repeated per room.

**7. Invoice totals can be calculated. Why store them?**
It is a billing snapshot. Once an invoice is issued it must not change if rates change later. The app computes the totals once, at check-out.

## Integrity and transactions

**8. How do you prevent double booking?**
A trigger on `reservation` rejects a booking when another active booking for the same room satisfies `new_check_in < existing_check_out AND new_check_out > existing_check_in`. Cancelled and no-show reservations are ignored. A composite index on `(room_id, dates)` speeds the lookup.

**9. Why triggers and not just Python checks?**
Rules in the database protect the data whichever client connects: this app, Workbench, or a future web app. A Python-only check can be bypassed.

**10. Why not use CHECK constraints for everything?**
A CHECK can only look at the row being written. Overlap, capacity and payment limits need to look at other rows or tables, so they are triggers. Simple rules such as non-negative amounts and date order are CHECK constraints.

**11. What is a transaction, and where did you use one?**
A group of statements that either all succeed or all fail (atomicity). Check-in (stay, reservation status, room status), check-out (close the stay and create the invoice), posting a service charge, finishing a housekeeping task, and creating a new guest together with their reservation all run as single transactions. I tested it by making the second statement of a two-step transaction fail and confirming the first was rolled back.

**12. What happens if two operators book the same room at the same instant?**
Honest answer: the overlap check inside the trigger is not race-proof under concurrent writers. For a single-operator console it is fine. In production I would lock the room row (`SELECT ... FOR UPDATE`) or use a stricter isolation level.

**13. Why does deleting a guest with reservations fail?**
Foreign keys use the default RESTRICT behaviour, deliberately. A guest's history must not vanish silently. The app shows a clear message instead of a database error.

**14. Why is cancellation not a delete?**
Cancelling sets the status to `cancelled` and keeps the row, because the cancellations report and the audit trail need it. Stays, invoices and payments are never deleted.

## Application and security

**15. How do you prevent SQL injection?**
Every value the operator types is passed to MySQL as a parameter (`%s` placeholders). User text is never concatenated into the SQL string.

**16. Why a dedicated database user and a `.env` file?**
The app connects as its own user with rights on `hotel_pbl` only, never as root. Credentials live in `.env`, which is not shared; only `.env.example` is.

**17. How is the bill calculated?**
Nights stayed times the nightly rate (a same-day stay counts as one night), plus all service charges, plus 5% tax. The invoice then moves from open to partially paid to paid as payments arrive, set automatically by a trigger.

**18. What does the index do?**
`idx_reservation_dates` on `(room_id, planned_check_in, planned_check_out)` serves the availability and overlap lookups. `EXPLAIN` shows MySQL using it (type `range`, `Using index`).

**19. Why use views for the reports?**
They hide the multi-table joins behind a name, and they are always current because they read live data.

## Limitations (say these before they are asked)

**20. What are the limitations?**
- Command-line interface for a single operator. There is no login, so the Review 1 roles (receptionist, housekeeping, manager) are described in the design but not enforced.
- Rooms, room types, rate plans and staff are maintained with SQL scripts, not through the menu.
- Tax is fixed at 5%, and rate plans have no validity dates.
- The overlap check is not concurrency-safe (see question 12).

**21. What would you build next?**
A web front end with login and role-based access, a menu for maintaining rooms and rates, seasonal rate plans, and row locking for concurrent bookings.

## Testing

**22. How did you test it?**
The eight business rules were each broken directly in SQL and every one was rejected with no data changed. A full workflow session and a deliberate-error session were run through the menu with no crashes. Thirteen labeled queries were checked against expected output, and the transaction rollback was tested directly.
