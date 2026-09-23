import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("sales_managers")
export class SalesManagerEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  Id: string;

  @Column({ name: "name", type: "varchar" })
  Name: string;

  @Column({ name: "Is_Deleted", type: "boolean", default: false })
  IsDeleted: boolean;

  @CreateDateColumn({ name: "Created_At" })
  CreatedAt: Date;

  @UpdateDateColumn({ name: "Updated_At" })
  UpdatedAt: Date;

  @Column({ name: "Created_by", type: "varchar", length: 36, nullable: true })
  CreatedBy: string | null;
}
