import { MigrationInterface, QueryRunner } from "typeorm";

export class CustomColumnConfig1607095477277 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "custom_roster_column" ADD "config" json NOT NULL DEFAULT '{}'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "custom_roster_column" DROP COLUMN "config"`);
  }

}
