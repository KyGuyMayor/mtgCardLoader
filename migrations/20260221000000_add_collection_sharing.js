/**
 * Migration to add collection sharing support.
 * Adds visibility column and share_slug to collections table.
 * Creates collection_shares table for invite-based sharing.
 */

exports.up = function(knex) {
  return knex.schema
    // 1. Create visibility_type ENUM (idempotent)
    .raw(`
      DO $$ BEGIN
        CREATE TYPE visibility_type AS ENUM ('PRIVATE', 'INVITE_ONLY', 'PUBLIC');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)
    // 2. Add visibility and share_slug columns to collections table
    .alterTable('collections', table => {
      table.specificType('visibility', 'visibility_type').notNullable().defaultTo('PRIVATE');
      table.string('share_slug', 36).nullable().unique().comment('UUID for public/invite-only sharing');
    })
    // 3. Create collection_shares table
    .createTable('collection_shares', table => {
      table.increments('id').primary();
      table.integer('collection_id').unsigned().notNullable().references('id').inTable('collections').onDelete('CASCADE');
      table.integer('shared_with_user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Unique constraint to prevent duplicate invites
      table.unique(['collection_id', 'shared_with_user_id']);
      
      // Index for efficient lookup of collections shared with a user
      table.index('shared_with_user_id');
    })
    // 4. Add index on share_slug for efficient public lookup
    .raw('CREATE INDEX idx_collections_share_slug ON collections(share_slug) WHERE share_slug IS NOT NULL');
};

exports.down = function(knex) {
  return knex.schema
    // 1. Drop collection_shares table
    .dropTableIfExists('collection_shares')
    // 2. Remove visibility and share_slug columns from collections
    .alterTable('collections', table => {
      table.dropColumn('visibility');
      table.dropColumn('share_slug');
    })
    // 3. Drop visibility_type ENUM
    .raw('DROP TYPE IF EXISTS visibility_type');
};
