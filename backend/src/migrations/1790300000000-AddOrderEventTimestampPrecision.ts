import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddOrderEventTimestampPrecision1790300000000 implements MigrationInterface {
  name = "AddOrderEventTimestampPrecision1790300000000";

  public async up(Runner: QueryRunner): Promise<void> {
    await Runner.changeColumn(
      "order_events",
      "Created_At",
      new TableColumn({
        name: "Created_At",
        type: "datetime",
        precision: 3,
        isNullable: false,
        default: "CURRENT_TIMESTAMP(3)",
      }),
    );
    await Runner.changeColumn(
      "order_events",
      "Updated_At",
      new TableColumn({
        name: "Updated_At",
        type: "datetime",
        precision: 3,
        isNullable: false,
        default: "CURRENT_TIMESTAMP(3)",
        onUpdate: "CURRENT_TIMESTAMP(3)",
      }),
    );
  }

  public async down(Runner: QueryRunner): Promise<void> {
    await Runner.changeColumn(
      "order_events",
      "Created_At",
      new TableColumn({
        name: "Created_At",
        type: "datetime",
        isNullable: false,
        default: "CURRENT_TIMESTAMP",
      }),
    );
    await Runner.changeColumn(
      "order_events",
      "Updated_At",
      new TableColumn({
        name: "Updated_At",
        type: "datetime",
        isNullable: false,
        default: "CURRENT_TIMESTAMP",
        onUpdate: "CURRENT_TIMESTAMP",
      }),
    );
  }
}
