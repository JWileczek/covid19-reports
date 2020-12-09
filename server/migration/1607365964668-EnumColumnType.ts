import { MigrationInterface, QueryRunner } from "typeorm";

export class EnumColumnType1607365964668 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."custom_roster_column_type_enum" RENAME TO "custom_roster_column_type_enum_old"`);
    await queryRunner.query(`CREATE TYPE "custom_roster_column_type_enum" AS ENUM('string', 'boolean', 'date', 'datetime', 'number', 'enum')`);
    await queryRunner.query(`ALTER TABLE "custom_roster_column" ALTER COLUMN "type" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "custom_roster_column" ALTER COLUMN "type" TYPE "custom_roster_column_type_enum" USING "type"::"text"::"custom_roster_column_type_enum"`);
    await queryRunner.query(`ALTER TABLE "custom_roster_column" ALTER COLUMN "type" SET DEFAULT 'string'`);
    await queryRunner.query(`DROP TYPE "custom_roster_column_type_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "custom_roster_column_type_enum_old" AS ENUM('string', 'boolean', 'date', 'datetime', 'number')`);
    await queryRunner.query(`ALTER TABLE "custom_roster_column" ALTER COLUMN "type" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "custom_roster_column" ALTER COLUMN "type" TYPE "custom_roster_column_type_enum_old" USING "type"::"text"::"custom_roster_column_type_enum_old"`);
    await queryRunner.query(`ALTER TABLE "custom_roster_column" ALTER COLUMN "type" SET DEFAULT 'string'`);
    await queryRunner.query(`DROP TYPE "custom_roster_column_type_enum"`);
    await queryRunner.query(`ALTER TYPE "custom_roster_column_type_enum_old" RENAME TO  "custom_roster_column_type_enum"`);
  }

}
