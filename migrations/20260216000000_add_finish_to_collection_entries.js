/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  // Create ENUM type if it doesn't exist
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE finish AS ENUM ('nonfoil', 'foil', 'etched');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Add the column with the new ENUM type
  await knex.schema.alterTable('collection_entries', (table) => {
    table.specificType('finish', 'finish').defaultTo('nonfoil').notNullable();
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('collection_entries', (table) => {
    table.dropColumn('finish');
  });

  // Drop the ENUM type
  await knex.raw('DROP TYPE IF EXISTS finish CASCADE;');
};
