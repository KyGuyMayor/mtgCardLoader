/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('collection_entries', (table) => {
    table.boolean('is_proxy').defaultTo(false).notNullable();
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('collection_entries', (table) => {
    table.dropColumn('is_proxy');
  });
};
