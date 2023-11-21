const express = require('express');
const router = express.Router();
const { format } = require('date-fns-tz');
const { joinTwoTables, countRecords, findLikeRecords, findByPk, updateRecord } = require('../sequelizer/controller/controller');
const { addToQueue, resourceIntensiveTask, processVerification } = require('../scripts/queueProcessor');
const { findOrCreateAResort, createAnEvent, updateEventStatus } = require('../scripts/scrapeAndUpdate');
const { login, resendSmsCode, sendOTP } = require('../services/scraper')
const { sequelize } = require("../config/config");
const { Op } = require("sequelize");

let isVerified = false;

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

router.get('/events', async(req, res, next) => {
  const amount = await countRecords("resorts", {});
  res.render('events', {records:amount});

});

router.get('/duplicateListingLinks', (req, res) => {
  const links = JSON.parse(req.query.links);
  res.render('duplicateListingLinks', { links });
});

///////////////////////////////////////////////////////////////////////////////
// For verification  
///////////////////////////////////////////////////////////////////////////////

router.post('/sendOTP', async(req, res, next) => {
  let verOTP = req.body.OTP;

  if (isVerified === false) {
    if (verOTP === "") {
      const verified = false;
      const message = "empty";
      res.json({ verified, message });  
    }
    else {
      try {
        // Trigger the login process asynchronously
        processVerification(verOTP)
          .then(loggedIn => {
            let eventCreated = findByPk(req.body.execID, "execution");
            isVerified = loggedIn;  
            const message = "successOrFail";
            res.json({ loggedIn, message });

            if (isVerified){
              updateEventStatus(eventCreated, "SCRAPING");
            } else {
              if (loggedIn === "MAINTENANCE") {
                updateEventStatus(eventCreated, "MAINTENANCE");
              } else if (loggedIn === null) {
                updateEventStatus(eventCreated, "OTP_ERROR");
              } else {
                updateEventStatus(eventCreated, "UNVERIFIED");
              }
            }

          })
          .catch(error => {
            console.error('Send OTP error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
          });
      } catch (error) {
        console.error('Error triggering login:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  } else {
    const verified = true;
    const message = "already verified";
    res.json({ verified, message });
  }


});

router.post('/resendOTP', async(req, res, next) => {
  if (isVerified === false) {
    try {
      // Trigger the login process asynchronously
      resendSmsCode()
        .then(needsVerify => {  
          res.json({ needsVerify });

          if (needsVerify === "MAINTENANCE") {
            updateEventStatus(eventCreated, "MAINTENANCE");
          } 
        })
        .catch(error => {
          console.error('Login process error:', error);
          res.status(500).json({ error: 'Internal Server Error' });
        });
    } catch (error) {
      console.error('Error triggering login:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    const needsVerify = false;
    res.json({ needsVerify });
  }

});



///////////////////////////////////////////////////////////////////////////////
// Endpoints for forms
///////////////////////////////////////////////////////////////////////////////
router.post('/one', async(req, res, next) => {

  var resortID = (req.body.resort_id).trim();
  var suiteType = (req.body.suite_type).trim();
  var months = (req.body.months).trim();

  let resort = await findOrCreateAResort(resortID, suiteType); 
  let eventCreated = ( resort !== null) ? await createAnEvent(resort.resortRefNum, months) : null;
  
  if (eventCreated !== null){
    try {
      let execID = eventCreated.execID;

      // Trigger the login process asynchronously
      addToQueue(resourceIntensiveTask, () => {
        console.log('Task completed');
      }, resortID, suiteType, months, resort, eventCreated)
        .then(loggedIn => {

          isVerified = loggedIn;
          
          if (loggedIn === "MAINTENANCE") {
            updateEventStatus(eventCreated, "MAINTENANCE");
          } else if (loggedIn === null) {
            updateEventStatus(eventCreated, "LOGIN_ERROR");
          }

          res.json({ loggedIn, execID });
        })
        .catch(error => {
          console.error('Login process error:', error);
          res.status(500).json({ error: 'Internal Server Error' });
        });
    } catch (error) {
      console.error('Error triggering login:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }

  } else {
    console.log("Creating a resort or execution record failed.")
  }
  

});

router.post('/tier/update', async(req, res, next) => {
  let resortRefNums = req.body.checkboxes;
  let tier = req.query.tier;


  for ( const resortRef of resortRefNums ) {
    let resort = await findByPk(resortRef, "resorts");

    const updateResort = {
      notes: tier
    }

    await updateRecord(updateResort, resort);
  }

  console.log("Tiers updated!!");

});

///////////////////////////////////////////////////////////////////////////////
// For retrying  
///////////////////////////////////////////////////////////////////////////////

router.get('/retry', async(req, res, next) => {

  var resortID = (req.query.resort_id).trim();
  var suiteType = (req.query.suite_type).trim();
  var months = (req.query.months).trim();

  let resort = await findOrCreateAResort(resortID, suiteType); 
  let eventCreated = await findByPk((req.query.execID).trim(), "execution");

  await updateEventStatus(eventCreated, "SCRAPING");
  
  if (eventCreated !== null){
    try {
      let execID = eventCreated.execID;
      // Trigger the login process asynchronously
      addToQueue(resourceIntensiveTask, () => {
        console.log('Task completed');
      }, resortID, suiteType, months, resort, eventCreated)
        .then(loggedIn => {

          isVerified = loggedIn;

          eventCreated = findByPk((req.query.execID).trim(), "execution");
          
          if (loggedIn === "MAINTENANCE") {
            updateEventStatus(eventCreated, "MAINTENANCE");
          } else if (loggedIn === null) {
            updateEventStatus(eventCreated, "LOGIN_ERROR");
          }

          res.json({ loggedIn, execID });
        })
        .catch(error => {
          console.error('Login process error:', error);
          res.status(500).json({ error: 'Internal Server Error' });
        });
    } catch (error) {
      console.error('Error triggering login:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }

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
    let formattedRecords = [];
    if (Array.isArray(data)) {
      formattedRecords = data.map(item => ({
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

    }

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

    let formattedRecords = [];
    if (Array.isArray(data)) {
      formattedRecords = data.map(item => ({
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
    }

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
  let formattedRecords = [];
  if (Array.isArray(data)) {
    formattedRecords = data.map(item => ({
      ...item.toJSON(),  
      resortRefNum: item.resortRefNum === null? "To be updated": item.resortRefNum,
      listingID: item.listingID === null? "To be updated": item.listingID,
      resortID: item.resortID === null? "To be updated": item.resortID,
      resortName: item.resortName === null? "To be updated": item.resortName,
      listingName: item.listingName === null? "To be updated": item.listingName,
      unitType: item.unitType === null? "To be updated": item.unitType,
      notes: item.notes === null? "": item.notes,

    }));
  }

  res.write(`data: ${JSON.stringify(formattedRecords)}\n\n`);
});

router.get('/sse/events', (req, res) => {
  let limit = parseInt(req.query.limit);
  let offset = parseInt(req.query.offset);

  let search = req.query.search;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  setInterval(async () => {
    const eventCond = {
      [Op.or]: [
        // { "resort.resortID": { [Op.substring]: search } },
        // { "resort.resortName": { [Op.substring]: search } },
        // { "resort.listingName": { [Op.substring]: search } },
        // { "resort.unitType": { [Op.substring]: search } },
        { "execStatus": { [Op.substring]: search } },
        { "monthstoScrape": { [Op.substring]: search } },
        { "createdAt": { [Op.substring]: search } },
        { "updatedAt": { [Op.substring]: search } },
      ],
    }

    const order = [
      [sequelize.col("createdAt"), 'DESC'],  
    ];

    let data = await joinTwoTables("execution", "resorts", eventCond, order, limit, offset);
    let formattedRecords = [];
    if (Array.isArray(data)) {
      formattedRecords = data.map(item => ({
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
    }

    // console.log(JSON.stringify(formattedRecords, null, 2));

    res.write(`data: ${JSON.stringify(formattedRecords)}\n\n`);
  }, 1000);
});


module.exports = router;





