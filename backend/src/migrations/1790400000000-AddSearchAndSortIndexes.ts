import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

export class AddSearchAndSortIndexes1790400000000 implements MigrationInterface {
  name = "AddSearchAndSortIndexes1790400000000";

  public async up(Runner: QueryRunner): Promise<void> {
    await Runner.createIndex(
      "orders",
      new TableIndex({
        name: "IDX_orders_created_at",
        columnNames: ["Created_At"],
      }),
    );
    await Runner.createIndex(
      "products",
      new TableIndex({ name: "IDX_products_name", columnNames: ["name"] }),
    );
  }

  public async down(Runner: QueryRunner): Promise<void> {
    await Runner.dropIndex("products", "IDX_products_name");
    await Runner.dropIndex("orders", "IDX_orders_created_at");
  }
}
