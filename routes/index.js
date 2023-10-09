var express = require('express');
var router = express.Router();
const { format } = require('date-fns-tz');
var { joinTwoTables } = require('../sequelizer/controller/controller');
var { addToQueue, resourceIntensiveTask } = require('../scripts/queueProcessor');
const { findOrCreateAResort, createAnEvent } = require('../scripts/oneListing');

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

  var resortID = req.query.resort_id;
  var suiteType = req.query.suite_type;
  var months = req.query.months;
  var token = await req.token;  
  res.redirect('/');  

  let resort = await findOrCreateAResort(resortID, suiteType); 
  let eventCreated = ( resort !== null) ? await createAnEvent(resort.resortRefNum, months) : null;


  if (eventCreated !== null){
    //first parameter is a callback function
    addToQueue(resourceIntensiveTask, () => {
      console.log('Task completed');
    }, token, resortID, suiteType, months, resort, eventCreated);
  } else {
    console.log("Creating a resort or execution record failed.")
  }

  
  // console.log("executed: " + executed);
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
      createdAt: format(item.createdAt, 'MM-dd-yyyy HH:mm:ss', { timeZone: 'America/New_York' }),
      updatedAt: format(item.updatedAt, 'MM-dd-yyyy HH:mm:ss', { timeZone: 'America/New_York' }),
    }));

    res.write(`data: ${JSON.stringify(formattedRecords)}\n\n`);
  }, 1000);
});

module.exports = router;





