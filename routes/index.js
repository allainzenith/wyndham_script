var express = require('express');
var router = express.Router();
const { format } = require('date-fns-tz');
var { joinTwoTables } = require('../sequelizer/controller/controller');
var { addToQueue, resourceIntensiveTask } = require('../scripts/queueProcessor');
const { findOrCreateAResort, createAnEvent } = require('../scripts/oneListing');
var { login, sendOTP } = require('../services/scraper')
const { globals } =  require('../config/puppeteerOptions'); 

router.get('/', async(req, res, next) => {
  res.render('oneListing');
});

router.get('/verify', async(req, res, next) => {
  res.render('verify');
  await globals();
  await login();
});

router.post('/sendOTP', async(req, res, next) => {
  let verOTP = req.body.OTP;

  let loggedIn = await sendOTP(verOTP);
  
  if (loggedIn){
    res.redirect('/oneListing')
  } else {
    //display a modal
    res.redirect('/allListings')
  }

});

router.get('/oneListing', function(req, res, next) {
  res.render('oneListing');
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

// FOR CALLING SERVICES AND SCRIPTS
router.post('/one', async(req, res, next) => {

  var resortID = req.body.resort_id;
  var suiteType = req.body.suite_type;
  var months = req.body.months;
  var token = await req.token;   

  res.redirect('/oneListing'); 
  

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
  }, 10000);
});

module.exports = router;





