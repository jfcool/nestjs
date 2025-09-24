import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentMetadata1727164626000 implements MigrationInterface {
  name = 'AddDocumentMetadata1727164626000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "documents" 
      ADD COLUMN "documentType" character varying,
      ADD COLUMN "category" character varying,
      ADD COLUMN "language" character varying,
      ADD COLUMN "summary" text,
      ADD COLUMN "keywords" text,
      ADD COLUMN "extractedData" jsonb DEFAULT '{}',
      ADD COLUMN "importance" real DEFAULT 1.0,
      ADD COLUMN "accessCount" integer DEFAULT 0,
      ADD COLUMN "lastAccessedAt" TIMESTAMP WITH TIME ZONE
    `);

    // Create indexes for better search performance
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_documentType" ON "documents" ("documentType")
    `);
    
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_category" ON "documents" ("category")
    `);
    
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_importance" ON "documents" ("importance")
    `);
    
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_accessCount" ON "documents" ("accessCount")
    `);

    // Create GIN index for keywords array search
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_keywords_gin" ON "documents" USING GIN ("keywords")
    `);

    // Create GIN index for extractedData JSONB search
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_extractedData_gin" ON "documents" USING GIN ("extractedData")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.query(`DROP INDEX "IDX_documents_extractedData_gin"`);
    await queryRunner.query(`DROP INDEX "IDX_documents_keywords_gin"`);
    await queryRunner.query(`DROP INDEX "IDX_documents_accessCount"`);
    await queryRunner.query(`DROP INDEX "IDX_documents_importance"`);
    await queryRunner.query(`DROP INDEX "IDX_documents_category"`);
    await queryRunner.query(`DROP INDEX "IDX_documents_documentType"`);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE "documents" 
      DROP COLUMN "lastAccessedAt",
      DROP COLUMN "accessCount",
      DROP COLUMN "importance",
      DROP COLUMN "extractedData",
      DROP COLUMN "keywords",
      DROP COLUMN "summary",
      DROP COLUMN "language",
      DROP COLUMN "category",
      DROP COLUMN "documentType"
    `);
  }
}
