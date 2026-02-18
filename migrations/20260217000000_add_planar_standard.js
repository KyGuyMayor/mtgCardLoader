/**
 * Migration to add PLANAR_STANDARD to deck_type enum.
 * Uses ALTER TYPE ... ADD VALUE IF NOT EXISTS for idempotent execution.
 */

exports.up = function(knex) {
  return knex.raw("ALTER TYPE deck_type ADD VALUE IF NOT EXISTS 'PLANAR_STANDARD'");
};

/**
 * PostgreSQL does not support removing enum values.
 * This down migration is a no-op.
 */
exports.down = function(knex) {
  // PostgreSQL does not support removing enum values — no-op
  return Promise.resolve();
};
