import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

@Entity("revoked_tokens")
export class RevokedTokenEntity {
  @PrimaryColumn({ name: "tokenHash", type: "char", length: 64 })
  TokenHash: string;

  @Column({ name: "user_id", type: "varchar", length: 36 })
  UserId: string;

  @Column({ name: "expiresAt", type: "datetime" })
  ExpiresAt: Date;

  @CreateDateColumn({ name: "revokedAt", type: "datetime", precision: 3 })
  RevokedAt: Date;
}
