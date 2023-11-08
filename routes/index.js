var express = require('express');
var router = express.Router();
const { format } = require('date-fns-tz');
var { joinTwoTables, countRecords, countRecords, findLikeRecords, findByPk } = require('../sequelizer/controller/controller');
var { addToQueue, resourceIntensiveTask } = require('../scripts/queueProcessor');
const { findOrCreateAResort, createAnEvent, updateEventStatus } = require('../scripts/scrapeAndUpdate');
var { login, sendOTP } = require('../services/scraper')
const { sequelize } = require("../config/config");

router.get('/', async(req, res, next) => {
  const amount = await countRecords("execution", {execType:"ONE_RESORT"});
  res.render('oneListing', {records:amount});
});

router.get('/oneListing', async(req, res, next) => {
  res.redirect('/');
});

router.get('/allListings', function(req, res, next) {
  res.render('allListings');

});

router.get('/scheduledUpdates', async(req, res, next) => {
  const amount = await countRecords("execution", {execType:"SCHEDULED"});
  res.render('scheduledUpdates', {records:amount});
});

router.get('/resorts', async(req, res, next) => {
  const amount = await countRecords("resorts", {});
  res.render('resorts', {records:amount});

});

router.get('/events', function(req, res, next) {
  res.render('events');

});

router.get('/verify', async(req, res, next) => {
  res.render('verify');
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

router.get('/duplicateListingLinks', (req, res) => {
  const links = JSON.parse(req.query.links);
  res.render('duplicateListingLinks', { links });
});

///////////////////////////////////////////////////////////////////////////////
// Endpoints for forms
///////////////////////////////////////////////////////////////////////////////

router.post('/one', async(req, res, next) => {

  var resortID = (req.body.resort_id).trim();
  var suiteType = (req.body.suite_type).trim();
  var months = (req.body.months).trim();
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

});

router.post('/tier/update', async(req, res, next) => {
  console.log(req.body.checkboxes);
  console.log("Tiers updated!!");

});

///////////////////////////////////////////////////////////////////////////////
// For retrying  
///////////////////////////////////////////////////////////////////////////////

router.get('/retry', async(req, res, next) => {

  var resortID = (req.query.resort_id).trim();
  var suiteType = (req.query.suite_type).trim();
  var months = (req.query.months).trim();
  var token = await req.token;   
  
  res.send("Retrying now..");

  let resort = await findOrCreateAResort(resortID, suiteType); 
  let eventCreated = await findByPk((req.query.execID).trim(), "execution");
  let retryScraping = await updateEventStatus(eventCreated, "SCRAPING");
  
  if (retryScraping){
    //first parameter is a callback function
    addToQueue(resourceIntensiveTask, () => {
      console.log('Task completed');
    }, token, resortID, suiteType, months, resort, eventCreated);
  } else {
    console.log("Creating a resort or execution record failed.")
  }

});


///////////////////////////////////////////////////////////////////////////////
// SSE ENDPOINTS                
///////////////////////////////////////////////////////////////////////////////

router.get('/sse/oneListing', (req, res) => {
  let limit = parseInt(req.query.limit);
  let offset = parseInt(req.query.offset);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  setInterval(async () => {
    const eventCond = {
      execType: "ONE_RESORT"
    }

    const order = [
      [sequelize.col("createdAt"), 'DESC'],  
    ];

    let data = await joinTwoTables("execution", "resorts", eventCond, order, limit, offset);

    const formattedRecords = data.map(item => ({
      ...item.toJSON(), 
      resort: {
        listingName: item.resort.listingName === null? "To be updated": item.resort.listingName, 
        listingID: item.resort.listingID === null? "To be updated": item.resort.listingID, 
        resortName: item.resort.resortName === null? "To be updated": item.resort.resortName, 
        unitType: item.resort.unitType === null? "To be updated": item.resort.unitType, 
        resortID: item.resort.resortID === null? "To be updated": item.resort.resortID, 
      }, 
      execID: item.execID === null? "To be updated": item.execID,  
      createdAt: format(item.createdAt, 'MM-dd-yyyy HH:mm:ss', { timeZone: 'America/New_York' }),
      updatedAt: format(item.updatedAt, 'MM-dd-yyyy HH:mm:ss', { timeZone: 'America/New_York' }),
    }));

    res.write(`data: ${JSON.stringify(formattedRecords)}\n\n`);
  }, 1000);
});

router.get('/sse/scheduledUpdates', (req, res) => {
  let limit = parseInt(req.query.limit);
  let offset = parseInt(req.query.offset);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  setInterval(async () => {
    const eventCond = {
      execType: "SCHEDULED"
    }

    const order = [
      [sequelize.col("createdAt"), 'DESC'],  
      [sequelize.col("resortID"), 'ASC'],  
      [sequelize.col("resort.unitType"), 'ASC'],  
    ];

    let data = await joinTwoTables("execution", "resorts", eventCond, order, limit, offset);

    const formattedRecords = data.map(item => ({
      ...item.toJSON(), 
      resort: {
        listingName: item.resort.listingName === null? "To be updated": item.resort.listingName, 
        listingID: item.resort.listingID === null? "To be updated": item.resort.listingID, 
        resortName: item.resort.resortName === null? "To be updated": item.resort.resortName, 
        unitType: item.resort.unitType === null? "To be updated": item.resort.unitType, 
        resortID: item.resort.resortID === null? "To be updated": item.resort.resortID, 
      },  
      createdAt: format(item.createdAt, 'MM-dd-yyyy HH:mm:ss', { timeZone: 'America/New_York' }),
      updatedAt: format(item.updatedAt, 'MM-dd-yyyy HH:mm:ss', { timeZone: 'America/New_York' }),
    }));

    res.write(`data: ${JSON.stringify(formattedRecords)}\n\n`);
  }, 1000);
});


router.get('/sse/resorts', async(req, res) => {
  let limit = parseInt(req.query.limit);
  let offset = parseInt(req.query.offset);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let search = req.query.search;

  const order = [
    [sequelize.col("resortID"), 'DESC'], 
  ];

  let data = await findLikeRecords(search, "resorts", order, limit, offset);

  const formattedRecords = data.map(item => ({
    ...item.toJSON(),  
    resortRefNum: item.resortRefNum === null? "To be updated": item.resortRefNum,
    listingID: item.listingID === null? "To be updated": item.listingID,
    resortID: item.resortID === null? "To be updated": item.resortID,
    resortName: item.resortName === null? "To be updated": item.resortName,
    listingName: item.listingName === null? "To be updated": item.listingName,
    unitType: item.unitType === null? "To be updated": item.unitType,

  }));

  res.write(`data: ${JSON.stringify(formattedRecords)}\n\n`);
});


module.exports = router;





