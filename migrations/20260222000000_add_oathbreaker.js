/**
 * Migration to add OATHBREAKER to deck_type enum and is_signature_spell column.
 * Idempotent: safe to run multiple times using ALTER TYPE ... ADD VALUE IF NOT EXISTS.
 */

exports.up = async function (knex) {
  // Add OATHBREAKER to deck_type enum (idempotent)
  await knex.raw("ALTER TYPE deck_type ADD VALUE IF NOT EXISTS 'OATHBREAKER'");

  // Add is_signature_spell column to collection_entries
  await knex.schema.alterTable('collection_entries', (table) => {
    table.boolean('is_signature_spell').notNullable().defaultTo(false);
  });
};

/**
 * Down migration: remove is_signature_spell column.
 * PostgreSQL does not support removing enum values, so enum removal is a no-op.
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('collection_entries', (table) => {
    table.dropColumn('is_signature_spell');
  });

  // PostgreSQL does not support removing enum values — no-op
  // (OATHBREAKER will remain in deck_type enum)
};
