const express = require('express');
const { sequelize } = require("../config/config");
const { Op } = require("sequelize");
const router = express.Router();
const { format } = require('date-fns-tz');
const { joinTwoTables, countRecords, findLikeRecords, findByPk, updateRecord, setupCreateHook, setupUpdateHook, setupBulkCreateHook, removeHooks } = require('../sequelizer/controller/controller');
const { addToQueue, resourceIntensiveTask, processVerification } = require('../scripts/queueProcessor');
const { findOrCreateAResort, createAnEvent, updateEventStatus } = require('../scripts/scrapeAndUpdate');
const { resendSmsCode } = require('../services/scraper')
const { v5: uuidv5 } = require('uuid');

let isVerified = false;
const THREAD_COUNT = 2;

function createWorker() {
  return new Promise((resolve, reject) => {

  });
}

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
  let execID = req.body.execID;
  let event = await findByPk(execID, "execution");

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

            isVerified = loggedIn;  
            const message = "successOrFail";

            if (isVerified){
              updateEventStatus(event, "SCRAPING");
            } else {
              if (loggedIn === "MAINTENANCE") {
                updateEventStatus(event, "MAINTENANCE");
              } else if (loggedIn === null) {
                updateEventStatus(event, "OTP_ERROR");
              } else {
                updateEventStatus(event, "UNVERIFIED");
              }
            }

            res.json({ loggedIn, message });

          })
          .catch(error => {
            console.error('Send OTP error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
          });
      } catch (error) {
        console.error('Error triggering sending OTP:', error);
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
          let eventCreated = findByPk(req.body.execID, "execution");
          res.json({ needsVerify });

          if (needsVerify === "MAINTENANCE") {
            updateEventStatus(eventCreated, "MAINTENANCE");
          } 
        })
        .catch(error => {
          console.error('Resend OTP error:', error);
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
  var months = (req.body.months).trim() > 12 ? 12 : (req.body.months).trim();

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
          let event = findByPk(execID, "execution");

          isVerified = loggedIn;
          
          if (loggedIn === "MAINTENANCE") {
            updateEventStatus(event, "MAINTENANCE");
          } else if (loggedIn === null) {
            updateEventStatus(event, "LOGIN_ERROR");
          }

          res.json({ loggedIn, execID });
        })
        .catch(error => {
          console.error('One error:', error);
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
  var months = (req.query.months).trim() > 12 ? 12 : (req.query.months).trim();
  
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
          console.error('Retry error:', error);
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

const mapExecutionData = async(data) => {
  try {
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

    return formattedRecords;
  } catch (error) {
    console.error("Error mapping the records: ", error);
    return [];
  }
}

let createHook, updateHook, bulkHook;
const clients = [];
const namespace = '1b671a64-40d5-491e-99b0-da01ff1f3341';
const updateExecutionRecords = async (req, res, firstModel, secondModel, eventCond, order) => {
  let limit = parseInt(req.query.limit);
  let offset = parseInt(req.query.offset);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Use UUIDv5 generated from the string representation of the response object
  const clientUuid = uuidv5(res.toString(), namespace);

  // Store the response object and associated UUID for later use
  clients.push({ res, clientUuid });

  // Handle client disconnection
  req.on('close', async () => {
    console.log("One res disconnected");
    await removeHooks("execution", ['afterCreate', 'afterUpdate', 'afterBulkCreate'], clientUuid);
    // Remove the response object from the array when the client disconnects
    const index = clients.findIndex(client => client.res === res);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });

  let update = async () => {
    try {
      let data = await joinTwoTables(firstModel, secondModel, eventCond, order, limit, offset);
      let formattedRecords = await mapExecutionData(data);

      res.write(`data: ${JSON.stringify(formattedRecords)}\n\n`);

    } catch (error) {
      console.error("An error happened while joining records: ", error);
    }
  };

  await setupUpdateHook("execution", update, clientUuid);
  await setupCreateHook("execution", update, clientUuid);
  await setupBulkCreateHook("execution", update, clientUuid);

  update();
};

router.get('/sse/oneListing', async (req, res) => {
  const eventCond = {
    execType: "ONE_RESORT"
  }

  const order = [
    [sequelize.col("createdAt"), 'DESC'],
  ];

  try {
    await updateExecutionRecords(req, res, "execution", "resorts", eventCond, order)
  } catch (error) {
    console.error('Error sending SSE data:', error);
  }

});

router.get('/sse/scheduledUpdates', async(req, res) => {

  const eventCond = {
    execType: "SCHEDULED"
  }

  const order = [
    [sequelize.col("createdAt"), 'DESC'],  
    [sequelize.col("resortID"), 'ASC'],  
    [sequelize.col("resort.unitType"), 'ASC'],  
  ];

  try {
    await updateExecutionRecords(req, res, "execution", "resorts", eventCond, order)
  } catch (error) {
    console.error('Error sending SSE data:', error);
  }

});

router.get('/sse/events', async(req, res) => {

  let search = req.query.search;

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

  try {
    await updateExecutionRecords(req, res, "execution", "resorts", eventCond, order)
  } catch (error) {
    console.error('Error sending SSE data:', error);
  }

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

  // Use UUIDv5 generated from the string representation of the response object
  const clientUuid = uuidv5(res.toString(), namespace);

  // Store the response object and associated UUID for later use
  clients.push({ res, clientUuid });

  // Handle client disconnection
  req.on('close', async () => {
    console.log("One res disconnected");
    await removeHooks("resorts", ['afterCreate', 'afterUpdate', 'afterBulkCreate'], clientUuid);
    // Remove the response object from the array when the client disconnects
    const index = clients.findIndex(client => client.res === res);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });


  let update = async() => {
    try {
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

    } catch (error) {
      console.error("An error happened while joining records: ", error);
    }
  };


  await setupCreateHook("resorts", update);
  await setupUpdateHook("resorts", update);

  update();

});


  module.exports = router;





