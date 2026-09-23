import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { OrderLineItemEntity } from "./OrderLineItemEntity";

@Entity("products")
@Index(["Name"])
export class ProductEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  Id: string;

  @Column({ name: "sku", type: "varchar", unique: true })
  Sku: string;

  @Column({ name: "name", type: "varchar" })
  Name: string;

  @Column({ name: "unitPrice", type: "decimal", precision: 10, scale: 2 })
  UnitPrice: number;

  @Column({ name: "stockQuantity", type: "int" })
  StockQuantity: number;

  @Column({ name: "Is_Deleted", type: "boolean", default: false })
  IsDeleted: boolean;

  @CreateDateColumn({ name: "Created_At" })
  CreatedAt: Date;

  @UpdateDateColumn({ name: "Updated_At" })
  UpdatedAt: Date;

  @Column({ name: "Created_by", type: "varchar", length: 36, nullable: true })
  CreatedBy: string | null;

  @OneToMany(() => OrderLineItemEntity, (LineItem) => LineItem.Product)
  OrderLineItems: OrderLineItemEntity[];
}
