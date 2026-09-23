import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from "typeorm";

export class AddUserAuthColumns1790500000000 implements MigrationInterface {
  name = "AddUserAuthColumns1790500000000";

  public async up(Runner: QueryRunner): Promise<void> {
    await Runner.addColumn(
      "users",
      new TableColumn({
        name: "role",
        type: "enum",
        enum: ["DISTRIBUTOR", "SALES_MANAGER"],
        isNullable: true,
      }),
    );
    await Runner.query(
      "UPDATE users SET role = 'DISTRIBUTOR' WHERE role IS NULL",
    );
    await Runner.changeColumn(
      "users",
      "role",
      new TableColumn({
        name: "role",
        type: "enum",
        enum: ["DISTRIBUTOR", "SALES_MANAGER"],
        isNullable: false,
      }),
    );

    await Runner.addColumn(
      "users",
      new TableColumn({
        name: "distributor_id",
        type: "varchar",
        length: "36",
        isNullable: true,
      }),
    );
    await Runner.addColumn(
      "users",
      new TableColumn({
        name: "sales_manager_id",
        type: "varchar",
        length: "36",
        isNullable: true,
      }),
    );

    await Runner.createForeignKey(
      "users",
      new TableForeignKey({
        name: "FK_users_distributor",
        columnNames: ["distributor_id"],
        referencedTableName: "distributors",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
    );
    await Runner.createForeignKey(
      "users",
      new TableForeignKey({
        name: "FK_users_sales_manager",
        columnNames: ["sales_manager_id"],
        referencedTableName: "sales_managers",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
    );

    await Runner.createIndex(
      "users",
      new TableIndex({
        name: "IDX_users_distributor",
        columnNames: ["distributor_id"],
      }),
    );
    await Runner.createIndex(
      "users",
      new TableIndex({
        name: "IDX_users_sales_manager",
        columnNames: ["sales_manager_id"],
      }),
    );
  }

  public async down(Runner: QueryRunner): Promise<void> {
    await Runner.dropIndex("users", "IDX_users_sales_manager");
    await Runner.dropIndex("users", "IDX_users_distributor");
    await Runner.dropForeignKey("users", "FK_users_sales_manager");
    await Runner.dropForeignKey("users", "FK_users_distributor");
    await Runner.dropColumns("users", [
      "sales_manager_id",
      "distributor_id",
      "role",
    ]);
  }
}
