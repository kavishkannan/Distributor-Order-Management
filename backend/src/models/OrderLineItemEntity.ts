import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { OrderEntity } from "./OrderEntity";
import { ProductEntity } from "./ProductEntity";

@Entity("order_line_items")
export class OrderLineItemEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  Id: string;

  @ManyToOne(() => OrderEntity, (Order) => Order.LineItems)
  @JoinColumn({ name: "order_id" })
  Order: OrderEntity;

  @ManyToOne(() => ProductEntity, (Product) => Product.OrderLineItems)
  @JoinColumn({ name: "product_id" })
  Product: ProductEntity;

  @Column({ name: "quantity", type: "int" })
  Quantity: number;

  @Column({ name: "unitPrice", type: "decimal", precision: 10, scale: 2 })
  UnitPrice: number;

  @Column({ name: "Is_Deleted", type: "boolean", default: false })
  IsDeleted: boolean;

  @CreateDateColumn({ name: "Created_At" })
  CreatedAt: Date;

  @UpdateDateColumn({ name: "Updated_At" })
  UpdatedAt: Date;

  @Column({ name: "Created_by", type: "varchar", length: 36, nullable: true })
  CreatedBy: string | null;
}
