import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from "typeorm";

const AuditColumns = [
  { name: "Is_Deleted", type: "boolean", default: false },
  { name: "Created_At", type: "datetime", default: "CURRENT_TIMESTAMP" },
  {
    name: "Updated_At",
    type: "datetime",
    default: "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  },
  { name: "Created_by", type: "varchar", length: "36", isNullable: true },
];

export class CreateSchema1790035200000 implements MigrationInterface {
  name = "CreateSchema1790035200000";

  public async up(Runner: QueryRunner): Promise<void> {
    await Runner.createTable(
      new Table({
        name: "products",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "sku", type: "varchar", isUnique: true },
          { name: "name", type: "varchar" },
          { name: "unitPrice", type: "decimal", precision: 10, scale: 2 },
          { name: "stockQuantity", type: "int" },
          ...AuditColumns,
        ],
      }),
      true,
    );

    await Runner.createTable(
      new Table({
        name: "distributors",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "name", type: "varchar" },
          { name: "creditLimit", type: "decimal", precision: 10, scale: 2 },
          ...AuditColumns,
        ],
      }),
      true,
    );

    await Runner.createTable(
      new Table({
        name: "sales_managers",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "name", type: "varchar" },
          ...AuditColumns,
        ],
      }),
      true,
    );

    await Runner.createTable(
      new Table({
        name: "orders",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "distributor_id", type: "varchar", length: "36" },
          {
            name: "status",
            type: "enum",
            enum: [
              "Placed",
              "Confirmed",
              "PendingApproval",
              "Rejected",
              "Dispatched",
              "Delivered",
              "Cancelled",
            ],
          },
          { name: "discountPercent", type: "decimal", precision: 5, scale: 2 },
          { name: "subtotal", type: "decimal", precision: 10, scale: 2 },
          { name: "total", type: "decimal", precision: 10, scale: 2 },
          {
            name: "idempotencyKey",
            type: "varchar",
            isUnique: true,
            isNullable: true,
          },
          ...AuditColumns,
        ],
      }),
      true,
    );

    await Runner.createForeignKey(
      "orders",
      new TableForeignKey({
        columnNames: ["distributor_id"],
        referencedTableName: "distributors",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
    );

    await Runner.createIndex(
      "orders",
      new TableIndex({
        name: "IDX_orders_distributor",
        columnNames: ["distributor_id"],
      }),
    );
    await Runner.createIndex(
      "orders",
      new TableIndex({ name: "IDX_orders_status", columnNames: ["status"] }),
    );

    await Runner.createTable(
      new Table({
        name: "order_line_items",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "order_id", type: "varchar", length: "36" },
          { name: "product_id", type: "varchar", length: "36" },
          { name: "quantity", type: "int" },
          { name: "unitPrice", type: "decimal", precision: 10, scale: 2 },
          ...AuditColumns,
        ],
      }),
      true,
    );

    await Runner.createForeignKey(
      "order_line_items",
      new TableForeignKey({
        columnNames: ["order_id"],
        referencedTableName: "orders",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );

    await Runner.createForeignKey(
      "order_line_items",
      new TableForeignKey({
        columnNames: ["product_id"],
        referencedTableName: "products",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
    );

    await Runner.createTable(
      new Table({
        name: "order_events",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "order_id", type: "varchar", length: "36" },
          { name: "fromStatus", type: "varchar", isNullable: true },
          { name: "toStatus", type: "varchar" },
          {
            name: "actorType",
            type: "enum",
            enum: ["Distributor", "SalesManager", "System"],
          },
          { name: "actorId", type: "varchar", length: "36", isNullable: true },
          ...AuditColumns,
        ],
      }),
      true,
    );

    await Runner.createForeignKey(
      "order_events",
      new TableForeignKey({
        columnNames: ["order_id"],
        referencedTableName: "orders",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );

    await Runner.createIndex(
      "order_events",
      new TableIndex({
        name: "IDX_order_events_order",
        columnNames: ["order_id"],
      }),
    );

    await Runner.createTable(
      new Table({
        name: "points_ledger",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "distributor_id", type: "varchar", length: "36" },
          { name: "order_id", type: "varchar", length: "36" },
          { name: "points", type: "int" },
          ...AuditColumns,
        ],
      }),
      true,
    );

    await Runner.createForeignKey(
      "points_ledger",
      new TableForeignKey({
        columnNames: ["distributor_id"],
        referencedTableName: "distributors",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );

    await Runner.createForeignKey(
      "points_ledger",
      new TableForeignKey({
        columnNames: ["order_id"],
        referencedTableName: "orders",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );

    await Runner.createIndex(
      "points_ledger",
      new TableIndex({
        name: "IDX_points_ledger_distributor",
        columnNames: ["distributor_id"],
      }),
    );

    await Runner.createTable(
      new Table({
        name: "outbound_events",
        columns: [
          { name: "id", type: "varchar", length: "36", isPrimary: true },
          { name: "order_id", type: "varchar", length: "36" },
          { name: "eventType", type: "varchar" },
          { name: "payload", type: "json" },
          { name: "status", type: "enum", enum: ["Pending", "Sent", "Failed"] },
          { name: "attemptCount", type: "int", default: 0 },
          ...AuditColumns,
        ],
      }),
      true,
    );

    await Runner.createForeignKey(
      "outbound_events",
      new TableForeignKey({
        columnNames: ["order_id"],
        referencedTableName: "orders",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
    );
  }

  public async down(Runner: QueryRunner): Promise<void> {
    await Runner.dropTable("outbound_events", true, true, true);
    await Runner.dropTable("points_ledger", true, true, true);
    await Runner.dropTable("order_events", true, true, true);
    await Runner.dropTable("order_line_items", true, true, true);
    await Runner.dropTable("orders", true, true, true);
    await Runner.dropTable("sales_managers", true, true, true);
    await Runner.dropTable("distributors", true, true, true);
    await Runner.dropTable("products", true, true, true);
  }
}
