import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from "typeorm";

export class AddOutboundEventRetryColumns1790200000000 implements MigrationInterface {
  name = "AddOutboundEventRetryColumns1790200000000";

  public async up(Runner: QueryRunner): Promise<void> {
    await Runner.addColumns("outbound_events", [
      new TableColumn({
        name: "lastAttemptedAt",
        type: "datetime",
        isNullable: true,
      }),
      new TableColumn({
        name: "nextRetryAt",
        type: "datetime",
        isNullable: true,
      }),
      new TableColumn({
        name: "errorMessage",
        type: "varchar",
        length: "500",
        isNullable: true,
      }),
    ]);

    await Runner.createIndex(
      "outbound_events",
      new TableIndex({
        name: "IDX_outbound_events_retry",
        columnNames: ["status", "nextRetryAt"],
      }),
    );
  }

  public async down(Runner: QueryRunner): Promise<void> {
    await Runner.dropIndex("outbound_events", "IDX_outbound_events_retry");
    await Runner.dropColumns("outbound_events", [
      "lastAttemptedAt",
      "nextRetryAt",
      "errorMessage",
    ]);
  }
}
