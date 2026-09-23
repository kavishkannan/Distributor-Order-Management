import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateUsersTable1790100000000 implements MigrationInterface {
  name = "CreateUsersTable1790100000000";

  public async up(Runner: QueryRunner): Promise<void> {
    await Runner.createTable(
      new Table({
        name: "users",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "name", type: "varchar" },
          { name: "email", type: "varchar", isUnique: true },
          { name: "password", type: "varchar" },
          { name: "contactNumber", type: "varchar", isNullable: true },
          { name: "Is_Deleted", type: "boolean", default: false },
          {
            name: "Created_At",
            type: "datetime",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "Updated_At",
            type: "datetime",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
          {
            name: "Created_by",
            type: "varchar",
            length: "36",
            isNullable: true,
          },
        ],
      }),
      true,
    );
  }

  public async down(Runner: QueryRunner): Promise<void> {
    await Runner.dropTable("users", true, true, true);
  }
}
