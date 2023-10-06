var express = require('express');
var router = express.Router();
var { executeScript } = require('../scripts/oneListing');
var { joinTwoTables } = require('../sequelizer/controller/controller')
const { sequelize } = require('../config/config');
const { format } = require('date-fns');

router.get('/', function(req, res, next) {
  res.render('oneListing');

});

router.get('/oneListing', function(req, res, next) {
  res.redirect('/');

});

router.get('/allListings', function(req, res, next) {
  res.render('allListings');

});

router.get('/scheduledUpdates', function(req, res, next) {
  res.render('scheduledUpdates');

});

router.get('/resorts', function(req, res, next) {
  res.render('resorts');

});

router.get('/events', function(req, res, next) {
  res.render('events');

});

router.get('/one', async(req, res, next) => {
  const resortID = req.query.resort_id;
  const suiteType = req.query.suite_type;
  const months = req.query.months;

  console.log(resortID)
  console.log(suiteType)
  console.log(months)

  res.redirect('/');

  const token = await req.token;
  const executedScript = await executeScript(token, resortID, suiteType, months);

  console.log("Executed Script Successfully: " + executedScript);


});

// SSE ENDPOINTS
router.get('/sse/oneListing', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  setInterval(async () => {
    const eventCond = {
      execType: "ONE_RESORT"
    }

    
    let data = await joinTwoTables("execution", "resorts", eventCond, "createdAt");

    const formattedRecords = data.map(item => ({
      ...item.toJSON(), 
      resort: {
        listingName: item.resort.listingName === null? "To be updated": item.resort.listingName, 
        resortName: item.resort.resortName === null? "To be updated": item.resort.resortName, 
        unitType: item.resort.unitType === null? "To be updated": item.resort.unitType, 
      },
      createdAt: format(item.createdAt, 'MM-dd-yyyy HH:mm:ss'),
      updatedAt: format(item.updatedAt, 'MM-dd-yyyy HH:mm:ss'),
    }));

    res.write(`data: ${JSON.stringify(formattedRecords)}\n\n`);
  }, 1000);
});

module.exports = router;





