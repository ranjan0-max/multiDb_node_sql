const express = require('express');
const DashboardController = require('../Controllers/dashboard.controller');
const router = express.Router();
const { authJwt, authorize } = require('../Middleware/apiAuth.middleware');
const dynamicDbConnectionMiddleware = require('../Middleware/getDynamicConnection.middleware');

router
  .get('/', authJwt, dynamicDbConnectionMiddleware, DashboardController.getClientWebDashboardData)
  .get('/useDashboard', authJwt, dynamicDbConnectionMiddleware, DashboardController.getUserDashboardData)
  .get('/mobileDashboard', authJwt, dynamicDbConnectionMiddleware, DashboardController.getDashboardDataForMobile);

module.exports = router;
