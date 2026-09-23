import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRevokedTokens1790700000000 implements MigrationInterface {
  name = "CreateRevokedTokens1790700000000";

  public async up(Runner: QueryRunner): Promise<void> {
    await Runner.query(
      "CREATE TABLE revoked_tokens (" +
        "tokenHash CHAR(64) NOT NULL PRIMARY KEY, " +
        "user_id VARCHAR(36) NOT NULL, " +
        "expiresAt DATETIME NOT NULL, " +
        "revokedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), " +
        "INDEX IDX_revoked_tokens_expires_at (expiresAt), " +
        "CONSTRAINT FK_revoked_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE" +
        ") ENGINE=InnoDB",
    );
  }

  public async down(Runner: QueryRunner): Promise<void> {
    await Runner.query("DROP TABLE revoked_tokens");
  }
}
