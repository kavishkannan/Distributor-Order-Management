import { MigrationInterface, QueryRunner } from "typeorm";

export class HardenOrderEventLog1790600000000 implements MigrationInterface {
  name = "HardenOrderEventLog1790600000000";

  public async up(Runner: QueryRunner): Promise<void> {
    await Runner.query(
      "ALTER TABLE order_events ADD COLUMN sequence BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE",
    );
    await Runner.query(
      "ALTER TABLE order_events ADD COLUMN idempotencyKey VARCHAR(100) NULL, ADD UNIQUE INDEX UQ_order_events_idempotency_key (idempotencyKey)",
    );
    await Runner.query(
      "CREATE TRIGGER trg_order_events_no_update BEFORE UPDATE ON order_events FOR EACH ROW " +
        "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_events is append-only: rows cannot be updated'",
    );
    await Runner.query(
      "CREATE TRIGGER trg_order_events_no_delete BEFORE DELETE ON order_events FOR EACH ROW " +
        "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_events is append-only: rows cannot be deleted'",
    );
  }

  public async down(Runner: QueryRunner): Promise<void> {
    await Runner.query("DROP TRIGGER IF EXISTS trg_order_events_no_delete");
    await Runner.query("DROP TRIGGER IF EXISTS trg_order_events_no_update");
    await Runner.query(
      "ALTER TABLE order_events DROP INDEX UQ_order_events_idempotency_key, DROP COLUMN idempotencyKey",
    );
    await Runner.query("ALTER TABLE order_events DROP COLUMN sequence");
  }
}
