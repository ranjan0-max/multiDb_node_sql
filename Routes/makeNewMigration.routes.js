const express = require('express');
const router = express.Router();
const DbOperationController = require('../Controllers/dbOperation.controller');

router
  .get(
    '/makeMigration',
    (req, res, next) => {
      if (req.query.developer === 'ranjan1213') {
        return next();
      }
      return res.status(403).json({ error: 'Admin Only' });
    },
    DbOperationController.makeNewMigrationOnClientDb
  )
  .get('/runMigrationForClient', DbOperationController.migrationForClientDb)
  .get('/testClientConnection', DbOperationController.testClientConnection)
  .get('/runMigrationForMainDb', DbOperationController.migrationForMainDB);

module.exports = router;
