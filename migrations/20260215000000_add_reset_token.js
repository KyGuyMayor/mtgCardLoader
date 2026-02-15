/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('reset_token', 64).nullable();
    table.timestamp('reset_token_expires').nullable();
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('reset_token');
    table.dropColumn('reset_token_expires');
  });
};
