import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetupPgVector1727200000000 implements MigrationInterface {
  name = 'SetupPgVector1727200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Check if embedding column exists, if not create it
    const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'chunks' AND column_name = 'embedding'
    `);

    if (columnExists.length === 0) {
      // Add the embedding column as vector(768) - nomic-embed-text embedding size
      await queryRunner.query(`
        ALTER TABLE "chunks" 
        ADD COLUMN "embedding" vector(768)
      `);
    }

    // Create pgvector cosine similarity index for optimal search performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chunks_embedding_cosine" 
      ON "chunks" USING ivfflat ("embedding" vector_cosine_ops) 
      WITH (lists = 100)
    `);

    // Create additional index for L2 distance (Euclidean)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_chunks_embedding_l2" 
      ON "chunks" USING ivfflat ("embedding" vector_l2_ops) 
      WITH (lists = 100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_chunks_embedding_l2"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_chunks_embedding_cosine"`);

    // Drop embedding column
    await queryRunner.query(`ALTER TABLE "chunks" DROP COLUMN IF EXISTS "embedding"`);

    // Note: We don't drop the vector extension as it might be used by other applications
    // await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
  }
}
