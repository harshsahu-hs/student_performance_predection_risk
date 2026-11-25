const { runMigrations } = require('./migrate');

async function setupTestDb() {
  // Tests run in a disposable schema on the same InsForge database so they never
  // touch the public schema. DB_SCHEMA defaults to student_performance_test.
  await runMigrations({ silent: true });
}

if (require.main === module) {
  setupTestDb()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`[setup-test-db] ${err.message}`);
      process.exit(1);
    });
}

module.exports = { setupTestDb };
